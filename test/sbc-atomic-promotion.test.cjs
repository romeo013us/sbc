'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const script=path.resolve(__dirname,'../scripts/promote-sealed-master.sh');
function fixture(t){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sbc-atomic-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
 const run=(cmd,args)=>spawnSync(cmd,args,{cwd:dir,encoding:'utf8'});
 const git=(...args)=>{const r=run('git',args);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
 git('init','-q','-b','a-sbc-master');git('config','user.name','SBC test');git('config','user.email','fixture@example.invalid');
 const remote=path.join(dir,'..',path.basename(dir)+'.git');t.after(()=>fs.rmSync(remote,{recursive:true,force:true}));
 git('init','-q','--bare',remote);git('remote','add','origin',remote);
 fs.mkdirSync(path.join(dir,'scripts'));
 // Fixture verifier models a separate evidence gate; actual release verification has its own tests.
 fs.writeFileSync(path.join(dir,'scripts/verify-release-sync.cjs'),"const fs=require('node:fs');if(fs.readFileSync('seal','utf8')!==process.argv[3])process.exit(1);\n");
 git('add','.');git('commit','-qm','base');const base=git('rev-parse','HEAD');git('push','origin','a-sbc-master');
 git('switch','-qc','candidate');git('commit','--allow-empty','-qm','reviewed source');const source=git('rev-parse','HEAD');
 fs.writeFileSync(path.join(dir,'seal'),source);git('add','seal');git('commit','-qm','sealed');const sealed=git('rev-parse','HEAD');
 git('push','origin',sealed+':refs/heads/release/verified-godaddy-'+source);
 return {dir,git,base,source,sealed,master:()=>git('--git-dir='+remote,'rev-parse','refs/heads/a-sbc-master'),promote:(b=base,s=source)=>run('bash',[script,b,s])};
}
test('one promotion exposes only the sealed descendant on master',t=>{const f=fixture(t);assert.equal(f.master(),f.base);const r=f.promote();assert.equal(r.status,0,r.stderr);assert.equal(f.master(),f.sealed);});
test('stale base cannot overwrite a newer remote master',t=>{const f=fixture(t);f.git('switch','a-sbc-master');f.git('commit','--allow-empty','-qm','concurrent work');const newer=f.git('rev-parse','HEAD');f.git('push','origin','a-sbc-master');f.git('switch','candidate');assert.notEqual(f.promote().status,0);assert.equal(f.master(),newer);});
test('dirty tree, bad source pin and absent recovery ref cannot promote',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.dir,'seal'),'invalid');assert.notEqual(f.promote().status,0);f.git('restore','seal');assert.notEqual(f.promote(f.base,f.base).status,0);f.git('push','origin',':refs/heads/release/verified-godaddy-'+f.source);assert.notEqual(f.promote().status,0);assert.equal(f.master(),f.base);});
test('invalid committed seal and divergent base cannot promote',t=>{const f=fixture(t);fs.writeFileSync(path.join(f.dir,'seal'),'bad');f.git('commit','--amend','-qam','bad seal');const bad=f.git('rev-parse','HEAD');f.git('push','--force','origin',bad+':refs/heads/release/verified-godaddy-'+f.source);assert.notEqual(f.promote().status,0);f.git('reset','--hard',f.sealed);assert.notEqual(f.promote(f.sealed,f.source).status,0);assert.equal(f.master(),f.base);});

test('Academy generation never pushes raw media to the GoDaddy branch; candidate dispatch seals without promotion',()=>{
 const root=path.resolve(__dirname,'..');
 const media=fs.readFileSync(path.join(root,'.github/workflows/sbc-academy360-auto-media.yml'),'utf8');
 const staged=fs.readFileSync(path.join(root,'.github/workflows/sbc-v6606-staged-release.yml'),'utf8');
 assert.doesNotMatch(media,/git push[^\n]*:a-sbc-master\b/);
 assert.match(media,/refs\/heads\/release\/candidate\/academy-/);
 assert.match(media,/--force-with-lease="\$candidate_ref:"/);
 assert.match(media,/gh workflow run sbc-v6606-staged-release\.yml --ref "\$candidate_branch"/);
 assert.match(staged,/startsWith\(github\.ref, 'refs\/heads\/release\/candidate\/'\)/);
 const pin=staged.indexOf('bash scripts/pin-verified-godaddy-ref.sh "$GITHUB_SHA"');
 const candidate=staged.indexOf('if [[ "$GITHUB_REF" == refs/heads/release/candidate/* ]]',pin);
 const masterPush=staged.indexOf('git push origin "HEAD:refs/heads/$BRANCH"',pin);
 assert.ok(pin>=0&&candidate>pin&&masterPush>candidate);
 assert.match(staged.slice(candidate,masterPush),/exit 0/);
});
