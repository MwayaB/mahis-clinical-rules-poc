# Clinical rules pipeline proof of concept

**Every clinical value, drug code, band, pregnancy statement, message, source excerpt, diagnosis, patient and reviewer identity in the examples is a placeholder, not clinical guidance.** Each example source IR node is marked `"placeholder": true`. The source checksums are placeholder zero hashes, not attestations of real documents. This repository demonstrates software behavior; it is not validated for clinical use.

## Run

Requires Node **22 or later with working `node:sqlite`**. No npm dependencies or installation step. SQLite is experimental in some Node 22 versions. Check first:

```sh
node --version
node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; console.log(typeof DatabaseSync)'
npm test
bash scripts/demo.sh
```

On the development machine the default Node was v18.12.1. All successful tests and demo runs explicitly selected installed v22.18.0:

```sh
export PATH=/Users/Mwaya/.nvm/versions/node/v22.18.0/bin:$PATH
```

Use the equivalent Node selection on another machine. No SQLite substitute is used. `demo.sh` checks the runtime, generates or retains development keys, compiles the placeholder dose IR, registers a placeholder child, records 12 kg and 2 tablets (warning), then records 10 kg and 1 tablet (no advice). It asserts both outcomes, prints ordered events from SQLite, and removes its temporary database and package. Generated private keys remain under ignored `keys/` with mode 0600.

Compile either example independently:

```sh
node scripts/gen_dev_key.js
node scripts/compile.js --ir ir/dose_band_example.ir.json \
  --fixtures fixtures/dose_band_example.fixtures.json \
  --key keys/dev-private.pem --out packages/package-poc-0.1.0
```

For the contraindication example use its matching IR and fixture file and a different output directory. Compilation refuses an existing output directory. For another release, pass `--version poc-0.1.1` and a new directory.

CLI commands take `--db FILE --patient-id ID` plus the following arguments:

| Command | Arguments |
| --- | --- |
| `register` | `--name "PLACEHOLDER person" --sex U` |
| `observe` | `--field weight_kg --value 12` (optional `--supersedes EVENT_ID`) |
| `status` | `--field pregnant --value false` (optional `--supersedes EVENT_ID`) |
| `diagnose` | `--icd10 B50.9 --label "PLACEHOLDER diagnosis"` (optional `--certainty suspected` or `confirmed`) |
| `prescribe` | `--atc P01BF01 --tablets 2 --package DIR --pubkey FILE` |
| `respond` | `--advice-ref EVENT_ID --action accepted` or `overridden --reason "..."` |
| `events` | no additional arguments; prints ordered SQLite rows as JSON |

`prescribe` prints the evaluation and stored event details. Exit codes are 0 for successful evaluation including warnings, 2 for block advice, and 1 for an operational error. Block advice still records the prescription. Omitted ATC/tablets remain null and produce visible missing-input advice where applicable.

## Pipeline and APIs

1. `canonicalStringify` sorts object keys recursively, preserves array order, uses JSON number encoding and rejects non-JSON values.
2. `validateIR` accumulates errors with node IDs, checks provenance, reviewers, enums and exact schemas. Drafts validate structurally but compilation refuses them.
3. `compile(ir, {dir, privateKey, fixtures, packageVersion})` strips reviewer/source text metadata, runs fixtures through the actual evaluator, hashes canonical rules, signs canonical manifest bytes with Ed25519, and publishes a complete directory by rename.
4. `verifyPackage(dir, publicKeyPaths)` verifies exact manifest bytes before parsing the manifest, then validates its schema and verifies rules bytes before parsing any rules. `applyPackage(dir, {trustedPublicKeys, engineVersion})` additionally validates rules and compatibility and returns a deeply frozen package. Failure returns no loaded state. There is no global active package to partially replace.
5. `evaluate(loadedPackage, ctx)` is pure: no clock, I/O, randomness or ambient configuration; it imports only `canonical.js`. Hashing is isolated in that module. Advice is sorted by severity and rule ID, with message as a deterministic tie-break for multiple missing fields.
6. `openEventLog(path)` returns `append`, `listForPatient`, `transaction` and `close`. Standalone `append(db,event)` and `listForPatient(db,patientId,options)` wrappers are also exported. Payloads are canonical JSON, all appends validate, and SQL triggers reject updates/deletes. IDs and timestamps come from callers.
7. `buildContext(events, {today})` returns a deeply frozen context with null defaults and per-field `recorded_at` timestamps. `workflow.js` accepts explicit database, today, timestamps and event IDs. Only `cli.js` reads the wall clock; it also supplies UUIDs.

`prescribe(args)` verifies the package before opening a transaction. Inside the transaction it appends a candidate draft, builds its projected context, evaluates, and appends `advice-shown`. Failure rolls back both writes. Other workflow exports are `register`, `observe`, `status`, `diagnose`, `respond` and `replay`.

## Decisions

- **Coverage endpoints:** `coverage` means `[min,max)`, matching the example's excluded upper endpoint. Require exact coverage, including the lower endpoint and excluding the upper endpoint. Adjacent bands may use either complementary inclusion arrangement; double inclusion is overlap and double exclusion is a gap. Bands outside coverage are refused. IR does not provide endpoint flags for coverage itself; an inclusive maximum cannot be represented in this PoC.
- **Supported fields and units:** tables accept `weight_kg` and integer, nonnegative `tablet` values. Predicates accept only the five specified context fields and non-null scalar equality values of the matching type. Unknown context condition fields are refused. No expression interpreter, clinical content generation or inferred clinical rules.
- **Missing prescription:** no proposed ATC yields a synthetic `input-proposed_atc` warning with `context:proposed_atc` source reference. This warning identifies missing context rather than a clinical rule. Missing tablet count yields a warning per applicable table. Both missing weight and tablet count produce their own advice. No ATC match produces no clinical advice. A missing predicate field warns even when another equality mismatches.
- **Dose discrepancy severity:** the table schema provides no mismatch severity; use `warn`. Missing-input and no-band severities follow the declared enums. Out-of-band and uncovered inputs produce visible advice.
- **Fixture gate:** positive means the rule ID is actually emitted; negative means it is absent. Require at least one of each with the rule's ATC and all of that rule's required inputs present. Missing-input cases and unrelated drugs cannot establish this coverage. Expectations must exactly match actual emitted IDs, order-independent. No external fixture dependency is embedded in a signed runtime package. At least two fixtures per rule are sufficient; removing either of the two shipped fixtures fails compilation and names the affected rule. Removing a redundant fixture would not necessarily fail.
- **Placeholders:** both source IRs mark every clinical node as a placeholder; compilation propagates the package flag, and evaluation returns it. Reviewer IDs and provenance are structurally validated, not independently authenticated. Real source documents were not supplied, so checksum truth cannot be verified.
- **Canonicalization:** only finite JSON values and plain objects are allowed; reject cycles, sparse arrays, extended arrays, undefined, functions, symbols as keys, and non-plain objects. Arrays preserve supplied ordering; object key ordering is canonical. Identical IR, fixtures, signing key and version give identical package bytes.
- **Signing and application:** caller supplies PEM public-key file paths; trust any matching Ed25519 key. No hard-coded keys. Signed manifest and rule schemas reject unknown fields. Semver is numeric `major.minor.patch` only. The implemented engine is `0.1.0`; a caller cannot label it as a future engine. Applying is construction of an immutable value, not a filesystem installation or mutable registry swap.
- **Compilation publication:** use a sibling staging directory followed by rename; refuse an existing final or staging directory rather than overwrite. A stale staging directory needs manual removal. This PoC does not claim crash durability/fsync guarantees.
- **Correction semantics:** seq order determines the latest value, irrespective of `occurred_at`; that timestamp is retained for each input. Every superseded target in the selected history remains retired, including correction chains. Only earlier events of the same patient, event type and field may be superseded. Forward references and cross-patient corrections are rejected. Re-evaluate a cutoff using only supersessions present at that cutoff.
- **Prescription context:** evaluation includes the newly drafted prescription; older proposals cannot supply a missing value for the new proposal. Draft and advice are one SQLite transaction, including block cases. Registration is required for workflow writes. Direct event-log append supports importing valid events without that workflow prerequisite.
- **Replay audit extensions:** the specified advice payload lacks sufficient details to pin the exact package or compare rendered advice. Add `today`, `context_up_to_seq`, `rules_sha256`, `manifest_sha256` and full `advice`. The cutoff is the last patient event before advice (the new draft); unrelated patients' intervening seq values do not matter. Replay uses recorded today, exact verified package fingerprint and cutoff, then checks the input hash and full advice. Later observations/corrections cannot alter replay. The caller must retain and supply the historical signed package and trusted key; there is no package archive service.
- **Event values:** accept UTC ISO timestamps with seconds and optional three-digit milliseconds. Validate calendar dates without reading a clock. Sex is `F`, `M` or `U`; diagnosis certainty defaults explicitly to `suspected` and also permits `confirmed`. Override responses require a nonempty reason; advice responses must reference the same patient's advice event. These are structural workflow conventions, not clinical interpretations.
- **Test boundary change:** move the shared edge from 15 to 14 on both adjacent bands, keeping coverage valid. Compare advice rather than result metadata between package versions. Only weights in `[14,15)` change, including the new edge and excluding the old edge. Generated boundary cases derive expectations from declared interval membership and exercise both complementary inclusion arrangements.

## Validation and limits

Built and committed in the required working order: canonical JSON; IR validation; compiler; package verification; evaluator; events/context; CLI/workflow/replay; scripts/documentation. The complete suite was run after every part. The final suite and demonstration results are recorded in `VALIDATION.md`.

No requested implementation requirement is intentionally left unmet. Qualification: inclusive maximum coverage is not expressible under the documented conservative convention; source provenance cannot be authenticated without real source documents; replay requires retained historical packages. No production clinical validation, deployment, sync, network service, UI, LLM, FHIR support or additional rule node types is included.
