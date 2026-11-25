"""Standalone synthetic lab; not a GoDaddy route, scheduler, or execution adapter."""
import asyncio
import importlib.metadata
import json
import os
from pathlib import Path
import re
import subprocess

ROOT=Path(__file__).resolve().parents[2]
PIN="0.25.0"

def read_sbc_policy():
    # Obtain the real role/tool pairs from the existing canonical SBC policy.
    command="""const f=require('./enterprise/sbc-intelligence-factory.cjs');
const a=f.buildFactory({departments:[]}).agents;
for(const x of a)if(!f.reviewProposal({agent:x.id,tool:x.tool,tenantId:7},{tenantId:7}).allowed)throw Error('policy mismatch');
console.log(JSON.stringify(Object.fromEntries(a.map(x=>[x.id,x.tool]))));"""
    result=subprocess.run([os.environ.get("SBC_NODE_BIN","node"),"-e",command],cwd=ROOT,check=True,capture_output=True,text=True,timeout=10)
    policy=json.loads(result.stdout)
    if not isinstance(policy,dict) or len(policy)!=9 or any(not re.fullmatch(r"[a-z_]{1,60}",k) or not isinstance(v,str) or not re.fullmatch(r"review_[a-z_]{1,60}",v) for k,v in policy.items()) or len(set(policy.values()))!=9:
        raise RuntimeError("SBC_POLICY_INVALID")
    return policy

def create_rails():
    os.environ["NEMO_GUARDRAILS_NO_USAGE_STATS"]="1"
    os.environ["DO_NOT_TRACK"]="1"
    os.environ["OTEL_SDK_DISABLED"]="true"
    if importlib.metadata.version("nemoguardrails")!=PIN:
        raise RuntimeError("UNREVIEWED_SDK_VERSION")
    from nemoguardrails import Guardrails, RailsConfig
    config=RailsConfig.from_content(config={"models":[],"rails":{"tool_call":{"flows":["tool call validation"]}}})
    return Guardrails(config,use_iorails=True,require_iorails=True)

def strict_json(text):
    def unique(pairs):
        result={}
        for key,value in pairs:
            if key in result:
                raise ValueError("duplicate key")
            result[key]=value
        return result
    return json.loads(text,object_pairs_hook=unique,parse_constant=lambda _: (_ for _ in ()).throw(ValueError("nonfinite")))

async def check_proposal(rails,policy,role,tool,arguments,tenant_id):
    deny={"status":"BLOCKED","executionAllowed":False,"reason":"SBC_CONTEXT_OR_RAIL_FAILURE"}
    # Trusted inputs: role and tenant are provided by the caller's authenticated
    # context in a future integration, never by a model. Here they are fixtures.
    if type(tenant_id) is not int or not 1<=tenant_id<=9007199254740991 or not isinstance(role,str) or role not in policy or not isinstance(tool,str) or not re.fullmatch(r"[a-z_]{1,80}",tool) or not isinstance(arguments,str) or len(arguments)>1024:
        return deny
    try:
        parsed=strict_json(arguments)
    except (ValueError,TypeError,RecursionError):
        return deny
    allowed=[{"type":"function","function":{"name":policy[role],"parameters":{"type":"object","properties":{"tenantId":{"type":"integer","enum":[tenant_id]}},"required":["tenantId"],"additionalProperties":False}}}]
    messages=[{"role":"user","content":"Synthetic SBC permission check."},{"role":"assistant","content":None,"tool_calls":[{"id":"synthetic_call","type":"function","function":{"name":tool,"arguments":arguments}}]}]
    try:
        from nemoguardrails.rails.llm.options import RailStatus,RailType
        result=await asyncio.wait_for(rails.check_async(messages,rail_types=[RailType.TOOL_CALL],tools=allowed),timeout=5)
        if result.status==RailStatus.BLOCKED:
            # A policy verdict is proven only by an actual structured violation.
            return {"status":"BLOCKED","executionAllowed":False,"reason":"NVIDIA_TOOL_POLICY" if getattr(result,"tool_violations",None) else "RAIL_UNAVAILABLE"}
        if result.status!=RailStatus.PASSED:
            return deny
        # Preserve exact SBC checks even if an SDK accepts numeric coercion.
        if tool!=policy[role] or type(parsed) is not dict or set(parsed)!={"tenantId"} or type(parsed["tenantId"]) is not int or parsed["tenantId"]!=tenant_id:
            return deny
        return {"status":"ADVISORY_REVIEW","executionAllowed":False,"reason":"NVIDIA_TOOL_CHECK_PASSED"}
    except Exception:
        return deny
