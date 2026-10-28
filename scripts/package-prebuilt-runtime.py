#!/usr/bin/env python3
"""Package only verified compiled application bytes; do not bundle runtime data."""
import os, sys, zipfile, pathlib, stat, hashlib, json
src=pathlib.Path(sys.argv[1]).resolve()
archive=pathlib.Path(sys.argv[2]).resolve()
if not (src/'server.js').is_file() or not (src/'public/index.html').is_file():
    raise SystemExit('REFUSE: missing compiled runtime files')
# Pinned, non-customer catalogs read by top-level modules during server startup.
# Everything else in data/ stays excluded (customer records, audit logs, secrets).
CATALOGS = {
 'data/v433-edge-suite.json': ('0a656d1acd2b58eb7fe72d0c7354ca30c692206b40905f389cad2c09b3f9df7e','items'),
 'data/v434-resilience-suite.json': ('6db1b8ab64eacb3f56a8b3380468dd073fe7930576ccb61b06485b41aead671b','items'),
 'data/v434-brand-intelligence.json': ('5dd3bb9e912d01d0355a43f2579eaa9a28fd859ba092b6a736c80e97a7732488','items'),
 'data/v4341-kim-resilience-control.json': ('283821af395ff26e6f012d87586e72850f9fb6731e7cca6797570e13301bb2e1','items'),
 'data/kim-greatness-100.json': ('c9494969197a5549ccc8f85ca7516bca5967e256b4c4231e5b946b69a92ff108','capabilities'),
}

written=0
total=0
with zipfile.ZipFile(archive,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=7,allowZip64=False) as z:
    for base,dirs,files in os.walk(src,followlinks=False):
        base=pathlib.Path(base)
        relative=base.relative_to(src)
        dirs[:]=sorted(d for d in dirs if d not in ('node_modules','backups','__pycache__') and not d.startswith('.sbc-') and not (str(relative)=='.' and d=='data'))
        for name in sorted(files):
            p=base/name
            rel=p.relative_to(src)
            if name.startswith('.env') or name in ('.sbc-bootstrap-ready.json','.sbc-prebuilt-ready.json'):
                continue
            # Never ship prospect datasets in public/browser or in a server archive.
            if name.lower().endswith('.csv'):
                continue
            s=p.lstat()
            if not stat.S_ISREG(s.st_mode):
                raise SystemExit('REFUSE: nonregular release file '+str(rel))
            written+=1
            total+=s.st_size
            if written>6000 or total>256*1024*1024:
                raise SystemExit('REFUSE: compiled runtime exceeds safety budget')
            z.write(p,rel.as_posix())
    # Include ONLY checksum-pinned, immutable catalogs. Never ship live data.
    for rel,(expected_sha,field) in sorted(CATALOGS.items()):
        p=src/rel
        try:s=p.lstat()
        except FileNotFoundError:raise SystemExit('REFUSE: missing required startup catalog '+rel)
        if not stat.S_ISREG(s.st_mode) or s.st_size>128*1024:
            raise SystemExit('REFUSE: invalid catalog '+rel)
        payload=p.read_bytes()
        if hashlib.sha256(payload).hexdigest()!=expected_sha:
            raise SystemExit('REFUSE: catalog differs from reviewed baseline '+rel)
        try:parsed=json.loads(payload)
        except (UnicodeDecodeError,ValueError):raise SystemExit('REFUSE: malformed catalog '+rel)
        if not isinstance(parsed,dict) or not isinstance(parsed.get(field),list) or not parsed[field]:
            raise SystemExit('REFUSE: invalid catalog structure '+rel)
        written+=1
        total+=len(payload)
        if written>6000 or total>256*1024*1024:
            raise SystemExit('REFUSE: compiled runtime exceeds safety budget')
        z.writestr(rel,payload,compress_type=zipfile.ZIP_DEFLATED)
if written<300:
    raise SystemExit('REFUSE: incomplete compiled runtime '+str(written))
print('PREBUILT_ARCHIVE_FILES',written,'UNCOMPRESSED_BYTES',total,'PINNED_PUBLIC_CATALOGS',len(CATALOGS))
