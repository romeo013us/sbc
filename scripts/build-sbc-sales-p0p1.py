from pathlib import Path
r=Path(__file__).resolve().parents[1]
# Account Manager global role gate: intentionally narrow allowlist, PUT only appointment ID.
p=r/'enterprise/sbc-account-manager-role-gate-v2.cjs'
s=p.read_text()
a="'/api/website-production/call-desk']),"
b="'/api/website-production/call-desk','/api/appointments','/api/sbc/sales/actions/today','/api/sbc/sales/reminders/preview']),"
assert s.count(a)==1
s=s.replace(a,b)
a=" POST:new Set(['/api/logout','/api/v9/time/clock','/api/training/progress','/api/account-social/v1/posts','/api/sbc/design-briefs'])"
b=" POST:new Set(['/api/logout','/api/v9/time/clock','/api/training/progress','/api/account-social/v1/posts','/api/sbc/design-briefs','/api/appointments']),\n PUT:new Set([])"
assert s.count(a)==1
s=s.replace(a,b)
a="  new RegExp('^/api/sbc/design-briefs/'+VALID_ID+'/(?:revoke|review)$')\n ]\n};"
b="  new RegExp('^/api/sbc/design-briefs/'+VALID_ID+'/(?:revoke|review)$')\n ],\n PUT:[new RegExp('^/api/appointments/'+VALID_ID+'$')]\n};"
assert s.count(a)==1
s=s.replace(a,b)
p.write_text(s)
# Replace three unsafe owner-only endpoints with tested module, preserving DB and recovery gates.
p=r/'server.js'
s=p.read_text()
start=s.index("app.post('/api/appointments',auth,ownerOnly")
end=s.index("\n",s.index("app.delete('/api/appointments/:id'",start))+1
replacement="""// SBC_P0P1_BOOKING_AND_DAILY_REVENUE: assigned account managers book before private site generation.
// The new module reuses authenticated tenant context, writer lease and existing relational persistence.
const SBC_SALES_P0P1 = require('./enterprise/sbc-sales-p0p1.cjs');
SBC_SALES_P0P1.register(app,{auth,requireTenant:requireRequestTenant,db,
 save:()=>saveData(),id,now,
 writerReady:()=>!SBC_RUNTIME_READ_ONLY&&!sbcShutdownStarted&&Boolean(mysqlPool)&&
  MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED&&sbcWriterLeaseReady});
"""
s=s[:start]+replacement+s[end:]
p.write_text(s)
