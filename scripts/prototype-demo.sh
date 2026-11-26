#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --input-type=module -e 'import {DatabaseSync} from "node:sqlite"; if(Number(process.versions.node.split(".")[0])<22) throw Error("Node >=22 required"); const db=new DatabaseSync(":memory:");db.close();'
command -v curl >/dev/null || { echo 'curl is required for this API demo.' >&2; exit 1; }
data_dir="${PROTOTYPE_DATA_DIR:-$PWD/data/prototype-demo}"
mkdir -p "$data_dir"
# Refuse an occupied port before starting or mutating any service.
if curl --silent --max-time 1 http://127.0.0.1:8080/api/guidelines >/dev/null; then
 echo 'Port 8080 is already in use. Stop that server before running this script; no existing service was changed.' >&2
 exit 1
fi
nohup node src/cli.js serve --port 8080 --data "$data_dir" > "$data_dir/server.log" 2>&1 < /dev/null &
server_pid=$!
printf '%s\n' "$server_pid" > "$data_dir/server.pid"
trap 'kill "$server_pid" 2>/dev/null || true' ERR
ready=false
for attempt in {1..60}; do
 if ! kill -0 "$server_pid" 2>/dev/null; then cat "$data_dir/server.log" >&2; exit 1; fi
 if curl --silent --fail http://127.0.0.1:8080/api/guidelines >/dev/null; then ready=true; break; fi
 sleep 0.1
done
if [[ "$ready" != true ]]; then echo 'Server did not become ready.' >&2; kill "$server_pid"; exit 1; fi
node scripts/prototype-flow.js
trap - ERR
echo "Server remains running on 127.0.0.1:8080 (PID $server_pid)."
echo 'Upload: http://127.0.0.1:8080/guidelines.html'
echo 'EMR: http://127.0.0.1:8080/emr.html'
echo "To stop: kill $server_pid"
if [[ "${PROTOTYPE_NO_OPEN:-0}" != 1 ]]; then
 if command -v open >/dev/null; then open http://127.0.0.1:8080/emr.html || true
 elif command -v xdg-open >/dev/null; then xdg-open http://127.0.0.1:8080/emr.html >/dev/null 2>&1 || true
 fi
fi
