# Shared clinical guideline rules for MaHIS

A proof of concept for authoring, reviewing and packaging clinical rules once, with a common evaluator that programme systems could consume.

## Problem statement

Malawi's national clinical guidelines are shared across programmes. Antiretroviral therapy, tuberculosis, antenatal care, immunisation, child health and non-communicable disease care all draw on common rules for dosing, contraindications, triage and follow-up. In practice, each programme encodes these rules separately, in its own system, from its own reading of the guideline document. The same weight-band dose table can exist in several places, each maintained by a different team, and each updated on a different schedule.

The *Concept of MaHIS* describes programme-specific systems as the historical pattern. The HIV ART electronic data capture system, first piloted by implementing partners, became a point-of-care record in 2012, and programme modules have grown around it. The concept's business-logic layer calls for guidelines, protocols and procedures to be “strictly adhered to”, but it does not say where that logic lives, who owns it, or how it reaches each programme. The result is that the same clinical rule can be correct in one programme, out of date in another, and undetectable as a discrepancy because no one compares them.

This produces three problems for the Ministry:

1. **Duplicated effort.** Each programme pays to re-author and re-test rules that another programme already has, and does so in different tools.
2. **Divergence.** When a guideline changes, updates reach programmes at different times, or not at all. Two patients with the same weight and diagnosis can receive different advice depending on which programme they are registered in.
3. **No single record of what the rule was.** When advice is questioned, there is usually no way to establish which version of a rule produced it, who approved that version, or whether other programmes were using the same one.

This project asks whether guideline rules for MaHIS can be authored and reviewed once, compiled into signed and versioned packages, and consumed by each programme and each facility node through the same evaluator, so that a rule change is made once, propagates to every programme, and leaves an auditable trail.

## Proof-of-concept scope

The proof of concept demonstrates weight-based dosing, pregnancy contraindications and scored triage with placeholder values and one simulated EMR screen. It implements reviewed rule authoring, signed and versioned packages, deterministic evaluation, and recorded advice that can be replayed against the exact package used.

It does not demonstrate integration with existing programme systems, extraction from real guideline PDFs, real-chart triage validation, clinical validation, Ministry governance, or distribution to facility nodes. Those remain future work. The architecture separates authoring, compilation and evaluation to accommodate those extensions; compatibility with real programme systems has not been established.

**Every clinical value, patient, drug code, diagnosis label and expected clinical outcome is a PLACEHOLDER, NOT CLINICAL GUIDANCE.** Digitisation is a mock; uploaded PDFs are stored and hashed, never read or interpreted. This is a local demonstration with no authentication or clinical validation.

## Start the prototype

Use Node >=22 with built-in `node:sqlite`, plus `curl` for the demo. There are no npm dependencies, frameworks or build tools.

```sh
# Use Node.js 22 or later with node:sqlite support.
npm test
bash scripts/prototype-demo.sh
```

The script starts the server, uploads the shipped sample, sets metadata, loads the mock blocks, drafts, approves with two distinct reviewer IDs, saves authored fixtures, releases `poc-demo-0.4.0`, records coded diagnoses and prescriptions, asserts warning/no-advice/block outcomes, verifies replay and prints each API result. All network steps use curl. It opens the EMR page when an OS browser opener exists, prints both URLs and leaves the server running:

- Upload/library: [http://127.0.0.1:8080/guidelines.html](http://127.0.0.1:8080/guidelines.html)
- EMR: [http://127.0.0.1:8080/emr.html](http://127.0.0.1:8080/emr.html)

The printed PID and `data/prototype-demo/server.pid` identify the process to stop. The demo refuses an occupied port; stop that service before rerunning. Rerunning on the same data retains a matching existing append-only release and adds new placeholder patients. The combined PDF uses release `poc-demo-0.4.0`; old source identities and releases remain immutable. Use `PROTOTYPE_DATA_DIR=/absolute/path` for an isolated data directory, and `PROTOTYPE_NO_OPEN=1` to suppress OS browser opening.

For an empty workspace without a seeded release:

```sh
npm start
# Optional: node src/cli.js serve --port 8080 --data data/my-session
```

Only `127.0.0.1` binding is accepted. Use the exact printed IP URL; Host and Origin checks refuse cross-origin requests. SQLite may print its Node 22 experimental warning.

## UI walkthrough

1. **Upload:** choose **Upload sample PDF**, or select `samples/dose-guide/placeholder.pdf` with the file picker. Set a document ID and edition. The source table shows metadata status and SHA-256. Select **Inspect blocks**.
2. **Digitise:** select **Run mock digitisation**. Each source card shows `mock-fixture`, text, table cells, page and bbox. The displayed content is a fixed human-authored fixture, not extracted from the PDF. For other PDFs the error says to use manual entry; expand **Add a manual block** and enter page, bbox, text and table cells.
3. **Draft:** select **Continue to review**, then **Create drafts**. The sample text explicitly states its ATC codes, ICD-10 indications and pregnancy applicability, which the draft parser reads. ATC mapping is available for other source blocks that omit drug codes; a conflicting source code is rejected. Unsupported blocks are shown as unconverted. In each node, inspect the source, edit bands or equality conditions, severity, message and ATC, then **Save edit**. Every save resets approvals and records an immutable revision. Parse errors remain visible and block approval/release.
4. **Approve:** supply one reviewer ID and approve, then supply a second distinct ID and approve. The counter moves from **1 of 2 approvals** to **2 of 2 approvals**. Repeating the same ID does not count again. Rejection needs a reason and resets approvals. Reviewer IDs are plain strings, not authenticated people.
5. **Fixtures:** expand **Authored fixtures**, choose **Load sample fixtures**, inspect them, then **Save fixtures** for each node. You can also add/remove/edit individual cases in the form. Blank context fields mean missing inputs; a blank expected-ID field means no advice. Positive/negative authored coverage is required separately from generated boundary fixtures. Editing a node makes saved fixtures stale until explicitly reviewed and saved for its new hash.
6. **Release:** choose a new `poc-demo-X.Y.Z` or `poc-X.Y.Z` version and **Compile, sign & release**. Errors list unapproved nodes, parse errors, missing/stale fixtures or validation failures. Successful releases appear in the EMR dropdown. Existing releases are never overwritten.
7. **EMR dose case:** create a child with age **4 years**, sex **M**, and weight **15 kg**. Select the refreshed release and propose `P01BF01`, **1 tablet**. Before diagnosis, the check visibly warns that no indication is recorded and still records the prescription. Record the seed malaria code with certainty **confirmed**; repeat for the placeholder dose warning, then use **2 tablets** for no advice. A confirmed pneumonia diagnosis instead selects the pneumonia rule automatically.
8. **EMR pregnancy case:** create a separate female patient aged **30 years**, optionally record a known diagnosis, and record pregnancy true. Check `J01XX01` to see pregnancy block advice with the prescription retained. Age 12–50 and sex F are explicit in the placeholder source rule. All clinical values remain placeholders.
9. **Audit and replay:** advice events open with package version, engine version and inputs hash. Raw payloads are an optional disclosure. Select **Replay advice**; it must report a match using that event's exact historical package and predecessor cutoff, irrespective of later observations or corrections.

The EMR records patient facts and the proposed drug, not a manual rule selection. The evaluator selects approved rules by drug, sex, age and indication. Only confirmed or presumptive diagnoses count. Missing indications warn rather than block entry; unrelated active diagnoses skip indication-specific rules. Diagnosis codes must exactly match the placeholder terminology seed; unknown codes return HTTP 422. Missing applicability or clinical inputs remain visible unless a known exclusion makes the rule inapplicable.

## Prototype architecture and storage

`registry.js` handles bounded PDF storage and metadata; `digitiser.js` handles fixed fixtures and immutable manual blocks; `draft.js` builds deterministic draft structure from those human-authored inputs; `review.js` stores revisions and hash-bound decisions; `fixtures.js` gates authored cases plus independently derived boundaries; `release.js` delegates compilation, verification and immutable apply to the original core; `emr.js` delegates clinical writes, evaluation and replay to the original workflow. `server.js` only routes requests, enforces boundaries and serves allowlisted static files. `public/` contains vanilla browser presentation with no clinical rules.

Ignored `data/` holds `prototype.db` (sources, digitisations, current node pointers, append-only review history, fixtures, release records, patient index), `clinical.db` (the original append-only event log), `sources/<sha256>.pdf` and `releases/<version>/`. Development PEMs stay in ignored `keys/`. No private-key or general filesystem route exists.

## API conventions

All JSON mutation bodies use `Content-Type: application/json`. Digitise and replay take `{}`. Upload alone uses raw `application/pdf` bytes, max **25 MiB (26,214,400 bytes)**, with `filename` and `document_id` query parameters. JSON requests are limited to 2 MiB. Unknown fields and query parameters are refused. Errors are `{error: "reason"}`; data-quality and unknown-code errors use 422, gate conflicts use 409, missing resources 404, oversized bodies 413 and wrong media types 415. `X-User` defaults to `local-user` and is an audit label only.

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
| `GET /api/patients`, `POST /api/patients` | Create with `{name,sex,age_years?,patient_id?}` |
| `GET /api/patients/:id/context` | Observation projection with dates/nulls |
| `POST /api/patients/:id/observations` | `{field:"weight_kg",value,supersedes?}` |
| `POST /api/patients/:id/status` | `{field:"pregnant",value,supersedes?,release_version?}` |
| `GET /api/patients/:id/diagnoses`, `POST /api/patients/:id/diagnoses` | Save `{icd10,label,certainty?}`; list active coded diagnoses |
| `POST /api/patients/:id/prescriptions/check` | `{release_version,atc?,tablets?}`; missing indication warns without blocking |
| `GET /api/patients/:id/events` | Ordered clinical audit events |
| `POST /api/events/:seq/replay` | `{}`; match against exact historical release |
| `GET /api/sample-bundle` | Shipped sample metadata and authored fixture suggestions |

## Prototype Decisions

- Drafting is deliberately constrained: code only parses explicitly typed numerical bands and recognises the specified pregnancy prefix; all message templates, units and predicate content come from the existing human-authored placeholder IRs. No new recommendations are invented. The shipped mock blocks exactly match the regenerated guideline PDF and its source.json; they are still a fixture lookup, not OCR. Explicit source annotations supply applicability, never inherited template indications.
- Drafts may carry transient `parse_errors` and empty reviewers, so they live in the draft store rather than weakening the approved IR validator. Approval validates a clean candidate with synthetic validation-only reviewer slots; real stored approvals still require two distinct supplied IDs on the actual content hash. Parse errors must first be corrected through an explicit edit.
- Qualified pregnancy text, including “first trimester”, is not silently converted to an all-pregnancy rule. It carries parse errors requiring explicit reviewer editing. The shipped sample states its sex and inclusive age range explicitly. No trimester inference is performed.
- The dose and pregnancy demonstrations use separate patients. The dose patient's numeric value is always labelled kg; pregnancy is shown only on an explicitly adult-labelled placeholder. An early local demo mistakenly reused a child-labelled patient; its status was corrected with a superseding event, preserving history. The shipped script does not reproduce that setup.
- The earlier diagnosis-presence gate was removed: missing indications must produce visible advice and retain the prescription. Workflow and event entry validate exact terminology membership, canonical labels and version metadata. Applicability and indication selection belong to the evaluator.
- Metadata is set separately after upload. Identical bytes retain the first registry identity; conflicting later editions are refused. Source status remains `metadata-set` while later-stage history is stored separately. Hashes are lowercase 64-character hex; filenames are labels only and never determine disk paths.
- Digitisation is available only after metadata. There is exactly one shipped lookup fixture. Mock reruns return existing mock rows; manual blocks have `digitiser: manual`. Block IDs are immutable within a source; conflicts are refused rather than replaced. Uploaded bytes are never used as code, extracted as text, or served through arbitrary paths.
- Drafting has a separate endpoint from digitisation. Node IDs include the complete source checksum and block ID to avoid collisions. Repeat drafting preserves reviewed nodes. Unconverted blocks conservatively block release; there is no general raw-node editor or reviewed-exclusion flow for unsupported text in this scope.
- Editable table fields include `bands`, `coverage`, `message_template`, `applies_to`; predicate fields are `when`, `severity`, `message`, `applies_to`. Coverage is recomputed from edited band extrema unless supplied explicitly, then the original validator checks intervals. Source provenance, node identity, risk, placeholder flag and approvals cannot be changed by an edit request. A valid explicit edit clears parser errors; invalid edits retain visible validation errors.
- Content hashes exclude mutable status/reviewer lists. Approvals are stored with reviewer, timestamp and exact content hash; reviewer strings are trimmed and otherwise case-sensitive. Duplicate approval is idempotent. Every save, including an identical save, resets approvals and appends an edit event. Reject resets approvals and records a separate append-only reason snapshot. IDs remain audit labels; this is not authentication or proof of independent reviewers.
- Fixtures are bound to the content hash when saved. They may be authored before final approval but become stale after content changes. Positive/negative coverage must come from authored cases; automatically generated boundaries cannot bypass this gate. Boundaries use an independent endpoint-membership/equality oracle and are included in the compiler gate across the complete document. Cross-rule cases must list all expected rule IDs when multiple rules share an ATC.
- Release checks metadata, all approvals, parser errors, unconverted blocks, authored fixtures, boundaries and original IR validation before compilation. It self-verifies signature/checksum and applies the package before writing its append-only record. Release failure removes only the new output it created. A crash may leave an orphan directory; future attempts refuse overwrite. Cross-file crash durability and distributed transactions are not claimed.
- Core changes and their validation are recorded in `AUDIT.md`; the evaluator remains pure. Compiler, validator, context, workflow and entry modules now support source-grounded applicability, terminology and data-quality guards.
- Patients are indexed separately from the event log; registration updates two local stores synchronously and is not a crash-atomic distributed transaction. Each prescription/advice pair retains the original single-database transaction. New prerequisites or invalid requests create no prescription. Block advice records the proposal exactly as before.
- Additional read endpoints for source history, sample suggestions, diagnosis lists and patient context support the UI without placing rules in the browser. Static serving is an exact allowlist, including only the shipped sample PDF. Same-origin checks, strict content types, bounded bodies, safe text-node rendering and CSP limit accidental browser exposure; they are not an authentication system.
- The browser uses semantic forms, associated visible labels, native validation, keyboard focus indicators, explicit missing badges and live error/status feedback. No HTML injection, inline handlers, external assets or clinical condition logic is used. Because this is a local JavaScript/JSON prototype, form submissions require JavaScript; the API and original CLI are the documented fallback rather than a separate server-rendered HTML form system.
- The demo's default data path is `data/prototype-demo` to keep it separate from a fresh `npm start` workspace. Its OS opener is best-effort, but the URLs are always printed. Run the demo from a terminal session that permits the server process to remain running.

## Stage limitations and deviations

| Stage | What it does not do |
| --- | --- |
| Upload | No real authentication, PDF parsing, document truth/provenance verification or file preview; `%PDF-` is only a format gate. |
| Digitisation | No OCR, layout analysis or extraction. Manual entry accepts human-authored blocks; it does not understand a document. |
| Draft/review | No LLM, inferred ATC, trimester modelling, date-of-birth ageing, reviewer authentication, raw-node authoring for unknown text, or clinical validation. Unsupported/qualified content is refused conservatively. |
| Fixtures/release | No clinical oracle, production key custody, key rotation, remote distribution, automatic approval or release overwrite. Historical keys and packages must remain available for replay. |
| EMR | Only a placeholder ICD-10 subset and explicitly authored indication matching; no comprehensive terminology service, clinical appropriateness validation, real patient use, date-of-birth ageing, FHIR, CDS Hooks, sync or multi-user concurrency. Missing indications warn without preventing prescription recording. |

Unsupported source blocks prevent release, and qualified pregnancy statements require manual review. The prototype does not claim real extraction or clinically verified decision support. See [PROTOTYPE-VALIDATION.md](PROTOTYPE-VALIDATION.md) for tests and the recorded demo results. The original core documentation follows.

---

## Core pipeline reference

**Every clinical value, drug code, band, pregnancy statement, message, source excerpt, diagnosis, patient and reviewer identity in the examples is a placeholder, not clinical guidance.** Each example source IR node is marked `"placeholder": true`. The source checksums are placeholder zero hashes, not attestations of real documents. This repository demonstrates software behavior; it is not validated for clinical use.

## Run

Requires Node **22 or later with working `node:sqlite`**. No npm dependencies or installation step. SQLite is experimental in some Node 22 versions. Check first:

```sh
node --version
node --input-type=module -e 'import { DatabaseSync } from "node:sqlite"; console.log(typeof DatabaseSync)'
npm test
bash scripts/demo.sh
```

Select Node.js 22 or later using your preferred version manager. No SQLite substitute is used. `demo.sh` compiles a temporary package and demonstrates a child aged 4 years at 15 kg: a warning before diagnosis, dose advice after a confirmed malaria diagnosis, and no advice after dose correction. A separate adult female scenario demonstrates pregnancy advice. The script asserts the outcomes and removes its temporary database, package and signing key.

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
| `diagnose` | `--icd10 B50.9 --label "PLACEHOLDER diagnosis"` (optional `--certainty suspected`, `presumptive`, `confirmed` or `ruled-out`) |
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

- **Applicability:** drug, optional sex and inclusive age range are checked before clinical inputs. Known exclusions emit nothing; missing applicability data remains visible.
- **Indications:** `applies_to.icd10` is a case-sensitive prefix match including the dot, against active `confirmed` or `presumptive` diagnoses. `suspected` and `ruled-out` never satisfy it. No active indication yields `warn: no indication recorded; cannot check <node id>` and still records the prescription. An unrelated active indication skips the rule.
- **Data-quality limits:** weight 0.5–200 kg and age 0–120 years inclusive; pregnancy true requires sex F and recorded age 10–60, narrowed by pregnancy rule ranges. The placeholder pregnancy sample uses 12–50 inclusive.

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
- **Event values:** accept UTC ISO timestamps with seconds and optional three-digit milliseconds. Validate calendar dates without reading a clock. Sex is `F`, `M` or `U`; diagnosis certainty defaults explicitly to `suspected` and also permits `confirmed`, `presumptive` and `ruled-out`. Override responses require a nonempty reason; advice responses must reference the same patient's advice event. These are structural workflow conventions, not clinical interpretations.
- **Test boundary change:** move the shared edge from 15 to 14 on both adjacent bands, keeping coverage valid. Compare advice rather than result metadata between package versions. Only weights in `[14,15)` change, including the new edge and excluding the old edge. Generated boundary cases derive expectations from declared interval membership and exercise both complementary inclusion arrangements.

## Validation and limits

Built and committed in the required working order: canonical JSON; IR validation; compiler; package verification; evaluator; events/context; CLI/workflow/replay; scripts/documentation. The complete suite was run after every part. The final suite and demonstration results are recorded in `VALIDATION.md`.

Implementation limits: inclusive maximum coverage is not expressible under the documented conservative convention; source provenance cannot be authenticated without real source documents; replay requires retained historical packages. There is no production clinical validation, deployment, sync, LLM or FHIR support. Supported node types are table, predicate and scored_triage. The local HTTP server and UI added in the prototype phase are described above.

## Data-quality guards

`src/plausibility.js` defines entry guards, separate from clinical rule content. They reject implausible recorded data with HTTP 422 and a field/limit message; these bounds are not clinical limits or dosing recommendations. Age is optional at registration and stays null when missing. Recording pregnancy true requires eligible recorded sex and age. The status API uses pregnancy ranges from the explicitly selected, verified release (`release_version`), rather than scanning historical releases. The EMR submits its selected release. With no release supplied, workflow/CLI use the sample pregnancy rule as the documented demo fallback. An unverifiable selected release still fails closed; an unrelated historical release does not block status entry. False pregnancy status remains recordable without inferring eligibility. Unknown observation/status fields remain rejected by the existing event allowlists.

Run the corrected standalone demo with Node 22+: `bash scripts/demo.sh`. It prints child age 4 / 15 kg advice before diagnosis, after confirmed malaria with an incorrect dose, after correction, then a separate adult age 30 pregnancy block. `scripts/prototype-demo.sh` runs the same scenarios through curl and the API.

## Terminology

`terminology/icd10-seed.json` is a strict, versioned placeholder subset. Every seed label is **unverified**, and its chapter markers are supplied data rather than validated WHO chapter identifiers. Production terminology must come from a versioned, signed bundle; that distribution mechanism is not implemented here.

Diagnosis entry requires an exact known code, stores its canonical seed label, `system` and `terminology_version`, and preserves a differing user label as `label_entered` with a response warning. No code normalization or silent remapping occurs. IR indication prefixes must resolve against the compiler's supplied terminology. The signed manifest records that version. Context retains each active diagnosis's recorded version and flags changes; the evaluator warns and defers indication-dependent checks when versions differ. Runtime package validation preserves the signed release version rather than resolving its prefixes against a newer installed seed.

Legacy diagnosis events without version metadata remain unchanged and produce terminology-change warnings during current indication checks. Existing versionless packages are not silently upgraded; create a new reviewed release. Prefix matching is case-sensitive on the full code string, including the dot. `suspected` and `ruled-out` diagnoses never establish an indication.

## Placeholder source consistency

The two-page `samples/dose-guide/placeholder.pdf` contains guideline material only. Page 1 has the existing malaria and pneumonia dose tables plus the pregnancy restriction. Page 2 has the adult triage inputs, point bands, categories and priority override. Its ATC and ICD-10 identifiers are written in the guideline itself. No patient scenarios, software workflow instructions or data-quality implementation notes are included in the PDF.

`samples/dose-guide/source.json` is the authoring data. `scripts/generate-sample-pdf.py` regenerates the PDF, content hash, exact digitisation fixture and sample fixture IDs using ReportLab (authoring-time Python tooling only; no npm dependencies). Drafting parses explicit text annotations and preserves their source text. Generic tables without an indication do not acquire one from a template. Clinicians never select individual rules in the EMR; approved rules apply automatically from the patient facts and proposed drug. Sample IRs under `ir/` remain independently authored placeholder test inputs.

## Triage

Scored triage is decision support for the person doing triage. It records a category and never prevents clinical action. **Every threshold, point value and category label in the single sample rule is invented and marked `placeholder: true`; none is taken from a real chart.** Real parameters and values must come from the reviewed, Ministry-approved chart through the existing two-reviewer approval, fixture and signed-release gate. The prototype does not establish Ministry governance or clinical validity.

`ir/triage_example.ir.json` defines the adult sample. It scores respiratory rate and AVPU using explicit numeric bands and ordinal points; score bands and priority overrides produce a category. All five encounter fields—respiratory rate, pulse, temperature, SpO2 and AVPU—can be recorded, but only the two parameters declared in this sample contribute to its score. AVPU is stored as a string enumeration, never converted to a numeric rank.

- **Scored:** the API returns the category, total score, component values/points/band IDs, fired rule overrides, package/engine versions and input hash. The EMR displays the returned result; it does not calculate it.
- **Incomplete:** any required parameter missing yields `Cannot triage: missing …`. No score, category or category colour is produced, even if the available inputs would trigger a rule override.
- **Invalid:** an input outside the rule's coverage or ordinal enumeration yields the input and value, with no score or category. Inputs are not clamped.
- **Clinician override:** a scored result can be overridden with a permitted category and a nonempty reason. This creates a separate linked event and preserves the original result. Changed observations require rescoring first. An incomplete or invalid result cannot be turned into a scored result by an override.

Observations belong to an `encounter_id`. Latest non-superseded values are projected only from that encounter; corrections cannot cross encounters. Every evaluation, including incomplete and invalid results, is recorded with package identity, context cutoff and input hash. Replay uses the exact retained signed package and historical encounter context. Starting another encounter or recording new observations clears the current header category until a new result is recorded. Historical results remain visible as history.

Entry guards are separate data-quality limits: respiratory rate 0–100/min, pulse 0–300/min, temperature 25–45 C, SpO2 0–100%, and the four declared AVPU strings. They are not clinical thresholds. In particular, respiratory rate **100 passes the inclusive entry guard but is invalid for the sample's exclusive `[0,100)` scoring coverage**. These requested example limits are not a clinically validated range.

### Run the triage demo

Run `bash scripts/prototype-demo.sh` with Node 22+. It uploads the combined placeholder guideline once. Create drafts includes the drug rules from page 1 and the explicitly authored sample triage rule attached to its matching page-2 source block. All four appear together for verification. The triage mapping is restricted to this checksum-matched placeholder; no scoring rules are inferred from arbitrary PDFs. All four rules require two reviewer approvals and saved fixtures, then compile into one signed release used for both prescribing and triage. It uses the **adult** patient because the supplied sample scope is adult-only. Four vitals are recorded first; missing AVPU produces an incomplete result. Recording AVPU produces the scored category, followed by a reasoned clinician override and replay. The child is never scored using the adult rule.

In the EMR, select a signed triage release, select the appropriate rule population and choose **Start encounter**. Save available vitals, then **Score triage**. Missing fields display `not recorded`; blanks do not become zero. The patient header shows the API's current category. The result includes a component table, and the event history shows original results and clinician overrides together.

The chart is on page 2 of `samples/dose-guide/placeholder.pdf`, alongside the existing drug guidance on page 1. `samples/triage/placeholder.pdf` is an identical compatibility copy, not a separate chart-only source. `scripts/generate-sample-pdf.py` renders both pages; `scripts/generate-triage-pdf.py` delegates to it. For the shipped placeholder, upload the combined PDF, set metadata, run mock digitisation, then choose **Create drafts**. The verification page includes the three drug/pregnancy rules and one **Scored triage** rule without a separate import step. **Import authored triage rule** remains available for manually authored rules from other sources. Imports are drafts, not approvals. The triage card exposes structured input, band, ordinal-level, point and category controls, with a separate advanced JSON disclosure. The import panel is hidden when a triage card already exists. Two independent reviewers, authored fixtures and release checks all remain in force; there is no automatic extraction from the PDF.

The triage import reuses a matching digitised source block (or an explicitly selected `block_id`) and verifies page, bbox and source text. It does not duplicate the block. Attached rule IDs include the document checksum so a new source version does not overwrite an older reviewed chart. Unconverted blocks still prevent release. The shipped mock has a checksum- and provenance-matched authored triage mapping; other sources require explicit authoring/import and review.

### Triage API

| Route | Purpose |
| --- | --- |
| `POST /api/triage/drafts` | Import `{document_sha256,node,block_id?}` as a reviewed draft workflow |
| `GET /api/triage/sample` | Authored placeholder sample and test fixtures |
| `GET /api/triage/config?release_version=...` | Entry field definitions and rule populations/categories from a verified release |
| `POST /api/encounters` | Open `{patient_id,population}` and return `encounter_id` |
| `GET /api/encounters/:id` | Encounter inputs, history and current result |
| `POST /api/encounters/:id/observations` | Record `{field,value,supersedes?}` with entry guards |
| `POST /api/encounters/:id/triage` | Score `{release_version}` and record every result |
| `POST /api/encounters/:id/triage/override` | Record `{category,reason,triage_ref?}` without changing the original |
| `POST /api/events/:seq/replay` | Replay prescription advice or a triage result against its recorded package |

Multiple scope-matching nodes return results sorted by node ID. The API supplies a highest-category display only when every result is scored and their category orders are comparable. Otherwise the UI retains the individual results rather than inventing a shared ranking. UI colours are fixed demonstration styling, not Ministry-defined priority or colour mappings.

Not covered: the real chart's parameters and thresholds, paediatric/adult clinical variants, automatic age-to-population classification, Ministry-defined colours or priorities, or clinical validation against patient outcomes. Population is explicitly selected when opening an encounter. The supplied score band's upper endpoint of 99 exceeds the sample's maximum attainable score of 6; fixtures cover all attainable score edges and respiratory boundaries without inventing a second sample rule.

See [TRIAGE.md](TRIAGE.md) for the implementation report, test evidence and verification limits.
