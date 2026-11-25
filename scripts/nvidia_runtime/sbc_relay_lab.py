"""Actual NeMo Relay SDK lifecycle test of canonical SBC review policy."""
import asyncio
import importlib.metadata
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT=Path(__file__).resolve().parents[2]
PIN="0.11.0"
# Do not configure external trace export. Only synthetic data in a private temporary directory.
CONFIG="""version = 1
[policy]
unknown_component = "error"
unknown_field = "error"
unsupported_value = "error"
[[components]]
kind = "observability"
enabled = true
[components.config]
version = 4
enable_full_payloads = false
[components.config.atof]
enabled = true
[[components.config.atof.sinks]]
type = "file"
output_directory = "logs"
filename = "events.jsonl"
mode = "overwrite"
"""
def call_policy(role=None,tool=None):
    code="""const f=require('./enterprise/sbc-intelligence-factory.cjs');
const [agent,tool]=process.argv.slice(1);
const result=agent?f.reviewProposal({agent,tool,tenantId:7},{tenantId:7}):f.buildFactory({departments:[]}).agents.map(x=>({id:x.id,tool:x.tool}));
console.log(JSON.stringify(result));"""
    argv=[os.environ.get("SBC_NODE_BIN","node"),"-e",code]
    if role is not None:argv.extend([role,tool])
    result=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,check=True,timeout=10)
    return json.loads(result.stdout)

async def run_trace_lab():
    os.environ["OTEL_SDK_DISABLED"]="true"
    os.environ["DO_NOT_TRACK"]="1"
    if importlib.metadata.version("nemo-relay")!=PIN:raise RuntimeError("UNREVIEWED_SDK_VERSION")
    import nemo_relay
    roles=call_policy()
    if len(roles)!=9 or len({r["id"] for r in roles})!=9:raise RuntimeError("ROLE_EVIDENCE_REQUIRED")
    allowed=denied=0
    cwd=Path.cwd()
    with tempfile.TemporaryDirectory(prefix="sbc-relay-") as temp:
        try:
            os.chdir(temp)
            Path("plugins.toml").write_text(CONFIG)
            async def review(args):
                result=await asyncio.to_thread(call_policy,args["role"],args["tool"])
                if result.get("executionAllowed") is not False:raise RuntimeError("EXECUTION_NOT_ALLOWED")
                return nemo_relay.ToolExecutionResult({"allowed":result["allowed"],"executionAllowed":False})
            async with nemo_relay.plugin.activate({},"plugins.toml"):
                try:
                    with nemo_relay.scope.scope("sbc-synthetic-kim",nemo_relay.ScopeType.Agent) as handle:
                        for row in roles:
                            for tool,expected in [(row["tool"],True),("charge_payment",False)]:
                                r=await nemo_relay.tools.execute("review_proposal",{"role":row["id"],"tool":tool},review,handle=handle)
                                if r.result!={"allowed":expected,"executionAllowed":False}:raise RuntimeError("POLICY_MISMATCH")
                                if expected:allowed+=1
                                else:denied+=1
                finally:
                    await nemo_relay.subscribers.flush_async()
            eventfile=Path("logs/events.jsonl")
            if not eventfile.is_file() or eventfile.stat().st_size>2_000_000:raise RuntimeError("TRACE_EVIDENCE_REQUIRED")
            events=[json.loads(line) for line in eventfile.read_text().splitlines()]
            if not events or any(e.get("atof_version")!="0.1" or e.get("kind") not in ("scope","mark") for e in events):
                raise RuntimeError("TRACE_FORMAT_INVALID")
            starts={e["uuid"]:e for e in events if e["kind"]=="scope" and e.get("scope_category")=="start"}
            closed=set()
            for e in events:
                if e["kind"]!="scope" or e.get("scope_category")!="end":continue
                start=starts.get(e["uuid"])
                if not start or any(e.get(k)!=start.get(k) for k in ("name","category","parent_uuid")):raise RuntimeError("UNPAIRED_TRACE")
                if e["uuid"] in closed:raise RuntimeError("DUPLICATE_TRACE")
                closed.add(e["uuid"])
            if set(starts)!=closed:raise RuntimeError("UNCLOSED_TRACE")
            tools=sum(starts[i].get("category")=="tool" for i in closed)
            agents=sum(starts[i].get("category")=="agent" for i in closed)
            if tools!=18 or agents!=1:raise RuntimeError("TRACE_COUNT_MISMATCH")
            return {"status":"ACTUAL_RELAY_SYNTHETIC_TRACE_PASSED","roles":len(roles),"allowedReviews":allowed,"deniedReviews":denied,"closedToolScopes":tools,"providerCalls":0,"productionCertified":False}
        finally:os.chdir(cwd)

if __name__=="__main__":print(json.dumps(asyncio.run(run_trace_lab()),indent=2))
