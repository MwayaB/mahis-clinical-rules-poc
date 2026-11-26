# End-to-end local clinical rules prototype

**Every clinical value, patient, drug code, diagnosis label and expected clinical outcome is a PLACEHOLDER, NOT CLINICAL GUIDANCE.** Digitisation is a mock; uploaded PDFs are stored and hashed, never read or interpreted. This is a local demonstration with no authentication or clinical validation.

## Start the prototype

Use Node >=22 with built-in `node:sqlite`, plus `curl` for the demo. There are no npm dependencies, frameworks or build tools.

```sh
# On the development machine, select the verified Node installation:
export PATH=/Users/Mwaya/.nvm/versions/node/v22.18.0/bin:$PATH
npm test
bash scripts/prototype-demo.sh
```

The script starts the server, uploads the shipped sample, sets metadata, loads the mock blocks, drafts, approves with two distinct reviewer IDs, saves authored fixtures, releases `poc-demo-0.1.0`, records coded diagnoses and prescriptions, asserts warning/no-advice/block outcomes, verifies replay and prints each API result. All network steps use curl. It opens the EMR page when an OS browser opener exists, prints both URLs and leaves the server running:

- Upload/library: [http://127.0.0.1:8080/guidelines.html](http://127.0.0.1:8080/guidelines.html)
- EMR: [http://127.0.0.1:8080/emr.html](http://127.0.0.1:8080/emr.html)

The printed PID and `data/prototype-demo/server.pid` identify the process to stop. The demo refuses an occupied port; stop that service before rerunning. Rerunning on the same data retains the existing append-only release and adds new placeholder patients. Use `PROTOTYPE_DATA_DIR=/absolute/path` for an isolated data directory, and `PROTOTYPE_NO_OPEN=1` to suppress OS browser opening.

For an empty workspace without a seeded release:

```sh
npm start
# Optional: node src/cli.js serve --port 8080 --data data/my-session
```

Only `127.0.0.1` binding is accepted. Use the exact printed IP URL; Host and Origin checks refuse cross-origin requests. SQLite may print its Node 22 experimental warning.

## UI walkthrough

1. **Upload:** choose **Upload sample PDF**, or select `samples/dose-guide/placeholder.pdf` with the file picker. Set a document ID and edition. The source table shows metadata status and SHA-256. Select **Inspect blocks**.
2. **Digitise:** select **Run mock digitisation**. Each source card shows `mock-fixture`, text, table cells, page and bbox. The displayed content is a fixed human-authored fixture, not extracted from the PDF. For other PDFs the error says to use manual entry; expand **Add a manual block** and enter page, bbox, text and table cells.
3. **Draft:** select **Continue to review**, then **Use sample ATC mapping** and **Create drafts**. Alternatively type the ATC codes yourself. Unsupported blocks are shown as unconverted. In each node, inspect the source, edit bands or equality conditions, severity, message and ATC, then **Save edit**. Every save resets approvals and records an immutable revision. Parse errors remain visible and block approval/release.
4. **Approve:** supply one reviewer ID and approve, then supply a second distinct ID and approve. The counter moves from **1 of 2 approvals** to **2 of 2 approvals**. Repeating the same ID does not count again. Rejection needs a reason and resets approvals. Reviewer IDs are plain strings, not authenticated people.
5. **Fixtures:** expand **Authored fixtures**, choose **Load sample fixtures**, inspect them, then **Save fixtures** for each node. You can also add/remove/edit individual cases in the form. Blank context fields mean missing inputs; a blank expected-ID field means no advice. Positive/negative authored coverage is required separately from generated boundary fixtures. Editing a node makes saved fixtures stale until explicitly reviewed and saved for its new hash.
6. **Release:** choose a new `poc-demo-X.Y.Z` or `poc-X.Y.Z` version and **Compile, sign & release**. Errors list unapproved nodes, parse errors, missing/stale fixtures or validation failures. Successful releases appear in the EMR dropdown. Existing releases are never overwritten.
7. **EMR dose case:** create/select a placeholder dose patient. Record an ICD-10 code and diagnosis label, then record **12 kg**, select `P01BF01`, **2 tablets** and the release. **Check prescription** returns an amber warning and records the draft/advice. Record **10 kg** and **1 tablet**; the next check returns no advice. **10 kg is weight, not age**. The data model does not record age.
8. **EMR pregnancy case:** use a **separate, explicitly adult placeholder patient**, record a placeholder coded diagnosis and pregnancy status, then check the `J01XX01` sample proposal. The red panel says **Prescription recorded. Guideline advice: …**. No child-labelled patient is used for this case. The pregnancy statement itself remains a placeholder, not a medical recommendation.
9. **Audit and replay:** advice events open with package version, engine version and inputs hash. Raw payloads are an optional disclosure. Select **Replay advice**; it must report a match using that event's exact historical package and predecessor cutoff, irrespective of later observations or corrections.

A diagnosis with a nonempty ICD-10 code and label is required before an EMR prescription check; attempts without one fail before any prescription event is appended. The application does not verify the code against a terminology catalogue or infer whether it is appropriate for the drug. Missing weight, pregnancy or prescription inputs still produce visible rule advice after the workflow prerequisite is satisfied.

## Prototype architecture and storage

`registry.js` handles bounded PDF storage and metadata; `digitiser.js` handles fixed fixtures and immutable manual blocks; `draft.js` builds deterministic draft structure from those human-authored inputs; `review.js` stores revisions and hash-bound decisions; `fixtures.js` gates authored cases plus independently derived boundaries; `release.js` delegates compilation, verification and immutable apply to the original core; `emr.js` delegates clinical writes, evaluation and replay to the original workflow. `server.js` only routes requests, enforces boundaries and serves allowlisted static files. `public/` contains vanilla browser presentation with no clinical rules.

Ignored `data/` holds `prototype.db` (sources, digitisations, current node pointers, append-only review history, fixtures, release records, patient index), `clinical.db` (the original append-only event log), `sources/<sha256>.pdf` and `releases/<version>/`. Development PEMs stay in ignored `keys/`. No private-key or general filesystem route exists.

## API conventions

All JSON mutation bodies use `Content-Type: application/json`. Digitise and replay take `{}`. Upload alone uses raw `application/pdf` bytes, max **25 MiB (26,214,400 bytes)**, with `filename` and `document_id` query parameters. JSON requests are limited to 2 MiB. Unknown fields and query parameters are refused. Errors are `{error: "reason"}`; gate conflicts use 409, missing resources 404, oversized bodies 413 and wrong media types 415. `X-User` defaults to `local-user` and is an audit label only.

| Route | Body / purpose |
| --- | --- |
| `POST /api/guidelines?filename=...&document_id=...` | Raw PDF; returns idempotent source record |
| `GET /api/guidelines`, `GET /api/guidelines/:sha256` | Source registry |
| `POST /api/guidelines/:sha256/metadata` | `{edition}`; required before other stages |
| `POST /api/guidelines/:sha256/digitise` | `{}`; fixed mock fixture lookup |
| `POST /api/guidelines/:sha256/blocks` | Flat `{page,id,kind,bbox,text,cells?}`; manual block |
| `GET /api/guidelines/:sha256/blocks` | Blocks with digitiser labels |
| `POST /api/guidelines/:sha256/draft` | `{atc_by_block:{b1:"...",b2:"..."}}`; explicit drafting action |
| `GET /api/ir?document=:sha256` | Nodes, approvals, sources and unconverted blocks |
| `POST /api/ir/:node_id/edit` | Type-specific editable fields; no source/status/reviewer editing |
| `POST /api/ir/:node_id/approve` | `{reviewer}` |
| `POST /api/ir/:node_id/reject` | `{reviewer,reason}` |
| `GET /api/ir/:node_id/history` | Immutable edit/decision history |
| `POST /api/fixtures` | `{node_id,entries:[{name,ctx,expect}]}` |
| `GET /api/fixtures?node=:id` | Authored cases, stale flag and generated boundaries |
| `POST /api/releases` | `{document_sha256,version}` |
| `GET /api/releases` | Append-only release records |
| `GET /api/patients`, `POST /api/patients` | Create with `{name,sex,patient_id?}` |
| `GET /api/patients/:id/context` | Observation projection with dates/nulls |
| `POST /api/patients/:id/observations` | `{field:"weight_kg",value,supersedes?}` |
| `POST /api/patients/:id/status` | `{field:"pregnant",value,supersedes?}` |
| `GET /api/patients/:id/diagnoses`, `POST /api/patients/:id/diagnoses` | Save `{icd10,label,certainty?}`; list active coded diagnoses |
| `POST /api/patients/:id/prescriptions/check` | `{release_version,atc?,tablets?}`; recorded coded diagnosis required |
| `GET /api/patients/:id/events` | Ordered clinical audit events |
| `POST /api/events/:seq/replay` | `{}`; match against exact historical release |
| `GET /api/sample-bundle` | Shipped sample metadata and authored fixture suggestions |

## Prototype Decisions

- The prompt's ban on generating clinical rules and its required rule-based drafting are interpreted together: code only parses explicitly typed numerical bands and recognises the specified pregnancy prefix; all message templates, units and predicate content come from the existing human-authored placeholder IRs. No new recommendations are invented. The sample mock fixture is deliberately independent of the PDF's disclaimer-only contents.
- Drafts may carry transient `parse_errors` and empty reviewers, so they live in the draft store rather than weakening the approved IR validator. Approval validates a clean candidate with synthetic validation-only reviewer slots; real stored approvals still require two distinct supplied IDs on the actual content hash. Parse errors must first be corrected through an explicit edit.
- Qualified pregnancy text, including “first trimester”, is not silently converted to an all-pregnancy rule. It carries parse errors requiring explicit reviewer editing. The shipped sample uses an unqualified placeholder paragraph. No trimester or age field is added.
- The dose and pregnancy demonstrations use separate patients. The dose patient's numeric value is always labelled kg; pregnancy is shown only on an explicitly adult-labelled placeholder. An early local demo mistakenly reused a child-labelled patient; its status was corrected with a superseding event, preserving history. The shipped script does not reproduce that setup.
- Following user feedback, the EMR service now requires at least one non-superseded coded diagnosis before a prescription check. Its code/label are required, but terminology membership and drug–diagnosis appropriateness are not checked. The original generic CLI workflow remains unchanged so the first-phase acceptance contract is preserved; the new clinical-facing EMR enforces the prerequisite.
- Metadata is set separately after upload. Identical bytes retain the first registry identity; conflicting later editions are refused. Source status remains `metadata-set` while later-stage history is stored separately. Hashes are lowercase 64-character hex; filenames are labels only and never determine disk paths.
- Digitisation is available only after metadata. There is exactly one shipped lookup fixture. Mock reruns return existing mock rows; manual blocks have `digitiser: manual`. Block IDs are immutable within a source; conflicts are refused rather than replaced. Uploaded bytes are never used as code, extracted as text, or served through arbitrary paths.
- Drafting is an explicit additional endpoint because the requested API summary did not name one. Node IDs include the complete source checksum and block ID to avoid collisions. Repeat drafting preserves reviewed nodes. Unconverted blocks conservatively block release; there is no general raw-node editor or reviewed-exclusion flow for unsupported text in this scope.
- Editable table fields include `bands`, `coverage`, `message_template`, `applies_to`; predicate fields are `when`, `severity`, `message`, `applies_to`. Coverage is recomputed from edited band extrema unless supplied explicitly, then the original validator checks intervals. Source provenance, node identity, risk, placeholder flag and approvals cannot be changed by an edit request. A valid explicit edit clears parser errors; invalid edits retain visible validation errors.
- Content hashes exclude mutable status/reviewer lists. Approvals are stored with reviewer, timestamp and exact content hash; reviewer strings are trimmed and otherwise case-sensitive. Duplicate approval is idempotent. Every save, including an identical save, resets approvals and appends an edit event. Reject resets approvals and records a separate append-only reason snapshot. IDs remain audit labels; this is not authentication or proof of independent reviewers.
- Fixtures are bound to the content hash when saved. They may be authored before final approval but become stale after content changes. Positive/negative coverage must come from authored cases; automatically generated boundaries cannot bypass this gate. Boundaries use an independent endpoint-membership/equality oracle and are included in the compiler gate across the complete document. Cross-rule cases must list all expected rule IDs when multiple rules share an ATC.
- Release checks metadata, all approvals, parser errors, unconverted blocks, authored fixtures, boundaries and original IR validation before compilation. It self-verifies signature/checksum and applies the package before writing its append-only record. Release failure removes only the new output it created. A crash may leave an orphan directory; future attempts refuse overwrite. Cross-file crash durability and distributed transactions are not claimed.
- **Original production modules changed:** `compiler.js` and `package.js` only broaden the package-version syntax to also accept the explicitly requested `poc-demo-X.Y.Z`. `cli.js` adds a `serve` branch that supplies a clock callback. `evaluator.js`, `ir.js`, `canonical.js`, `events.js`, `context.js` and `workflow.js` are unchanged. Only `cli.js` reads the clock. New modules accept explicit timestamps or the caller-supplied clock.
- Patients are indexed separately from the event log; registration updates two local stores synchronously and is not a crash-atomic distributed transaction. Each prescription/advice pair retains the original single-database transaction. New prerequisites or invalid requests create no prescription. Block advice records the proposal exactly as before.
- Additional read endpoints for source history, sample suggestions, diagnosis lists and patient context support the UI without placing rules in the browser. Static serving is an exact allowlist, including only the shipped sample PDF. Same-origin checks, strict content types, bounded bodies, safe text-node rendering and CSP limit accidental browser exposure; they are not an authentication system.
- The browser uses semantic forms, associated visible labels, native validation, keyboard focus indicators, explicit missing badges and live error/status feedback. No HTML injection, inline handlers, external assets or clinical condition logic is used. Because this is a local JavaScript/JSON prototype, form submissions require JavaScript; the API and original CLI are the documented fallback rather than a separate server-rendered HTML form system.
- The demo's default data path is `data/prototype-demo` to keep it separate from a fresh `npm start` workspace. Its OS opener is best-effort, but the URLs are always printed. In this agent environment background jobs may be cleaned up with their launching command, so the final demo server is retained in an active execution session for the user.

## Stage limitations and deviations

| Stage | What it does not do |
| --- | --- |
| Upload | No real authentication, PDF parsing, document truth/provenance verification or file preview; `%PDF-` is only a format gate. |
| Digitisation | No OCR, layout analysis or extraction. Manual entry accepts human-authored blocks; it does not understand a document. |
| Draft/review | No LLM, inferred ATC, trimester/age modelling, reviewer authentication, raw-node authoring for unknown text, or clinical validation. Unsupported/qualified content is refused conservatively. |
| Fixtures/release | No clinical oracle, production key custody, key rotation, remote distribution, automatic approval or release overwrite. Historical keys and packages must remain available for replay. |
| EMR | No ICD terminology catalogue, drug–diagnosis compatibility validation, real patient use, age model, FHIR, CDS Hooks, sync or multi-user concurrency. Coded diagnosis is a workflow prerequisite, not proof of clinical appropriateness. |

The conservative unsupported-block release gate and qualified-pregnancy refusal are stricter than the prompt's minimum behavior. No requested feature is represented as real extraction or clinically verified decision support. See [PROTOTYPE-VALIDATION.md](PROTOTYPE-VALIDATION.md) for tests and the recorded demo results. The original core documentation follows.

---

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

No requested implementation requirement is intentionally left unmet. Qualification: inclusive maximum coverage is not expressible under the documented conservative convention; source provenance cannot be authenticated without real source documents; replay requires retained historical packages. The original core has no production clinical validation, deployment, sync, LLM, FHIR support or additional rule node types. The local HTTP server and UI added in the prototype phase are described above.
