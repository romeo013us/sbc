#!/usr/bin/env python3
"""Small deterministic release ZIP tests; never interact with real customer data."""
import hashlib
import os
from pathlib import Path
import tempfile
import unittest
import sys
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import zipfile

from scripts.v66_deterministic_zip import create_reproducible_zip


class ReproducibleV66ZipTest(unittest.TestCase):
    def test_same_bytes_despite_mtime_and_input_order(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "nested").mkdir()
            (root / "nested" / "run.sh").write_bytes(b"#!/bin/sh\necho safe\n")
            (root / "nested" / "run.sh").chmod(0o755)
            (root / "app.js").write_bytes(b"const ready=true;\n")
            files = [Path("nested/run.sh"), Path("app.js")]
            extra = {"SBC-STAGED-INVENTORY.json": b'{"schema":1}\n'}
            first = root / "first.zip"
            second = root / "second.zip"
            create_reproducible_zip(first, root, files, extra)
            os.utime(root / "app.js", (1000000000, 1000000000))
            os.utime(root / "nested" / "run.sh", (1950000000, 1950000000))
            create_reproducible_zip(second, root, list(reversed(files)), extra)
            self.assertEqual(first.read_bytes(), second.read_bytes())
            with zipfile.ZipFile(first) as archive:
                self.assertEqual(archive.namelist(), ["SBC-STAGED-INVENTORY.json", "app.js", "nested/run.sh"])
                self.assertEqual(archive.testzip(), None)
                for entry in archive.infolist():
                    self.assertEqual(entry.date_time, (1980, 1, 1, 0, 0, 0))
                    self.assertEqual(entry.extra, b"")
                    self.assertEqual(entry.comment, b"")
                self.assertEqual(archive.read("app.js"), b"const ready=true;\n")
                self.assertTrue(archive.getinfo("nested/run.sh").external_attr >> 16 & 0o111)
            (root / "app.js").write_bytes(b"const ready=false;\n")
            create_reproducible_zip(root / "changed.zip", root, files, extra)
            self.assertNotEqual(first.read_bytes(), (root / "changed.zip").read_bytes())

    def test_refuse_duplicate_and_unsafe_entries(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "safe.js").write_text("ok")
            with self.assertRaisesRegex(ValueError, "duplicate"):
                create_reproducible_zip(root / "dup.zip", root, [Path("safe.js"), Path("safe.js")], {})
            with self.assertRaisesRegex(ValueError, "unsafe"):
                create_reproducible_zip(root / "escape.zip", root, [Path("../escape.js")], {})
            with self.assertRaisesRegex(ValueError, "duplicate"):
                create_reproducible_zip(root / "manifest.zip", root, [Path("safe.js")], {"safe.js": b"tamper"})

    def test_refuse_symlinks(self):
        with tempfile.TemporaryDirectory() as folder:
            root = Path(folder)
            (root / "target.txt").write_text("safe")
            (root / "shortcut.txt").symlink_to(root / "target.txt")
            with self.assertRaisesRegex(ValueError, "symlink"):
                create_reproducible_zip(root / "link.zip", root, [Path("shortcut.txt")], {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
