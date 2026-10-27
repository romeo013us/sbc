$ErrorActionPreference = 'Stop'
Write-Host 'SBC OS V65.1.13 - local dependency lockfile and release verification' -ForegroundColor Cyan
Write-Host 'Run this only in a LOCAL copy of the source package, not inside GoDaddy hosting.'
if (-not (Test-Path '.\package.json')) { throw 'package.json not found. Extract the SBC source ZIP and run this script from its root.' }
$pkg = Get-Content '.\package.json' -Raw | ConvertFrom-Json
if ($pkg.version -ne '65.1.13') { throw "Expected package version 65.1.13, found $($pkg.version). Stop and confirm the source archive." }
if (Test-Path '.\package-lock.json') { Write-Host 'Existing package-lock.json found; it will be refreshed by npm.' }
Write-Host '[1/4] Generate lockfile using the npm registry...'
npm install --package-lock-only --ignore-scripts --audit=false --fund=false
if ($LASTEXITCODE -ne 0) { throw 'Lockfile generation failed. Check registry/network access; do not create a placeholder lockfile.' }
if (-not (Test-Path '.\package-lock.json')) { throw 'npm did not create package-lock.json.' }
Write-Host '[2/4] Verify clean dependency installation with npm ci...'
npm ci --ignore-scripts --no-audit --no-fund
if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; the lockfile is not ready for release.' }
Write-Host '[3/4] Run full automated tests...'
npm run test:all
if ($LASTEXITCODE -ne 0) { throw 'Automated tests failed. Do not deploy.' }
Write-Host '[4/4] Run deployment gate...'
npm run predeploy:open-gate
if ($LASTEXITCODE -ne 0) { throw 'Predeployment gate failed. Do not deploy.' }
$hash = (Get-FileHash '.\package-lock.json' -Algorithm SHA256).Hash.ToLower()
Write-Host "LOCKFILE SHA-256: $hash" -ForegroundColor Green
Write-Host 'All local release gates passed. Re-zip the project root, then submit the resulting ZIP for final review before deployment.' -ForegroundColor Green
