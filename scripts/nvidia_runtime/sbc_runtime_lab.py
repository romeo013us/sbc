"""Explicit standalone synthetic runtime checks; no production route or scheduling."""
import ctypes
import json
from pathlib import Path
import platform

EXPECTED_POLICY={
    "version":1,
    "filesystem_policy":{"include_workdir":False,"read_only":["/usr","/lib","/lib64","/app"],"read_write":["/tmp"]},
    "landlock":{"compatibility":"hard_requirement"},
    "process":{"run_as_user":"sandbox","run_as_group":"sandbox"},
    "network_policies":{},
    "network_middlewares":{}
}
def validate_policy(policy):
    # Exact reviewed candidate only. This is not enforcement attestation.
    return isinstance(policy,dict) and json.dumps(policy,sort_keys=True)==json.dumps(EXPECTED_POLICY,sort_keys=True)

def load_driver():
    if platform.system()=="Linux":
        driver=ctypes.CDLL("libcuda.so.1")
    elif platform.system()=="Windows":
        driver=ctypes.WinDLL("nvcuda.dll",winmode=0x800)
    else:
        raise OSError("Unsupported platform")
    driver.cuInit.argtypes=[ctypes.c_uint]
    driver.cuInit.restype=ctypes.c_int
    for name in ("cuDriverGetVersion","cuDeviceGetCount"):
        method=getattr(driver,name)
        method.argtypes=[ctypes.POINTER(ctypes.c_int)]
        method.restype=ctypes.c_int
    return driver

def cuda_probe(loader=load_driver):
    result={"status":"DRIVER_UNAVAILABLE","deviceCount":None,"driverApiVersion":None,
            "kernelExecuted":False,"productionCertified":False}
    try: driver=loader()
    except (OSError,AttributeError):return result
    try:
        rc=driver.cuInit(0)
        if rc==100:return {**result,"status":"NO_DEVICE","deviceCount":0}
        if rc!=0:return {**result,"status":"DRIVER_ERROR","driverError":rc}
        version,count=ctypes.c_int(),ctypes.c_int()
        rc=driver.cuDriverGetVersion(ctypes.byref(version))
        if rc!=0:return {**result,"status":"DRIVER_ERROR","driverError":rc}
        rc=driver.cuDeviceGetCount(ctypes.byref(count))
        if rc!=0:return {**result,"status":"DRIVER_ERROR","driverError":rc}
        if version.value<=0 or not 0<=count.value<=1024:return {**result,"status":"DRIVER_ERROR"}
        return {**result,"status":"DEVICE_DISCOVERED" if count.value else "NO_DEVICE",
                "deviceCount":count.value,"driverApiVersion":version.value}
    except (ValueError,TypeError,AttributeError,OSError):return {**result,"status":"DRIVER_ERROR"}

if __name__=="__main__":
    import argparse
    parser=argparse.ArgumentParser()
    parser.add_argument("mode",choices=["cuda","policy"])
    args=parser.parse_args()
    if args.mode=="cuda":print(json.dumps(cuda_probe(),indent=2))
    else:
        p=json.loads(Path(__file__).with_name("openshell-synthetic-policy.json").read_text())
        ok=validate_policy(p)
        print(json.dumps({"status":"CANDIDATE_VALID" if ok else "CANDIDATE_REJECTED","enforcementVerified":False}))
        if not ok:raise SystemExit(1)
