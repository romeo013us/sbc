'use strict';
/* V66.101 — Deny-by-default API perimeter for the independent SBC caller desk.
   A UI-only menu restriction does not protect CRM, orders or company financials. */
const GET=new Set(['/api/me','/api/sales-caller/workspace','/api/v9/time/status','/api/training','/api/voice/status','/api/voice/token']);
const POST=new Set(['/api/v9/time/clock','/api/training/progress','/api/voice/log','/api/v9/call-report','/api/logout']);
const pathOnly=v=>String(v||'').split('?')[0].replace(/\/+$/,'')||'/';
function allowed(method,path){const p=pathOnly(path),m=String(method||'').toUpperCase();
 if(m==='GET')return GET.has(p)||/^\/api\/training\/courses\/[A-Za-z0-9_-]{1,120}$/.test(p);
 if(m==='POST')return POST.has(p);
 return false;
}
function ownerShellPath(path){const p=pathOnly(path);return p==='/'||p==='/index.html'||/^\/(?:sbc-v\d+(?:\.\d+)?|command-center-v\d+(?:\.\d+)?|cc-v\d+(?:\.\d+)?)$/i.test(p);}
function suppressed(c){return Boolean(c?.doNotContact===true||c?.salesSuppressed===true||c?.isSuppressed===true||['do not call','dnc','opt out','do not contact','unsubscribe'].includes(String(c?.status||'').trim().toLowerCase()));}
module.exports={allowed,ownerShellPath,suppressed,pathOnly};
