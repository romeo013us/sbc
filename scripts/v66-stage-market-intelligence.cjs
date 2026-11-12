'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const MARK = 'SBC_MARKET_INTELLIGENCE';

// These replacements run on the disposable release checkout before the existing
// pipeline hashes server.js and publishes the compiled runtime.
function patchServer(source) {
  if (source.includes(MARK)) return source;
  const replacements = [
    [
    "const SBC_V6660_BRIDGE=require('./enterprise/v6660-website-bridge.cjs');",
    [
      "const SBC_V6660_BRIDGE=require('./enterprise/v6660-website-bridge.cjs');",
      "const SBC_SEARCH_CONSOLE=require('./enterprise/sbc-search-console.cjs');"
    ].join('\n')
    ],
    [
    "async function loadVaultSecrets(){if(!mysqlPool)return;try{const [rows]=await mysqlPool.query('SELECT secret_name,secret_ciphertext FROM sbc_secret_vault WHERE tenant_id=?',[TENANT_DEFAULT_ID]);for(const r of rows){try{secretCache.set(r.secret_name,decryptVault(r.secret_ciphertext))}catch(e){console.warn('[SBC VAULT] decrypt failed for',r.secret_name)}}}catch(e){console.warn('[SBC VAULT] load:',e.message)}}",
    "async function loadVaultSecrets(){if(!mysqlPool)return;try{const [rows]=await mysqlPool.query('SELECT secret_name,secret_ciphertext FROM sbc_secret_vault WHERE tenant_id=? AND secret_name <> ?',[TENANT_DEFAULT_ID,SBC_SEARCH_CONSOLE.CREDENTIAL]);for(const r of rows){try{secretCache.set(r.secret_name,decryptVault(r.secret_ciphertext))}catch(e){console.warn('[SBC VAULT] decrypt failed for',r.secret_name)}}}catch(e){console.warn('[SBC VAULT] load:',e.message)}}"
    ],
    [
    "function addActivity(type,message,meta={}){db.activities.unshift({id:id('act'),type,message,meta,createdAt:now()});db.activities=db.activities.slice(0,200)}",
    "function addActivity(type,message,meta={}){const entry={id:id('act'),type,message,meta,createdAt:now()};db.activities.unshift(entry);db.activities=db.activities.slice(0,200);return entry;}"
    ],
    [
    "function ownerOnly(req,res,next){if(req.user?.role!=='owner')return res.status(403).json({error:'Owner access required.'});next()}",
    [
      "function ownerOnly(req,res,next){if(req.user?.role!=='owner')return res.status(403).json({error:'Owner access required.'});next()}",
      "",
      "function sbcMarketSiteTenant(tenantId){",
      "  try{",
      "    const site=V569_PRODUCTION_EXPANSION.tenantFromHost(new URL(SBC_SEARCH_CONSOLE.PROPERTY).hostname);",
      "    return site.ok && site.tenantId===tenantId;",
      "  }catch{return false;}",
      "}"
    ].join('\n')
    ],
    [
    "function normalizeWebLeadBody(b){return {businessName:String(b.businessName||b.company||b.business||'').trim().slice(0,180),contactName:String(b.contactName||b.name||'').trim().slice(0,140),phone:String(b.phone||'').trim().slice(0,40),email:String(b.email||'').trim().toLowerCase().slice(0,180),website:String(b.website||'').trim().slice(0,300),address:String(b.address||'').trim().slice(0,300),city:String(b.city||'').trim().slice(0,100),region:String(b.region||b.state||'').trim().slice(0,100),zip:String(b.zip||b.postalCode||'').trim().slice(0,30),industry:String(b.industry||b.category||'').trim().slice(0,120),serviceInterest:String(b.serviceInterest||b.service||b.interest||'').trim().slice(0,160),quoteType:String(b.quoteType||'').trim().slice(0,120),quantity:String(b.quantity||'').trim().slice(0,80),message:String(b.message||b.notes||'').trim().slice(0,3000),sourcePage:String(b.sourcePage||b.page||'').trim().slice(0,300)}}",
    [
      "function normalizeWebLeadBody(b){return {businessName:String(b.businessName||b.company||b.business||'').trim().slice(0,180),contactName:String(b.contactName||b.name||'').trim().slice(0,140),phone:String(b.phone||'').trim().slice(0,40),email:String(b.email||'').trim().toLowerCase().slice(0,180),website:String(b.website||'').trim().slice(0,300),address:String(b.address||'').trim().slice(0,300),city:String(b.city||'').trim().slice(0,100),region:String(b.region||b.state||'').trim().slice(0,100),zip:String(b.zip||b.postalCode||'').trim().slice(0,30),industry:String(b.industry||b.category||'').trim().slice(0,120),serviceInterest:String(b.serviceInterest||b.service||b.interest||'').trim().slice(0,160),quoteType:String(b.quoteType||'').trim().slice(0,120),quantity:String(b.quantity||'').trim().slice(0,80),message:String(b.message||b.notes||'').trim().slice(0,3000),sourcePage:String(b.sourcePage||b.page||'').trim().slice(0,300)}}",
      "async function confirmWebsiteInquiry(tenantId,customerId,activityId){",
      "  try{",
      "    await saveData();",
      "    const [rows]=await mysqlPool.query({timeout:4000,sql:`",
      "      SELECT a.id FROM sbc_activities a",
      "      JOIN sbc_customers c ON c.tenant_id=a.tenant_id AND c.id=?",
      "      WHERE a.tenant_id=? AND a.id=? AND a.activity_type='web_lead' AND c.status<>'Deleted' LIMIT 1`",
      "    },[customerId,tenantId,activityId]);",
      "    return rows.length===1;",
      "  }catch{return false;}",
      "}"
    ].join('\n')
    ],
    [
    "app.use('/api', apiRateLimiter);",
    [
      "app.use('/api', apiRateLimiter);",
      "/* SBC_MARKET_INTELLIGENCE */",
      "require('./enterprise/sbc-market-intelligence.cjs').register(app,{",
      "  auth,ownerOnly,requireTenant:requireRequestTenant,isSiteTenant:sbcMarketSiteTenant,",
      "  getPool:()=>MYSQL_RECOVERY_EVALUATED&&!MYSQL_RECOVERY_REQUIRED?mysqlPool:null,",
      "  readSearchCredential:tenantId=>mysqlPool?vaultSecret(SBC_SEARCH_CONSOLE.CREDENTIAL,tenantId):''",
      "});"
    ].join('\n')
    ],
    [
    "  if(!c0.phone && !c0.email) return res.status(400).json({error:'Please provide a phone number or email address.'});",
    [
      "  if(!c0.phone && !c0.email) return res.status(400).json({error:'Please provide a phone number or email address.'});",
      "  if(SBC_RUNTIME_READ_ONLY||sbcShutdownStarted||!mysqlPool||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady)",
      "    return res.status(503).json({ok:false,code:'WEBSITE_INQUIRY_WRITER_UNAVAILABLE'});"
    ].join('\n')
    ],
    [
    [
      "    addActivity('web_lead',`Website inquiry pending verification for ${c.businessName||c.contactName}`,{customerId:c.id,sourcePage:c0.sourcePage,duplicate:true,contactChanged:false});",
      "    await saveData();"
    ].join('\n'),
    [
      "    const activity=addActivity('web_lead',`Website inquiry pending verification for ${c.businessName||c.contactName}`,{customerId:c.id,sourcePage:c0.sourcePage,duplicate:true,contactChanged:false});",
      "    if(!await confirmWebsiteInquiry(tenantId,c.id,activity.id))return res.status(503).json({ok:false,code:'WEBSITE_INQUIRY_UNCONFIRMED'});"
    ].join('\n')
    ],
    [
    [
      "  addActivity('web_lead',`New SBCMIA inquiry requires verification: ${c.businessName||c.contactName}`,{customerId:c.id,sourcePage:c0.sourcePage,qualified:false});",
      "  await saveData();"
    ].join('\n'),
    [
      "  const activity=addActivity('web_lead',`New SBCMIA inquiry requires verification: ${c.businessName||c.contactName}`,{customerId:c.id,sourcePage:c0.sourcePage,qualified:false});",
      "  if(!await confirmWebsiteInquiry(tenantId,c.id,activity.id))return res.status(503).json({ok:false,code:'WEBSITE_INQUIRY_UNCONFIRMED'});"
    ].join('\n')
    ],
    [
    [
      "const PROVIDER_VAULT_ALLOWED=new Set([",
      "  'GODADDY_PAT',"
    ].join('\n'),
    [
      "const PROVIDER_VAULT_ALLOWED=new Set([",
      "  'GODADDY_PAT',",
      "  SBC_SEARCH_CONSOLE.CREDENTIAL,"
    ].join('\n')
    ],
    [
    "  if(!mysqlPool)return res.status(503).json({error:'MySQL is required for the persistent vault.'});",
    [
      "  if(!mysqlPool)return res.status(503).json({error:'MySQL is required for the persistent vault.'});",
      "  if(name===SBC_SEARCH_CONSOLE.CREDENTIAL){",
      "    if(!sbcMarketSiteTenant(requireRequestTenant(req)))return res.status(403).json({error:'The sbcmia.com property belongs to a different tenant.'});",
      "    if(SBC_RUNTIME_READ_ONLY||sbcShutdownStarted||!MYSQL_RECOVERY_EVALUATED||MYSQL_RECOVERY_REQUIRED||!sbcWriterLeaseReady)",
      "      return res.status(503).json({error:'Connect Search Console from the Published writer once MySQL is ready.'});",
      "    try{SBC_SEARCH_CONSOLE.parseCredential(value);}",
      "    catch{return res.status(400).json({error:'Choose a valid Google service account JSON key.'});}",
      "  }"
    ].join('\n')
    ],
    [
    [
      "    await mysqlPool.query(`INSERT INTO sbc_secret_vault(id,tenant_id,secret_name,secret_ciphertext,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE secret_ciphertext=VALUES(secret_ciphertext),updated_at=UTC_TIMESTAMP()`,[id('vault'),req.tenantId,name,ciphertext]);",
      "    secretCache.set(name,value);"
    ].join('\n'),
    [
      "    await mysqlPool.query(`INSERT INTO sbc_secret_vault(id,tenant_id,secret_name,secret_ciphertext,created_at,updated_at) VALUES (?,?,?,?,UTC_TIMESTAMP(),UTC_TIMESTAMP()) ON DUPLICATE KEY UPDATE secret_ciphertext=VALUES(secret_ciphertext),updated_at=UTC_TIMESTAMP()`,[id('vault'),req.tenantId,name,ciphertext]);",
      "    if(name!==SBC_SEARCH_CONSOLE.CREDENTIAL)secretCache.set(name,value);"
    ].join('\n')
    ],
    [
    "  }catch(e){res.status(503).json({ok:false,error:`Provider Credential Vault unavailable: ${e.message}`})}",
    [
      "  }catch(e){",
      "    if(name===SBC_SEARCH_CONSOLE.CREDENTIAL)return res.status(503).json({ok:false,error:'Search Console credential save could not be confirmed.'});",
      "    res.status(503).json({ok:false,error:`Provider Credential Vault unavailable: ${e.message}`});",
      "  }"
    ].join('\n')
    ],
  ];
  for (const [before, after] of replacements) {
    assert.equal(source.split(before).length - 1, 1, 'Unique Market Intelligence stage anchor required: ' + before.split('\n')[0].slice(0, 100));
    source = source.replace(before, () => after);
  }
  assert(source.includes(MARK));
  return source;
}

if (require.main === module) {
  const file = path.resolve(__dirname, '../server.js');
  const source = fs.readFileSync(file, 'utf8');
  const staged = patchServer(source);
  if (process.argv.includes('--apply')) {
    assert.equal(process.env.SBC_ISOLATED_MARKET_INTELLIGENCE_STAGE, 'YES', 'Disposable stage required');
    if (source !== staged) fs.writeFileSync(file, staged);
  }
  console.log('SBC Market Intelligence runtime stage verified');
}

module.exports = { MARK, patchServer };
