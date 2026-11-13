"""Deterministic, safety-checked SBC V66 staging ZIP writer (CI-only, no customer data).
Sorts members, normalizes timestamps/permissions and rejects unsafe or duplicate entries.
The release identity/inventory remain the authority for content integrity at runtime.
"""
from pathlib import Path, PurePosixPath
import stat
import zipfile

FIXED_TIME = (1980, 1, 1, 0, 0, 0)


def _safe_name(name):
    raw = str(name)
    if not raw or "\\" in raw or raw.startswith("/") or "\x00" in raw:
        raise ValueError("unsafe ZIP member path: " + repr(raw))
    parts = raw.split("/")
    if any(p in ("", ".", "..") for p in parts) or ":" in parts[0]:
        raise ValueError("unsafe ZIP member path: " + repr(raw))
    return PurePosixPath(*parts).as_posix()


def create_reproducible_zip(destination, root, files, extra_files=None):
    """Write bytes from repo-root-relative files and explicit in-memory members.

    Host mtimes, ZIP member insertion order, local timezone, and umask cannot
    alter archive bytes. Executable mode is retained, all other mode bits normalized.
    """
    root = Path(root).resolve()
    destination = Path(destination)
    members = {}
    for file in files:
        name = _safe_name(file)
        if name in members:
            raise ValueError("duplicate ZIP member: " + name)
        source = root.joinpath(*PurePosixPath(name).parts)
        if source.is_symlink() or any(parent.is_symlink() for parent in source.parents if parent != root and root in parent.parents):
            raise ValueError("symlink ZIP member is forbidden: " + name)
        if not source.is_file():
            raise ValueError("missing or irregular ZIP source: " + name)
        mode = 0o755 if source.stat().st_mode & 0o111 else 0o644
        members[name] = (source.read_bytes(), mode)
    for key, data in (extra_files or {}).items():
        name = _safe_name(key)
        if name in members:
            raise ValueError("duplicate ZIP member: " + name)
        if not isinstance(data, bytes):
            raise TypeError("extra ZIP member must be bytes: " + name)
        members[name] = (data, 0o644)
    destination.parent.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED, compresslevel=8) as archive:
        for name in sorted(members):
            data, mode = members[name]
            info = zipfile.ZipInfo(name, date_time=FIXED_TIME)
            info.compress_type = zipfile.ZIP_DEFLATED
            info.create_system = 3
            info.external_attr = ((stat.S_IFREG | mode) << 16)
            info.extra = b""
            info.comment = b""
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=8)
    return destination
