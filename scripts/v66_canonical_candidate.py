"""Create a clean-directory-only, non-production canonical runtime candidate."""
import argparse
import json
import pathlib
import tempfile
import zipfile
from v66_canonical_frontend import project, digest

EXTRAS = {'.airo/config.json', 'package-lock.json', 'SBC-FLAT-RELEASE-IDENTITY.json', 'SBC-STAGED-INVENTORY.json'}


def encode(value):
    return (json.dumps(value, sort_keys=True, indent=2)+'\n').encode()


def build(source, destination, expected_commit):
    source, destination = pathlib.Path(source), pathlib.Path(destination)
    if destination.exists() or source.resolve() == destination.resolve():
        raise ValueError('Destination must be a new file')
    with tempfile.TemporaryDirectory() as tmp:
        proof = project(source, pathlib.Path(tmp)/'proof.zip')
    with zipfile.ZipFile(source) as original:
        names = set(original.namelist())
        identity = json.loads(original.read('SBC-FLAT-RELEASE-IDENTITY.json'))
        inventory = json.loads(original.read('SBC-STAGED-INVENTORY.json'))
        receipt = json.loads(original.read('SBC-DEPLOY-RECEIPT.json'))
        files = inventory['files']
        if identity.get('sourceCommit') != expected_commit or identity.get('schema') != 1:
            raise ValueError('Expected source commit mismatch')
        if identity.get('frontendLayout','mirrored-v1') != 'mirrored-v1':
            raise ValueError('Expected mirrored source')
        if set(files) | EXTRAS != names or set(files) & EXTRAS:
            raise ValueError('Unexpected inventory membership')
        if any(digest(original.read(n)) != h for n,h in files.items()):
            raise ValueError('Full inventory checksum mismatch')
        if (receipt.get('sourceCommit') != expected_commit or
            receipt.get('sourceFingerprint') != identity.get('sourceFingerprint') or
            receipt.get('artifactType') != 'server.js' or
            receipt.get('artifactSha256') != identity.get('serverSha256') or
            digest(original.read('server.js')) != identity.get('serverSha256')):
            raise ValueError('Server receipt mismatch')
        if b'browser_public' in original.read('server.js'):
            raise ValueError('Server contains legacy frontend path; inspect before migration')
        kept = {n:h for n,h in files.items() if not n.startswith('browser_public/')}
        inventory.update(files=kept, frontendLayout='canonical-public-v1')
        raw = encode(inventory)
        identity.update(frontendLayout='canonical-public-v1', stagedInventorySha256=digest(raw),
                        candidateOnly=True, productionCertified=False)
        replacements = {'SBC-STAGED-INVENTORY.json':raw,'SBC-FLAT-RELEASE-IDENTITY.json':encode(identity)}
        with zipfile.ZipFile(destination,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as out:
            for n in sorted(names):
                if n.startswith('browser_public/'):
                    continue
                info=zipfile.ZipInfo(n,(1980,1,1,0,0,0))
                info.create_system=3
                info.external_attr=original.getinfo(n).external_attr
                out.writestr(info,replacements[n] if n in replacements else original.read(n),compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    return {'sourceCommit':expected_commit,'candidateOnly':True,'productionCertified':False,
            'cleanDirectoryRequired':True,'mirrorPairs':proof['mirrorPairs'],
            'removedEntries':proof['baselineFullEntries']-proof['projectedFullEntries'],
            'removedBytes':proof['removedMirrorBytes']+proof['legacyBrowserOnlyBytes'],
            'sourceZipSha256':proof['sourceZipSha256'],'candidateZipSha256':digest(destination.read_bytes()),
            'baselineZipBytes':source.stat().st_size,'candidateZipBytes':destination.stat().st_size}


if __name__ == '__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('source',type=pathlib.Path)
    p.add_argument('destination',type=pathlib.Path)
    p.add_argument('--expected-commit',required=True)
    args=p.parse_args()
    print(json.dumps(build(args.source,args.destination,args.expected_commit),indent=2))
