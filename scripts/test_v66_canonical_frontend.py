import hashlib
import json
import pathlib
import tempfile
import unittest
import zipfile
from v66_canonical_frontend import project

def digest(data):
    return hashlib.sha256(data).hexdigest()

class CanonicalFrontendTest(unittest.TestCase):
    def fixture(self, directory, changes=None, corrupt=False):
        files = {'public/index.html': b'<script src="/app.js"></script>',
                 'public/app.js': b'console.log("ok")',
                 'browser_public/index.html': b'<script src="/app.js"></script>',
                 'browser_public/app.js': b'console.log("ok")',
                 'browser_public/kim-os-v326.js': b'old',
                 'server.js': b'private backend'}
        files.update(changes or {})
        inventory = json.dumps({'schema': 1, 'sourceCommit': 'a'*40,
            'files': {k: digest(v) for k,v in files.items()}}).encode()
        identity = json.dumps({'sourceCommit':'a'*40,'stagedInventorySha256':digest(inventory)}).encode()
        path = directory / 'full.zip'
        if corrupt:
            files['public/app.js'] = b'tampered'
        with zipfile.ZipFile(path,'w') as z:
            for k,v in files.items():
                z.writestr(k,v)
            z.writestr('SBC-STAGED-INVENTORY.json',inventory)
            z.writestr('SBC-FLAT-RELEASE-IDENTITY.json',identity)
        return path

    def test_projection_preserves_canonical_bytes_and_excludes_backend(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = pathlib.Path(tmp)
            source = self.fixture(root)
            before = digest(source.read_bytes())
            report = project(source, root/'proof.zip')
            self.assertEqual(report['mirrorPairs'],2)
            self.assertEqual(report['legacyBrowserOnly'],['browser_public/kim-os-v326.js'])
            self.assertFalse(report['deployable'])
            with zipfile.ZipFile(root/'proof.zip') as z:
                self.assertEqual(sorted(z.namelist()),['CANONICAL-FRONTEND-PROOF.json','public/app.js','public/index.html'])
                self.assertEqual(z.read('public/app.js'),b'console.log("ok")')
            project(source,root/'repeat.zip')
            self.assertEqual((root/'proof.zip').read_bytes(),(root/'repeat.zip').read_bytes())
            self.assertEqual(digest(source.read_bytes()),before)

    def test_rejects_drift_tamper_unknown_legacy_and_path_traversal(self):
        cases = [({'browser_public/app.js':b'wrong'},False),
                 ({},True),({'browser_public/unknown.js':b'unknown'},False),
                 ({'public/../escape.js':b'bad'},False),
                 ({'public/index.html':b'<script src="/kim-os-v326.js"></script>',
                   'browser_public/index.html':b'<script src="/kim-os-v326.js"></script>'},False)]
        for changes,corrupt in cases:
            with self.subTest(changes=changes,corrupt=corrupt), tempfile.TemporaryDirectory() as tmp:
                root=pathlib.Path(tmp)
                with self.assertRaises(ValueError):
                    project(self.fixture(root,changes,corrupt),root/'proof.zip')
                self.assertFalse((root/'proof.zip').exists())

if __name__ == '__main__':
    unittest.main()
