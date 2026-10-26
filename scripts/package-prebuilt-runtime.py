#!/usr/bin/env python3
"""Package only verified compiled application bytes; do not bundle runtime data."""
import os, sys, zipfile, pathlib, stat
src=pathlib.Path(sys.argv[1]).resolve()
archive=pathlib.Path(sys.argv[2]).resolve()
if not (src/'server.js').is_file() or not (src/'public/index.html').is_file():
    raise SystemExit('REFUSE: missing compiled runtime files')
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
            s=p.lstat()
            if not stat.S_ISREG(s.st_mode):
                raise SystemExit('REFUSE: nonregular release file '+str(rel))
            written+=1
            total+=s.st_size
            if written>6000 or total>256*1024*1024:
                raise SystemExit('REFUSE: compiled runtime exceeds safety budget')
            z.write(p,rel.as_posix())
if written<300:
    raise SystemExit('REFUSE: incomplete compiled runtime '+str(written))
print('PREBUILT_ARCHIVE_FILES',written,'UNCOMPRESSED_BYTES',total)
