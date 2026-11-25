"""Non-deployable, reproducible frontend projection from an attested staging ZIP."""
import argparse
import hashlib
import json
import pathlib
import stat
import zipfile

LEGACY = {'browser_public/kim-os-v326.css', 'browser_public/kim-os-v326.js'}
TEXT_EXT = {'.html','.js','.css','.mjs','.json','.webmanifest','.svg'}

def digest(data):
    return hashlib.sha256(data).hexdigest()

def project(source, destination):
    source, destination = pathlib.Path(source), pathlib.Path(destination)
    if destination.exists() or source.resolve() == destination.resolve():
        raise ValueError('Destination must be a new file')
    with zipfile.ZipFile(source) as original:
        names = original.namelist()
        if len(names) != len(set(names)):
            raise ValueError('Duplicate ZIP members')
        for entry in original.infolist():
            name = entry.filename
            if (entry.is_dir() or '\\' in name or name.startswith('/') or
                any(part in ('','.','..') for part in name.split('/')) or
                stat.S_ISLNK(entry.external_attr >> 16)):
                raise ValueError('Unsafe ZIP member: '+name)
        identity = json.loads(original.read('SBC-FLAT-RELEASE-IDENTITY.json'))
        raw = original.read('SBC-STAGED-INVENTORY.json')
        inventory = json.loads(raw)
        if (digest(raw) != identity.get('stagedInventorySha256') or
            inventory.get('schema') != 1 or
            inventory.get('sourceCommit') != identity.get('sourceCommit')):
            raise ValueError('Inventory identity mismatch')
        files = inventory['files']
        public = {n for n in names if n.startswith('public/')}
        mirror = {n for n in names if n.startswith('browser_public/')}
        if not {'public/index.html','public/app.js'} <= public:
            raise ValueError('Missing canonical entrypoints')
        if public | mirror != {n for n in files if n.startswith(('public/','browser_public/'))}:
            raise ValueError('Frontend inventory and ZIP differ')
        data = {}
        for n in sorted(public | mirror):
            content = original.read(n)
            if digest(content) != files[n]:
                raise ValueError('Asset checksum mismatch: '+n)
            data[n] = content
        duplicates, legacy = [], []
        for n in sorted(mirror):
            canonical = 'public/'+n.removeprefix('browser_public/')
            if canonical in public:
                if data[n] != data[canonical]:
                    raise ValueError('Mirror drift: '+n)
                duplicates.append(n)
            elif n in LEGACY:
                legacy.append(n)
            else:
                raise ValueError('Unknown browser-only asset: '+n)
        if not duplicates:
            raise ValueError('No mirrored assets to verify')
        for n in sorted(public):
            if pathlib.PurePosixPath(n).suffix.lower() in TEXT_EXT:
                if any(x.rsplit('/',1)[-1].encode() in data[n] for x in legacy):
                    raise ValueError('Legacy-only asset referenced by canonical frontend: '+n)
        removed = sum(len(data[n]) for n in duplicates)
        legacy_bytes = sum(len(data[n]) for n in legacy)
        baseline = sum(i.file_size for i in original.infolist())
        report = {'schema':1,'deployable':False,
                  'purpose':'Frontend verification only; no server or deployment identity',
                  'sourceCommit':identity['sourceCommit'],
                  'sourceZipSha256':digest(source.read_bytes()),
                  'sourceInventorySha256':digest(raw),
                  'mirrorPairs':len(duplicates),'removedMirrorBytes':removed,
                  'legacyBrowserOnly':legacy,'legacyBrowserOnlyBytes':legacy_bytes,
                  'canonicalFileCount':len(public),
                  'canonicalBytes':sum(len(data[n]) for n in public),
                  'baselineFullEntries':len(names),'baselineFullBytes':baseline,
                  'projectedFullEntries':len(names)-len(mirror),
                  'projectedFullBytes':baseline-removed-legacy_bytes,
                  'canonicalSha256':{n:files[n] for n in sorted(public)}}
        payload = {n:data[n] for n in public}
        payload['CANONICAL-FRONTEND-PROOF.json'] = (json.dumps(report,sort_keys=True,indent=2)+'\n').encode()
        with zipfile.ZipFile(destination,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as out:
            for n in sorted(payload):
                info=zipfile.ZipInfo(n,(1980,1,1,0,0,0))
                info.create_system=3
                info.external_attr=0o100644<<16
                out.writestr(info,payload[n],compress_type=zipfile.ZIP_DEFLATED,compresslevel=9)
    return report

if __name__ == '__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source',type=pathlib.Path)
    parser.add_argument('destination',type=pathlib.Path)
    args=parser.parse_args()
    report=project(args.source,args.destination)
    print(json.dumps({k:v for k,v in report.items() if k!='canonicalSha256'},indent=2))
