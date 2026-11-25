import json
import pathlib
import tempfile
import unittest
import zipfile
from v66_canonical_frontend import digest
from v66_lean_runtime import build, select

class LeanTest(unittest.TestCase):
    def fixture(self,root):
        files={'server.js':b"require('./scripts/runtime-check.cjs')",
          'scripts/runtime-check.cjs':b"require('./needed-test')",
          'scripts/needed-test.js':b"require('../test/helpers/needed')",
          'test/helpers/needed.cjs':b"module.exports=1",
          'scripts/unused-test.js':b"unused",
          'test/unreferenced.test.cjs':b"unused",
          'public/index.html':b"<html></html>",
          'package.json':json.dumps({'scripts':{'start':'node server.js','backup:mysql':'node scripts/mysql-backup.js','test:unused':'node scripts/unused-test.js','verify:ops':'npm run test:ops','test:ops':'node scripts/ops-test.js'}}).encode(),
          'scripts/mysql-backup.js':b"backup",
          'scripts/ops-test.js':b"ops"}
        commit='a'*40
        receipt={'sourceCommit':commit,'sourceFingerprint':'b'*64,'artifactType':'server.js','artifactSha256':digest(files['server.js'])}
        files['SBC-DEPLOY-RECEIPT.json']=json.dumps(receipt).encode()
        inv=json.dumps({'schema':1,'sourceCommit':commit,'frontendLayout':'canonical-public-v1','files':{n:digest(v) for n,v in files.items()}}).encode()
        files.update({'SBC-STAGED-INVENTORY.json':inv,'SBC-FLAT-RELEASE-IDENTITY.json':json.dumps({'schema':1,'sourceCommit':commit,'sourceFingerprint':'b'*64,'serverSha256':receipt['artifactSha256'],'frontendLayout':'canonical-public-v1','candidateOnly':True,'productionCertified':False,'stagedInventorySha256':digest(inv)}).encode(),'.airo/config.json':b'{}','package-lock.json':b'{}'})
        src=root/'canonical.zip'
        with zipfile.ZipFile(src,'w') as z:
            for n,v in files.items():z.writestr(n,v)
        return src
    def test_runtime_dependencies_and_npm_aliases_preserved(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);src=self.fixture(root);a=root/'a.zip';b=root/'b.zip'
            result=build(src,a,'a'*40);build(src,b,'a'*40)
            self.assertEqual(a.read_bytes(),b.read_bytes())
            self.assertEqual(result['removedEntries'],2)
            with zipfile.ZipFile(a) as z:
                self.assertNotIn('scripts/unused-test.js',z.namelist())
                self.assertNotIn('test/unreferenced.test.cjs',z.namelist())
                for n in ['scripts/needed-test.js','test/helpers/needed.cjs','scripts/ops-test.js','scripts/mysql-backup.js']:
                    self.assertIn(n,z.namelist())
                pkg=json.loads(z.read('package.json'))
                self.assertNotIn('test:unused',pkg['scripts'])
                self.assertIn('test:ops',pkg['scripts'])
                raw=z.read('SBC-STAGED-INVENTORY.json')
                identity=json.loads(z.read('SBC-FLAT-RELEASE-IDENTITY.json'))
                self.assertEqual(identity['stagedInventorySha256'],digest(raw))
                self.assertFalse(identity['productionCertified'])
                self.assertEqual(identity['runtimeProfile'],'lean-preview-v1')
                for n,h in json.loads(raw)['files'].items():self.assertEqual(digest(z.read(n)),h)
    def test_wrong_source_and_tamper_refused(self):
        with tempfile.TemporaryDirectory() as tmp:
            root=pathlib.Path(tmp);src=self.fixture(root);out=root/'bad.zip'
            with self.assertRaises(ValueError):build(src,out,'c'*40)
            self.assertFalse(out.exists())
            with zipfile.ZipFile(src,'a') as z:z.writestr('unexpected.txt','tampered')
            with self.assertRaises(ValueError):build(src,out,'a'*40)
            self.assertFalse(out.exists())
if __name__=='__main__':unittest.main()
