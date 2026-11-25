"""Conservative, clean-directory-only projection of the verified canonical preview.

Development tests remain in source/CI. This is not a proof of dynamic runtime
dependency closure, nor a production certification. Never overwrite a release.
"""
import argparse
import json
import pathlib
import re
import stat
import zipfile
from v66_canonical_frontend import digest
from v66_canonical_candidate import EXTRAS, encode

TEST_NAME=re.compile(r"(?:[.-]test|_test)\.(?:js|cjs|mjs|py)$|^test_.*\.py$")
TEXT_TYPES={".js",".cjs",".mjs",".py",".json",".html",".css",".sh",".yaml",".yml",".php",".ps1",".sql"}
def candidate(name):
    return name.startswith("test/") or (
        name.startswith(("scripts/","hotfix-assets/")) and TEST_NAME.search(name.rsplit("/",1)[-1]) is not None)
def is_test_command(name):
    return name=="test" or name.startswith("test:")
def literal_ref(name, body):
    base=name.rsplit("/",1)[-1]
    stem=base.rsplit(".",1)[0]
    return base.encode() in body or any(("/"+stem+q).encode() in body for q in ("'",'"',"\x60"))

def select(files):
    """Conservative literal reachability, including retained diagnostic scripts.

    Preserve non-test npm commands and transitive npm-run aliases. Treat
    extensionless relative paths as dependencies too. Unknown dynamic paths
    still require hosted acceptance before any cutover.
    """
    pkg=json.loads(files["package.json"])
    commands=pkg.get("scripts",{})
    if not isinstance(commands,dict) or not all(isinstance(k,str) and isinstance(v,str) for k,v in commands.items()):
        raise ValueError("Invalid package scripts")
    pending={name for name in files if candidate(name)}
    retained=set(files)-pending
    def readable(n):
        return n!="package.json" and not n.startswith("docs/") and pathlib.PurePosixPath(n).suffix.lower() in TEXT_TYPES
    text={n:files[n] for n in files if readable(n)}
    keep_commands={k for k in commands if not is_test_command(k)}
    # Keep a test alias referenced by retained runtime source or operational aliases.
    while True:
        before=(len(retained),len(keep_commands))
        bodies=[text[n] for n in retained if n in text]+[commands[k].encode() for k in keep_commands]
        # One scan, not one full source pass per npm alias.
        alias_pattern=re.compile(rb"\bnpm\s+(?:run(?:-script)?\s+)?([a-zA-Z0-9:_-]+)")
        observed={m.group(1).decode('ascii') for b in bodies for m in alias_pattern.finditer(b)}
        keep_commands.update(observed.intersection(commands))
        bodies += [commands[k].encode() for k in keep_commands]
        joined=b"\n".join(bodies)
        needed={n for n in pending if literal_ref(n,joined)}
        retained.update(needed);pending.difference_update(needed)
        if before==(len(retained),len(keep_commands)):break
    pkg["scripts"]={k:v for k,v in commands.items() if k in keep_commands}
    return sorted(pending), sorted(set(commands)-keep_commands), encode(pkg)

def build(source,destination,expected_commit):
    source,destination=pathlib.Path(source),pathlib.Path(destination)
    if destination.exists() or source.resolve()==destination.resolve():raise ValueError("Destination must be a new file")
    if not re.fullmatch(r"[0-9a-f]{40}",expected_commit):raise ValueError("Expected commit required")
    with zipfile.ZipFile(source) as z:
        names=z.namelist()
        if len(names)!=len(set(names)) or z.testzip() is not None:raise ValueError("Invalid archive")
        for info in z.infolist():
            n=info.filename
            if "\\" in n or "\0" in n or n.startswith("/") or any(p in ("",".","..") for p in n.split("/")) or stat.S_ISLNK(info.external_attr>>16):
                raise ValueError("Unsafe member")
        identity=json.loads(z.read("SBC-FLAT-RELEASE-IDENTITY.json"))
        raw=z.read("SBC-STAGED-INVENTORY.json");inventory=json.loads(raw);receipt=json.loads(z.read("SBC-DEPLOY-RECEIPT.json"))
        hashes=inventory["files"]
        if (identity.get("schema")!=1 or inventory.get("schema")!=1 or identity.get("sourceCommit")!=expected_commit or inventory.get("sourceCommit")!=expected_commit or
            identity.get("frontendLayout")!="canonical-public-v1" or inventory.get("frontendLayout")!="canonical-public-v1" or
            identity.get("candidateOnly") is not True or identity.get("productionCertified") is not False or identity.get("stagedInventorySha256")!=digest(raw)):
            raise ValueError("Canonical release identity mismatch")
        if set(hashes)|EXTRAS!=set(names) or set(hashes)&EXTRAS or any(n.startswith("browser_public/") for n in names):
            raise ValueError("Unexpected inventory membership")
        files={n:z.read(n) for n in hashes}
        if any(digest(files[n])!=h for n,h in hashes.items()):raise ValueError("Inventory checksum mismatch")
        if (receipt.get("sourceCommit")!=expected_commit or receipt.get("sourceFingerprint")!=identity.get("sourceFingerprint") or receipt.get("artifactType")!="server.js" or receipt.get("artifactSha256")!=identity.get("serverSha256") or digest(files["server.js"])!=identity.get("serverSha256")):
            raise ValueError("Server receipt mismatch")
        removed,aliases,pkg=select(files)
        removed_set=set(removed)
        kept={n:h for n,h in hashes.items() if n not in removed_set}
        kept["package.json"]=digest(pkg)
        inventory.update(files=kept,runtimeProfile="lean-preview-v1")
        new_inventory=encode(inventory)
        identity.update(stagedInventorySha256=digest(new_inventory),runtimeProfile="lean-preview-v1",candidateOnly=True,productionCertified=False)
        replacements={"package.json":pkg,"SBC-STAGED-INVENTORY.json":new_inventory,"SBC-FLAT-RELEASE-IDENTITY.json":encode(identity)}
        with zipfile.ZipFile(destination,"x",compression=zipfile.ZIP_DEFLATED,compresslevel=9) as out:
            for n in sorted(set(names)-removed_set):
                info=zipfile.ZipInfo(n,(1980,1,1,0,0,0));info.create_system=3;info.external_attr=z.getinfo(n).external_attr
                out.writestr(info,replacements[n] if n in replacements else z.read(n),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
        raw_removed=sum(z.getinfo(n).file_size for n in removed)
    return {"sourceCommit":expected_commit,"runtimeProfile":"lean-preview-v1","candidateOnly":True,
        "productionCertified":False,"cleanDirectoryRequired":True,"dynamicClosureVerified":False,
        "removedEntries":len(removed),"removedRawBytes":raw_removed,"removedPaths":removed,"removedNpmTestCommands":aliases,
        "sourceZipSha256":digest(source.read_bytes()),"candidateZipSha256":digest(destination.read_bytes()),
        "baselineZipBytes":source.stat().st_size,"candidateZipBytes":destination.stat().st_size}

if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__);p.add_argument("source");p.add_argument("destination");p.add_argument("--expected-commit",required=True)
    a=p.parse_args();print(json.dumps(build(a.source,a.destination,a.expected_commit),indent=2))
