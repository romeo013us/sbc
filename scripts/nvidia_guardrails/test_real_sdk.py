import unittest
from sbc_nemo_guardrails_lab import check_proposal, read_sbc_policy, create_rails

class RealNemoTest(unittest.IsolatedAsyncioTestCase):
    async def test_real_sdk_against_all_nine_sbc_roles(self):
        policy=read_sbc_policy()
        self.assertEqual(len(policy),9)
        rails=create_rails()
        try:
            for role,tool in policy.items():
                with self.subTest(role=role):
                    good=await check_proposal(rails,policy,role,tool,'{"tenantId":7}',7)
                    self.assertEqual(good["status"],"ADVISORY_REVIEW")
                    self.assertFalse(good["executionAllowed"])
                    for name,args in [(tool,'{"tenantId":8}'),(tool,'{"tenantId":"7"}'),(tool,'{"tenantId":7,"execute":true}'),("charge_payment",'{"tenantId":7}'),("publish_post",'{"tenantId":7}'),("shell",'{}'),(tool,'not-json')]:
                        result=await check_proposal(rails,policy,role,name,args,7)
                        self.assertEqual(result["status"],"BLOCKED")
                        self.assertFalse(result["executionAllowed"])
                        if name in ("charge_payment","publish_post","shell") or args in ('{"tenantId":8}','{"tenantId":7,"execute":true}'):
                            self.assertEqual(result["reason"],"NVIDIA_TOOL_POLICY")
            other=next(t for r,t in policy.items() if r!="research")
            self.assertEqual((await check_proposal(rails,policy,"research",other,'{"tenantId":7}',7))["status"],"BLOCKED")
        finally:
            await rails.shutdown()

    async def test_unavailable_rail_never_grants_permission(self):
        class Failed:
            async def check_async(self,*a,**k):
                raise RuntimeError("unavailable")
        policy=read_sbc_policy()
        result=await check_proposal(Failed(),policy,"research",policy["research"],'{"tenantId":7}',7)
        self.assertEqual(result["status"],"BLOCKED")
        self.assertFalse(result["executionAllowed"])

if __name__=="__main__":
    unittest.main()
