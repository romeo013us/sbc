#!/usr/bin/env bash
# Disposable, off-provider readonly boot against an empty MySQL database.
# No published ports, shared production volumes, provider keys or runtime internet.
set -euo pipefail
root=$(cd "$(dirname "$0")/.." && pwd)
artifact=$(realpath "$1")
expected_commit="$2"
expected_inventory="$3"
[[ "$expected_commit" =~ ^[0-9a-f]{40}$ && "$expected_inventory" =~ ^[0-9a-f]{64}$ ]] || { echo 'Independent release pins required' >&2; exit 1; }
scratch=$(mktemp -d)
name="sbc-portable-$(node -p "require('crypto').randomBytes(8).toString('hex')")"
cleanup(){
 docker rm -f "$name-app" "$name-db" >/dev/null 2>&1 || true
 docker network rm "$name-net" >/dev/null 2>&1 || true
 docker volume rm "$name-dbdata" "$name-state" >/dev/null 2>&1 || true
 docker image rm "$name-app" >/dev/null 2>&1 || true
 rm -rf "$scratch"
}
trap cleanup EXIT
mkdir "$scratch/runtime"
python3 - "$artifact" "$scratch/runtime" <<'PY'
import pathlib, stat, sys, zipfile
with zipfile.ZipFile(sys.argv[1]) as z:
    seen=set()
    for f in z.infolist():
        p=pathlib.PurePosixPath(f.filename)
        if p.is_absolute() or '..' in p.parts or '\\' in f.filename or stat.S_ISLNK(f.external_attr >> 16) or f.filename in seen:
            raise ValueError('Unsafe or duplicate archive member')
        seen.add(f.filename)
    z.extractall(sys.argv[2])
PY
node "$root/scripts/sbc-portable-runtime-proof.cjs" "$scratch/runtime" "$expected_commit" "$expected_inventory"
cat > "$scratch/Dockerfile" <<'DOCKER'
FROM node:22-bookworm-slim
WORKDIR /opt/sbc
COPY runtime/ ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund
CMD ["node","sbc-godaddy-flat-entrypoint.cjs"]
DOCKER
# Only public base images and npm dependencies are fetched, before the runtime starts.
docker pull mysql:8.0
docker build --tag "$name-app" "$scratch"
docker network create --internal "$name-net" >/dev/null
docker volume create "$name-dbdata" >/dev/null
docker volume create "$name-state" >/dev/null
dbpass=$(node -p "require('crypto').randomBytes(24).toString('hex')")
readonlypass=$(node -p "require('crypto').randomBytes(24).toString('hex')")
sessionsecret=$(node -p "require('crypto').randomBytes(48).toString('hex')")
docker run -d --name "$name-db" --network "$name-net" --network-alias db \
 --mount "type=volume,source=$name-dbdata,target=/var/lib/mysql" \
 -e MYSQL_ROOT_PASSWORD="$dbpass" -e MYSQL_DATABASE=sbc_portable_ci mysql:8.0 >/dev/null
ready=0
for ((i=0;i<90;i++)); do
 if docker exec -e MYSQL_PWD="$dbpass" "$name-db" mysql -uroot -h127.0.0.1 -Nse 'SELECT 1' >/dev/null 2>&1; then ready=1;break;fi
 sleep 2
done
[[ "$ready" == 1 ]] || { echo 'Disposable MySQL failed to initialize' >&2; exit 1; }
docker exec -e MYSQL_PWD="$dbpass" "$name-db" mysql -uroot -e \
 "CREATE USER 'sbc_reader'@'%' IDENTIFIED BY '$readonlypass'; GRANT SELECT ON sbc_portable_ci.* TO 'sbc_reader'@'%';"
docker exec -e MYSQL_PWD="$readonlypass" "$name-db" mysql -usbc_reader -h127.0.0.1 sbc_portable_ci -Nse 'SELECT DATABASE()' | grep -Fxq sbc_portable_ci
if docker exec -e MYSQL_PWD="$readonlypass" "$name-db" mysql -usbc_reader -h127.0.0.1 sbc_portable_ci -e 'CREATE TABLE forbidden_write(id INT)' >/dev/null 2>&1; then
 echo 'Readonly MySQL account unexpectedly has DDL access' >&2;exit 1
fi
export SBC_SESSION_SECRET=$sessionsecret DB_PASSWORD=$readonlypass
docker run -d --name "$name-app" --network "$name-net" \
 --mount "type=volume,source=$name-state,target=/private-state" \
 -e NODE_ENV=production -e PORT=3000 -e SBC_RUNTIME_ROLE=readonly -e ENABLE_DDL=false \
 -e SBC_PERSIST_DIR=/private-state -e SBC_AUTOMATION_ENABLED=false -e SBC_REVENUE_AUTOPILOT_ENABLED=false \
 -e SBC_SESSION_SECRET -e DB_HOST=db -e DB_PORT=3306 \
 -e DB_USER=sbc_reader -e DB_PASSWORD -e DB_NAME=sbc_portable_ci "$name-app" >/dev/null
# Do not confuse an early HTTP listener with evaluated recovery state.
passed=0
for ((i=0;i<90;i++)); do
 if docker exec "$name-app" node -e 'fetch("http://127.0.0.1:3000/api/health",{signal:AbortSignal.timeout(3000)}).then(async r=>{if(!r.ok)throw Error("health");console.log(JSON.stringify(await r.json()))}).catch(()=>process.exit(1))' > "$scratch/health.json" 2>/dev/null; then
  if node "$root/scripts/sbc-portable-health-contract.cjs" empty < "$scratch/health.json" > "$scratch/proof.json" 2>/dev/null; then passed=1;break;fi
 fi
 if [[ "$(docker inspect --format '{{.State.Running}}' "$name-app")" != true ]]; then break;fi
 sleep 2
done
if [[ "$passed" != 1 ]]; then
 echo 'Isolated readonly boot proof failed; inspect sanitized health response' >&2
 node -e 'try{const h=JSON.parse(require("fs").readFileSync(process.argv[1]));console.error(JSON.stringify({database:h.database,storage:h.storage,productionReady:h.productionReady,writerLeaseReady:h.writerLeaseReady,recoveryEvaluated:h.recoveryEvaluated,recoveryRequired:h.recoveryRequired}))}catch{}' "$scratch/health.json"
 exit 1
fi
cat "$scratch/proof.json"
# The readonly application must not have created any database tables.
count=$(docker exec -e MYSQL_PWD="$dbpass" "$name-db" mysql -uroot -Nse "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='sbc_portable_ci'")
[[ "$count" == 0 ]] || { echo 'Unexpected schema mutation' >&2;exit 1; }
echo 'Portable Node 22 / MySQL 8 empty-database readonly acceptance passed; no production certification.'
