'use strict';
const fs=require('fs');
const path=require('path');
const VERSION='45.2.0';
const BUILD_VERSION='45.3.8';
const TRACK={
  activeVersion:VERSION,
  snapshot:'Pre-production Team Launch Snapshot',
  primaryAppThread:'server.js',
  runtimeWorker:'enterprise/v452-runtime-worker.js',
  stealthBuild:'scripts/obfuscate-production.js',
  perimeter:'enterprise/v440-founder-fortress-wow.js',
  telemetry:'scripts/v451-god-tier-telemetry-test.js',
  healthMonitor:'scripts/v452-operations-hardening-test.js'
};
function exists(root,file){return fs.existsSync(path.join(root,file));}
function inspect(root=path.resolve(__dirname,'..')){
  const checks={
    primaryThread:exists(root,TRACK.primaryAppThread),
    runtimeWorker:exists(root,TRACK.runtimeWorker),
    stealthBuild:exists(root,TRACK.stealthBuild),
    founderFortress:exists(root,TRACK.perimeter),
    telemetryTest:exists(root,TRACK.telemetry),
    operationsHardeningTest:exists(root,TRACK.healthMonitor)
  };
  return {ok:Object.values(checks).every(Boolean),track:TRACK,buildVersion:BUILD_VERSION,checks};
}
function summary(root){return inspect(root)}
module.exports={VERSION,BUILD_VERSION,TRACK,inspect,summary};
