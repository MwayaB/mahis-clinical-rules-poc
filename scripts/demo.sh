#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; if(Number(process.versions.node.split(".")[0])<22) throw Error("Node >=22 required"); const db=new DatabaseSync(":memory:"); db.close();'
echo 'PLACEHOLDER SOFTWARE DEMO — all examples are not clinical guidance.'
node scripts/gen_dev_key.js
run_dir=$(mktemp -d "${TMPDIR:-/tmp}/clinical-rules-demo.XXXXXX")
trap 'rm -rf "$run_dir"' EXIT
node scripts/compile.js --ir ir/dose_band_example.ir.json --fixtures fixtures/dose_band_example.fixtures.json --key keys/dev-private.pem --out "$run_dir/package-poc-0.1.0"
node src/cli.js register --db "$run_dir/demo.db" --patient-id PLACEHOLDER-P1 --name 'PLACEHOLDER child' --sex U
node src/cli.js observe --db "$run_dir/demo.db" --patient-id PLACEHOLDER-P1 --field weight_kg --value 12
node src/cli.js prescribe --db "$run_dir/demo.db" --patient-id PLACEHOLDER-P1 --atc P01BF01 --tablets 2 --package "$run_dir/package-poc-0.1.0" --pubkey keys/dev-public.pem > "$run_dir/first.json"
cat "$run_dir/first.json"
node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; const r=JSON.parse(readFileSync(process.argv[1])); assert.equal(r.result.advice.length,1); assert.equal(r.result.advice[0].severity,"warn");' "$run_dir/first.json"
node src/cli.js observe --db "$run_dir/demo.db" --patient-id PLACEHOLDER-P1 --field weight_kg --value 10
node src/cli.js prescribe --db "$run_dir/demo.db" --patient-id PLACEHOLDER-P1 --atc P01BF01 --tablets 1 --package "$run_dir/package-poc-0.1.0" --pubkey keys/dev-public.pem > "$run_dir/second.json"
cat "$run_dir/second.json"
node --input-type=module -e 'import {readFileSync} from "node:fs"; import assert from "node:assert/strict"; assert.deepEqual(JSON.parse(readFileSync(process.argv[1])).result.advice,[]);' "$run_dir/second.json"
echo 'Events table (ordered JSON rows from SQLite):'
node src/cli.js events --db "$run_dir/demo.db" --patient-id PLACEHOLDER-P1
echo 'Demo assertions passed: 12 kg / 2 tablets warns; 10 kg / 1 tablet has no advice. All values are placeholders.'
