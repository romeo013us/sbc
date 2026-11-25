import unittest
from pathlib import Path
import json
from sbc_runtime_lab import cuda_probe, validate_policy

class Driver:
    def cuInit(self,flags): return 0
    def cuDriverGetVersion(self,p): p._obj.value=13000;return 0
    def cuDeviceGetCount(self,p): p._obj.value=2;return 0

class RuntimeTest(unittest.TestCase):
    def test_driver_probe_distinguishes_missing_driver_and_no_device(self):
        def absent(): raise OSError("not installed")
        self.assertEqual(cuda_probe(absent)["status"],"DRIVER_UNAVAILABLE")
        self.assertEqual(cuda_probe(lambda:Driver())["deviceCount"],2)
        class Empty(Driver):
            def cuDeviceGetCount(self,p):p._obj.value=0;return 0
        self.assertEqual(cuda_probe(lambda:Empty())["status"],"NO_DEVICE")
        class Broken(Driver):
            def cuInit(self,flags):return 999
        self.assertEqual(cuda_probe(lambda:Broken())["status"],"DRIVER_ERROR")
    def test_exact_reviewed_policy_denies_egress_and_root(self):
        p=json.loads((Path(__file__).parent/"openshell-synthetic-policy.json").read_text())
        self.assertTrue(validate_policy(p))
        import copy
        for patch in [
          {"network_policies":{"any":{"endpoints":[{"host":"example.com","port":443}]}}},
          {"landlock":{"compatibility":"best_effort"}},
          {"process":{"run_as_user":"0","run_as_group":"0"}},
          {"filesystem_policy":{"include_workdir":True,"read_only":["/"],"read_write":["/tmp"]}},
          {"network_middlewares":{"unexpected":{}}}
        ]:
            changed=copy.deepcopy(p);changed.update(patch)
            self.assertFalse(validate_policy(changed))
if __name__=="__main__":unittest.main()
