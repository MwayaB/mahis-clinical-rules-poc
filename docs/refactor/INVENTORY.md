# Pre-refactor inventory

Every clinical value, code, patient and reviewer identity is a placeholder, not clinical guidance.

Recorded before changing code, at commit df35ea1. Node 22.18 baseline: **223 passed, zero failed, zero skipped**, including evaluator purity. Root README: 283 lines. The current implementation already has a shared review/release endpoint, but evaluation, events, replay and rendering remain split. This inventory describes actual code, not an assumption that triage has an entirely separate publisher.

## HTTP inventory

All routing is in src/server.js (line numbers refer to this baseline).

| Methods and paths | Lines | Purpose |
| --- | --- | --- |
| GET /, /guidelines.html, /digitise.html, /review.html, /emr.html, /style.css, /common.js, /guidelines.js, /digitise.js, /review.js, /emr.js, /triage.js, /triage-review.js and the two sample PDF paths | 15, 46–49 | Exact static allowlist |
| GET, POST /api/guidelines | 50–54 | List/upload source |
| GET /api/guidelines/:sha256 | 56–58 | Read source |
| POST /api/guidelines/:sha256/metadata | 59 | Set metadata |
| POST /api/guidelines/:sha256/digitise | 60 | Mock digitisation |
| GET, POST /api/guidelines/:sha256/blocks | 61–62 | Source blocks/manual entry |
| POST /api/guidelines/:sha256/draft | 63 | Draft rules |
| POST /api/triage/drafts | 65 | Type-specific authored import |
| GET /api/ir | 66 | Review nodes |
| POST /api/ir/:node_id/edit, /approve, /reject; GET /api/ir/:node_id/history | 67–70 | Revision/approval history |
| GET, POST /api/fixtures | 72–73 | Authored fixture storage |
| GET, POST /api/releases | 74–75 | Shared release publisher |
| GET /api/triage/sample | 76 | Type-specific sample |
| GET /api/triage/config | 77 | Type-specific input/category configuration |
| POST /api/encounters | 78 | Open encounter |
| GET /api/encounters/:id | 79–81 | Encounter projection/history |
| POST /api/encounters/:id/observations | 79–82 | Triage-only observation entry |
| POST /api/encounters/:id/triage | 79–82 | Separate triage evaluation |
| POST /api/encounters/:id/triage/override | 79–82 | Separate category override |
| GET, POST /api/patients | 84–85 | Patient index/registration |
| POST /api/patients/:id/observations, /status, /diagnoses, /prescriptions/check | 86–91 | Patient data and dosing check |
| GET /api/patients/:id/diagnoses, /events, /context | 86–90 | Patient projections/history |
| POST /api/events/:seq/replay | 93 | Dispatch to two replay implementations |
| GET /api/sample-bundle | 94 | Placeholder source bundle |

## Event inventory

src/events.js: shapes near lines 7–15; append validation in its switch; all records share the SQLite append-only events table.

| Family | Types | Writers |
| --- | --- | --- |
| Patient/context | patient-registered, observation-recorded, status-recorded, diagnosis-recorded | src/workflow.js:16–24; src/encounters.js:15–17 |
| Dosing | prescription-drafted, advice-shown, advice-response | src/workflow.js:26–39 |
| Encounter | encounter-opened | src/encounters.js:11–13 |
| Triage | triage-recorded, triage-overridden | src/encounters.js:30–48 |
| Review ledger | draft-created, draft-imported, edited, approved, rejected, rejection-reason | src/draft.js; src/review.js:12–39, importTriageDraft |
| Release ledger | release-created | src/release.js:44–45 |

Dosing replay is src/workflow.js:42–51. Triage replay is src/encounters.js:58–63. Both validate event identity, historical cutoff, manifest/rules fingerprints, rebuild context, evaluate and compare hashes/results. src/emr.js dispatches between them.

## Release checks and approval reads

src/release.js:23–46 is already one publisher for both families. It checks metadata/version uniqueness, nonempty nodes, cached approval state, parser errors, no unconverted blocks, fixture gate, IR validation, signing-key validity, output uniqueness, compilation, signature/checksum verification and release-record fingerprints.

File-based/cached approval decisions that must change:

- src/release.js:30: `if(node.status!=='approved'||new Set(approvals.filter(a=>a.content_hash===content_hash).map(a=>a.reviewer)).size<2)` reads status and the approvals cache, not review_events.
- src/compiler.js:43: `if(n.status==='draft') errors.push(...)` uses IR metadata as a release decision.
- src/ir.js:34: `n.reviewers.length<(n.risk==='high'?2:1)` treats a file reviewer list as evidence.
- src/review.js:30–32: `current.approvals.some(...)` and `approvals.length>=2?'approved':'draft'` derive approval state from the mutable nodes cache. getNode line 7 reads `JSON.parse(r.approvals)`.
- src/review.js:10 supplies `status:'approved',reviewers:['validation-reviewer-a','validation-reviewer-b']` solely to get through metadata validation, another sign that content validation and approval evidence are conflated.

review_events already records actor, seq, before_hash, after_hash and snapshots. It must become the approval source of truth. Stored IR status/reviewers may remain display metadata but cannot authorize compilation/release. Reverted edits with the same hash must still invalidate earlier approvals.

## Duplicated mechanisms

| Mechanism | Dosing path | Triage path |
| --- | --- | --- |
| Validation | src/ir.js table/predicate branches | src/triage-ir.js, dispatched specially from ir.js |
| Serialization | compiler.js ternary tableFields/predicateFields | special triageFields branch |
| Fixture gates | compiler.js fixtureGate advice IDs/positive-negative | compiler.js triageFixtureGate separate result/status/category coverage |
| Evaluation | evaluator.js evaluate, missing inputs/advice | evaluator.js triage, separate missing/invalid/metadata loop |
| Context | context.js buildContext | context.js buildEncounterContext |
| Event append/audit metadata | workflow.js prescribe | encounters.js scoreEncounter |
| Override validation | workflow.js respond; events.js advice-response | encounters.js overrideEncounter; events.js triage-overridden |
| Replay | workflow.js replay | encounters.js replayTriage |
| Rendering | public/emr.js showAdvice | public/triage.js triageResultView/initTriage |
| Review/editor/import | public/review.js ordinary nodeCard | separate triageCard/import section; src/review.js importTriageDraft |

The incomplete-data rule differs: dosing emits advice warnings and may inspect missing fields within its own branches; triage short-circuits with no category. Shared envelopes will make missing/invalid outcome suppression uniform, while the deprecated dosing adapter retains legacy warning presentation.

## Documentation inventory

- README.md: long mixed public/engineering document; triage routes at lines 269–276, triage sections near 240+, validation/decisions/API/CLI content throughout.
- TRIAGE.md: old event names in event/storage descriptions and old separate-flow report; move current report to docs/triage.md and retain historical name mapping only under docs/refactor/.
- AUDIT.md: root historical defect/terminology/source reports, including triage additions; move to docs/audit/.
- VALIDATION.md and PROTOTYPE-VALIDATION.md: historical test/demo evidence and type-specific flow references; consolidate under docs/validation.md with historical naming notes relocated here.
- samples/dose-guide/README.md: sample workflow instructions to update to the generic flow.
- terminology/README.md: placeholder seed description; retain with corrected links if needed.

The root documents were previously linked in public chat/repository responses, so one-line root redirect stubs are justified for AUDIT.md, TRIAGE.md and VALIDATION.md. No known external link requires a REFACTOR.md stub. No medical facts or source authority are established by this inventory.
