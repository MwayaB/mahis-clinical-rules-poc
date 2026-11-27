**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# CLI

`npm run demo` is the demonstration entry point; its implementation is `scripts/prototype-demo.sh`. It refuses an occupied port, seeds an immutable release and leaves the loopback server running. The printed PID identifies the process to stop. See the [README](../README.md) for setup and URLs.

`npm start` runs an empty server. Advanced invocation: `node src/cli.js serve --port 8080 --data data/session --keys keys`. Only loopback host binding is allowed.

## Event commands

`node src/cli.js <command> --db <path> --patient-id <id>` supports:

| Command | Additional flags |
| --- | --- |
| register | `--name --sex` and optional `--age-years` |
| observe | `--field --value` and optional `--supersedes` |
| status | `--field --value` and optional `--supersedes` |
| diagnose | `--icd10 --label` and optional `--certainty` |
| prescribe | `--package --pubkey` and optional `--atc --tablets` |
| respond | `--advice-ref --action` and optional `--reason` (required by override) |
| events | none |

The standalone prescribing command is a compatibility wrapper. Use generic encounter assessment routes for all types. CLI identifiers are caller-supplied placeholder identities; the CLI supplies timestamps and event UUIDs.

## Compilation and keys

`node scripts/compile.js --ir <file> --fixtures <file> --review-events <file> --key <private.pem> --out <directory> [--version <poc-X.Y.Z>]` requires exported review ledger rows. IR approval metadata cannot substitute for the ledger. The HTTP review/release workflow maintains that ledger automatically.

`node scripts/gen_dev_key.js` generates local development keys. Package verification is exposed by `applyPackage` in `src/package.js` and the HTTP release workflow. Keys must be retained consistently for historical packages.

## Exit codes

Success is 0. Argument, input, verification or gate failure is 1. A prescribing result containing block advice uses 2 while retaining recorded events; warning advice uses 0. The shell demo exits nonzero on a failed assertion or curl request. No advice result can be interpreted as clinical validation.
