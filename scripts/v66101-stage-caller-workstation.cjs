'use strict';
/* Disposable GoDaddy stage transform only; DO NOT patch a deployed writer's server. */
const fs=require('node:fs'),path=require('node:path');
const MARK='SBC_V66101_CALLER_FAIL_CLOSED';
function replaceOnce(s,oldText,newText,label){const matches=s.split(oldText).length-1;if(matches!==1)throw Error('V66101_ANCHOR_'+label+'_'+matches);return s.replace(oldText,newText);}
function patchServer(input){let s=String(input||'');if(s.includes(MARK))return s;
 s=replaceOnce(s,'async function auth(req,res,next){',
 "// "+MARK+": deny-by-default employee API and independent staff shell\nconst SBC_V66101_CALLER_POLICY=require('./enterprise/v66101-caller-access.cjs');\nasync function auth(req,res,next){",'auth-load');
 s=replaceOnce(s,
 "if(u.role==='manager'||u.role==='sales_manager')return res.status(403).json({error:'This legacy management role is no longer an active SBC workforce position. Sign in again after the account role is corrected.'});",
 "if(u.role==='manager'||u.role==='sales_manager')return res.status(403).json({error:'This legacy management role is no longer an active SBC workforce position. Sign in again after the account role is corrected.'});"+
 "if(u.role==='caller'&&(u.active===false||!SBC_V66101_CALLER_POLICY.allowed(req.method,req.path))){res.setHeader('Cache-Control','no-store');return res.status(403).json({ok:false,error:'CALLER_WORKSPACE_ONLY',message:'Sales callers only have access to their assigned workstation services.'});}",
 'caller-rbac');
 const statics="app.use(express.static(path.join(__dirname,'public'),{dotfiles:'ignore',setHeaders:";
 const routing="// No caller or researcher is ever served the owner Command Center shell.\napp.use(async(req,res,next)=>{\n if(req.method!=='GET'||!SBC_V66101_CALLER_POLICY.ownerShellPath(req.path))return next();\n let u=null;try{u=await sessionUser(req)}catch(e){return next()}\n if(u?.role==='caller')return res.redirect(302,'/sales-caller.html');\n if(u?.role==='lead_researcher')return res.redirect(302,'/lead-research.html');\n return next();\n});\n";
 s=replaceOnce(s,statics,routing+statics,'static-route');
 const voice="const manualTo=manualDial?normalizeDialNumber(b.to):'';";
 const guard="if(req.user.role==='caller'&&(manualDial||!customer||String(customer.assignedTo||'')!==String(req.user.id)||Number(customer.tenantId??customer.tenant_id)!==Number(tenantId)||SBC_V66101_CALLER_POLICY.suppressed(customer)))return res.status(403).json({ok:false,error:'CALLER_ASSIGNED_LEAD_REQUIRED'});";
 s=replaceOnce(s,voice,guard+voice,'voice-log');
 return s;
}
if(require.main===module){const file=path.resolve(__dirname,'../server.js'),s=fs.readFileSync(file,'utf8'),next=patchServer(s);if(process.argv.includes('--apply')){if(process.env.SBC_V66101_ISOLATED_STAGE!=='YES')throw Error('V66101_STAGE_ONLY');fs.writeFileSync(file,next);console.log('[V66.101] Caller route isolation staged; default deny for all other API endpoints.');}else console.log('[V66.101] Anchors compatible; no mutation.');}
module.exports={MARK,patchServer};
