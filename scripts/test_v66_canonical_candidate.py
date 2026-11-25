import json
import pathlib
import tempfile
import unittest
import zipfile
from v66_canonical_frontend import digest
from v66_canonical_candidate import build

COMMIT='a'*40
def fixture(root, mismatch=False):
    server=b"console.log('canonical')"
    files={'public/index.html':b'<script src="/app.js"></script>',
           'public/app.js':b'console.log("ok")',
           'browser_public/index.html':b'<script src="/app.js"></script>',
           'browser_public/app.js':b'console.log("ok")',
           'browser_public/kim-os-v326.js':b'old',
           'server.js':server,'package.json':b'{}'}
    identity={'schema':1,'sourceCommit':COMMIT,'sourceFingerprint':'b'*64,
              'serverSha256':digest(server),'productionCertified':True}
    receipt={'sourceCommit':COMMIT,'sourceFingerprint':identity['sourceFingerprint'],
             'artifactType':'server.js','artifactSha256':digest(server)}
    files['SBC-DEPLOY-RECEIPT.json']=json.dumps(receipt).encode()
    inv=json.dumps({'schema':1,'sourceCommit':COMMIT,'files':{n:digest(v) for n,v in files.items()}}).encode()
    identity['stagedInventorySha256']=digest(inv)
    files.update({'SBC-STAGED-INVENTORY.json':inv,
                  'SBC-FLAT-RELEASE-IDENTITY.json':json.dumps(identity).encode(),
                  '.airo/config.json':b'{}','package-lock.json':b'{}'})
    if mismatch: files['package.json']=b'tampered'
    source=root/'source.zip'
    with zipfile.ZipFile(source,'w') as z:
        for n,v in files.items():z.writestr(n,v)
    return source

class CandidateTest(unittest.TestCase):
    def test_full_candidate_deterministic_and_nonproduction(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp)
            source=fixture(root)
            first,second=root/'first.zip',root/'second.zip'
            report=build(source,first,COMMIT)
            build(source,second,COMMIT)
            self.assertEqual(first.read_bytes(),second.read_bytes())
            self.assertEqual(report['removedEntries'],3)
            self.assertTrue(report['cleanDirectoryRequired'])
            with zipfile.ZipFile(first) as z:
                self.assertFalse(any(n.startswith('browser_public/') for n in z.namelist()))
                raw=z.read('SBC-STAGED-INVENTORY.json')
                identity=json.loads(z.read('SBC-FLAT-RELEASE-IDENTITY.json'))
                self.assertEqual(identity['frontendLayout'],'canonical-public-v1')
                self.assertEqual(identity['stagedInventorySha256'],digest(raw))
                self.assertTrue(identity['candidateOnly'])
                self.assertFalse(identity['productionCertified'])
                for n,h in json.loads(raw)['files'].items():self.assertEqual(digest(z.read(n)),h)
                self.assertEqual(digest(z.read('server.js')),identity['serverSha256'])
    def test_wrong_source_and_backend_tamper_refused(self):
        for mismatch,commit in [(False,'c'*40),(True,COMMIT)]:
            with tempfile.TemporaryDirectory() as tmp:
                root=pathlib.Path(tmp)
                output=root/'candidate.zip'
                with self.assertRaises(ValueError):build(fixture(root,mismatch),output,commit)
                self.assertFalse(output.exists())
if __name__=='__main__':unittest.main()
