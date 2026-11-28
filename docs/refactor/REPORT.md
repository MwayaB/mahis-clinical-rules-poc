**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Generic assessment refactor report

## Validation and delivery

Baseline `df35ea1`: 223 tests passed, zero failed/skipped; README 283 lines. Final Node 22.18 run: **277 tests passed, zero failed/skipped**, including purity, no-literals, shared API/ledger/fixture/replay tests, type tests and documentation checks. README is now **56 lines**.

`npm run demo` passed on the documented port 8080 with isolated placeholder storage: child dosing incomplete → warning → no advice; adult pregnancy block and triage incomplete → scored → reasoned override; exact replay of recorded assessments. The occupied-port guard was also checked. The original server was restored on the same port with its original data after the isolated demo. No alternate port was introduced.

Browser access was unavailable; UI evidence is automated DOM-surface rendering plus API integration, not a new visual/browser inspection. Real clinical validity, governance, programme integration and facility distribution remain outside scope.

The inventory was committed first (`464e9fa`), before implementation. Shared guarantees and pure registry/types landed in `9fd5041`. Implementation, UI, test moves and documentation were subsequently included in `0705937`; a whitespace cleanup followed in `9b1038c`. This report completes the documentation record without rewriting those commits.

## Endpoints before and after

The complete baseline, with file/line references, is in [INVENTORY.md](INVENTORY.md). All source, review, fixture, release, patient and replay routes remain, except the following replacements:

| Before | After |
| --- | --- |
| POST /api/triage/drafts | POST /api/rules/import |
| GET /api/triage/sample | GET /api/sample-bundle (already available; no second sample endpoint) |
| GET /api/triage/config | GET /api/assessment/config |
| POST /api/encounters/:id/triage | POST /api/encounters/:id/assess |
| POST /api/encounters/:id/triage/override | POST /api/encounters/:id/assess/:seq/override |
| POST /api/patients/:id/prescriptions/check | Same route, deprecated compatibility wrapper over shared assess/record |

All current router API entries follow; static presentation assets are an explicit separate allowlist.

- `GET /api/guidelines`
- `POST /api/guidelines`
- `GET /api/guidelines/:sha256`
- `POST /api/guidelines/:sha256/metadata`
- `POST /api/guidelines/:sha256/digitise`
- `GET /api/guidelines/:sha256/blocks`
- `POST /api/guidelines/:sha256/blocks`
- `POST /api/guidelines/:sha256/draft`
- `POST /api/rules/import`
- `GET /api/ir`
- `POST /api/ir/:id/edit`
- `POST /api/ir/:id/approve`
- `POST /api/ir/:id/reject`
- `GET /api/ir/:id/history`
- `GET /api/fixtures`
- `POST /api/fixtures`
- `GET /api/releases`
- `POST /api/releases`
- `GET /api/assessment/config`
- `POST /api/encounters`
- `GET /api/encounters/:id`
- `POST /api/encounters/:id/observations`
- `POST /api/encounters/:id/assess`
- `POST /api/encounters/:id/assess/:seq/override`
- `GET /api/patients`
- `POST /api/patients`
- `POST /api/patients/:id/observations`
- `POST /api/patients/:id/status`
- `GET /api/patients/:id/diagnoses`
- `POST /api/patients/:id/diagnoses`
- `POST /api/patients/:id/prescriptions/check`
- `GET /api/patients/:id/events`
- `GET /api/patients/:id/context`
- `POST /api/events/:seq/replay`
- `GET /api/sample-bundle`

## Events before and after

Unchanged event types: patient-registered, observation-recorded, status-recorded, diagnosis-recorded, prescription-drafted, advice-shown, advice-response, encounter-opened. The deprecated dosing wrapper retains its last two draft/receipt events for existing clients and now also records generic assessments and proposal observations.

| Previous type | Current type |
| --- | --- |
| triage-recorded | assessment-recorded |
| triage-overridden | assessment-overridden |

Every evaluated node has one assessment event, regardless of status. Known applicability exclusions have neither a result nor an event. Assessments and observations are scoped to their encounter; overrides link an original sequence and do not edit it.

## Result field changes

| Previous shape | Envelope shape |
| --- | --- |
| Dosing response `advice` array | `status: advice` when nonempty, otherwise `ok`; `outcome.items` contains original advice items |
| Triage `status: scored` | `status: ok` |
| Triage top-level category | `outcome.category` |
| Triage top-level score, components, overrides_fired | `payload.score`, `payload.components`, `payload.overrides_fired` |
| Triage invalid input/value | `invalid: [{input,value,reason?}]` |
| Bare hash hex | `inputs_hash: sha256:<hex>` |
| No dosing node identity/type envelope | `node_id`, `node_type` on every result |
| Type-specific partial fields | Shared `missing: []`, `invalid: []`, `payload: {}`; outcome absent for incomplete/invalid |
| Table match internal only | `payload.matched_band` |
| Package placeholder flag on historical result | Signed manifest retains flag; generic envelope uses exact requested field set |

Renderer and allowed-action hints are supplied in payload. The compatibility dosing wrapper translates back to the existing advice response shape, preserving missing-input warnings, severity/message/source references and prescription retention. Existing dosing evaluator, boundary and workflow assertions remain unchanged; compile-dependent tests explicitly supply test ledger evidence.

## Historical upcast

`src/events.js` decodes through `src/upcast.js`, the only production module containing old event/route names. It maps triage-recorded to assessment-recorded on read, converts each historical result into an envelope, retains original package fingerprints/cutoff and marks legacy_type for the historical context projection. Historical multi-result events retain their original sequence and results array; new events carry one result each. Scored becomes ok, clinical detail moves to payload/outcome and hashes gain the prefix.

A triage-overridden row becomes assessment-overridden: triage_ref is resolved to the referenced original seq, category becomes action and node_id is retained. Original stored rows are never rewritten. The actual SQLite fixture in `fixtures/legacy-assessment/` includes both names, an immutable signed historical package and a public key only. `test/shared/upcast.test.js` copies the database, verifies new names, replays historical results and checks original row names/bytes remain unchanged. Private keys are absent.

## Shared guarantees and ownership

Approval is derived solely from review_events against current content after the latest edit/rejection. High-risk content requires two distinct reviewers. File status/reviewers and display caches cannot authorize publication. Standalone compilation now requires supplied ledger rows; the HTTP workflow reads them directly.

Shared applicability/input checks precede type evaluation. The type cannot supply an outcome for missing/invalid input because it is not called. The common envelope/event validators prohibit partial clinical results. The compiler shares validation, explicit fixture-kind evidence and signing. Type versions are signed in the manifest; older signed packages without that optional list remain verifiable for replay.

Recording, reasoned overrides, observation staleness and replay are generic. A temporary dummy type passes compilation, HTTP observation, incomplete/complete recording, override and replay with no route, event or release-check changes, then unregisters. Its evaluator is not called for missing/invalid data.

No requested shared guarantee is knowingly omitted. Type-specific nested schemas and meaning of fixture evidence remain declared validator/type responsibilities: the generic layer enforces their invocation and required evidence, while each type tests its own schema/semantics. Entry guards and selected-release domains are separate; invalid imported historical values still yield invalid assessments rather than a clinical outcome.

## Review visibility correction

Every card now uses common approval controls, shows approver identities and required count, and supports approval/rejection. Fixture sections are open by default for every rule. Dosing retains structured fixture forms; other types expose JSON fixtures with the same load/save workflow. The regression test iterates registered types and checks visible evidence and expanded fixture sections. Sample loading never silently saves or approves content.

## Moves, renames and deletions

| Original | Destination / reason |
| --- | --- |
| public/triage.js | Deleted; replaced by public/assessment.js for all renderers |
| src/triage-records.js | Deleted; common src/assessment-records.js validates envelopes |
| Separate compiler triage fixture gate alias | Removed; all callers use fixtureGate |
| test/boundaries.test.js | test/types/dosing/boundaries.test.js; import paths only |
| test/evaluator_rules.test.js | test/types/dosing/evaluator_rules.test.js; import paths only |
| test/triage/*.js | test/types/triage/*.js; type-specific suites colocated, changes detailed below |
| AUDIT.md | Historical text in docs/refactor/history/AUDIT.md; current index at docs/audit/AUDIT.md |
| VALIDATION.md | Historical text in docs/refactor/history/VALIDATION.md; current evidence at docs/validation.md |
| TRIAGE.md | Historical text in docs/refactor/history/TRIAGE.md; current implementation at docs/triage.md |
| PROTOTYPE-VALIDATION.md | docs/refactor/history/PROTOTYPE-VALIDATION.md |
| README engineering sections | docs/design.md, api.md, cli.md, decisions.md, terminology.md, data-quality.md and triage.md |

No external inbound links were known for the root report files, so redirect stubs were not added. Internal links were updated and are tested. Historical text remains under refactor history so old route/event names are preserved as evidence without appearing in current instructions. No source PDFs or patient datasets were replaced.

## Every changed existing test

- `test/compiler_determinism.test.js` — Compile import points to the test-only ledger-backed wrapper; determinism assertions unchanged.
- `test/fixtures_gate.test.js` — Compile import supplies ledger evidence; fixtureGate/projectRules still import production code. Gate assertions unchanged.
- `test/helpers.js` — Shared package construction uses explicit placeholder review ledger evidence through the test-only compile helper.
- `test/ir_validation.test.js` — Reviewer metadata test uses a non-string entry instead of a single reviewer: cardinality is now an event approval decision, not IR schema validation. Dedicated shared approval tests cover missing/one/stale/forged approvals.
- `test/package_verify.test.js` — Compile import supplies explicit test review events; package verification assertions unchanged.
- `test/prototype/fixtures.test.js` — Authored fixture helper adds required explicit positive/negative kinds; existing gate/staleness assertions unchanged.
- `test/prototype/release.test.js` — Fixture setup declares explicit positive/negative kinds; release approval and verification assertions unchanged.
- `test/prototype/status_release.test.js` — Compile import supplies test review events; selected-release regression unchanged.
- `test/prototype/support.js` — HTTP fixture helper declares kinds required by the shared gate.
- `test/purity.test.js` — Expands purity checks to domains/schema and every current JS module under src/types, automatically covering future type files.
- `test/replay.test.js` — Compile import supplies explicit ledger evidence; historical dosing replay assertions unchanged.
- `test/terminology/release_terminology.test.js` — Compile import supplies explicit ledger evidence; terminology assertions unchanged.
- `test/terminology/terminology_version.test.js` — Compile import supplies explicit ledger evidence; version mismatch/replay assertions unchanged.
- `test/workflow_end_to_end.test.js` — Compile import supplies explicit ledger evidence; dosing CLI/write/replay assertions unchanged.
- `test/boundaries.test.js` — Moved to type suite; only relative imports/fixture paths renamed. Clinical assertions unchanged.
- `test/evaluator_rules.test.js` — Moved to type suite; only relative imports/fixture paths renamed. Clinical assertions unchanged.
- `test/triage/compiler_triage.test.js` — Moved; compile test helper supplies ledger events, shared fixtureGate replaces removed alias; existing category evidence assertions retained.
- `test/triage/context_encounter.test.js` — Moved; relative imports/paths only.
- `test/triage/demo.test.js` — Moved; output event assertion uses generic event name while retaining incomplete/scored/overridden and indication checks.
- `test/triage/evaluator_triage.test.js` — Moved; relative imports/paths only; compatibility adapter preserves type logic assertions.
- `test/triage/ir_scored_triage.test.js` — Moved; relative imports/paths only.
- `test/triage/no_literals.test.js` — Moved; relative source paths adjusted only.
- `test/triage/review_inputs.test.js` — Moved; generic import route replaces retired draft route and relative paths adjusted; input edit assertions retained.
- `test/triage/support.js` — Moved; generic authored-rule import endpoint and relative fixture paths updated.
- `test/triage/triage_api.test.js` — Moved; assess endpoint, per-node envelope/payload fields and seq-linked action override replace retired API/result shape. Existing input, encounter and immutability cases retained.
- `test/triage/triage_replay.test.js` — Moved; generic assess response and exact single-envelope replay replace historical aggregate result expectations.
- `test/triage/ui_triage.test.js` — Moved; imports generic renderer/panel, uses envelopes/current result arrays/config endpoint, retains no-score/no-colour and stale header assertions.

New suites are under test/shared and test/docs; test/compile-approved.js is a test-only construction helper, never a production approval fallback. New fixture metadata is explicit in fixture JSON and sample bundles. Clinical fixture values and source guidance were not changed.

## New shared modules and documentation

New production modules: approval.js, schema.js, domains.js, inputs.js, assessment.js, assessment-records.js, upcast.js, types/registry.js, types/dosing.js and types/triage.js. Each owns one shared concern or one type's behavior. public/assessment.js owns result presentation; public/review-controls.js owns reusable review evidence/fixtures. Input defaults and guard values live under samples, not src.

The documentation index links design, API, CLI, decisions, triage, validation, terminology, data quality, audit and refactor reports. The API reference is checked against the operative router allowlist in both directions; the deprecated prescription route stays listed. npm run demo is the sole public quickstart demo command. Documentation tests also enforce length/order, resolved links, notices, retired names and script existence.

## Follow-up: clinician review responsibilities

Clinical review no longer exposes fixture editors, JSON test inputs, or load/save actions. Cards show read-only automated-check summaries and collapsed technical details. The pre-authored checks for unchanged checksum-matched shipped sample drafts are attached automatically. Edits preserve stale-check blocking; other authored rules still need engineering-supplied tests. The fixture API and independent release gates remain. The EMR is the clinical example walkthrough; automated regression tests remain a technical responsibility. This supersedes the expanded fixture controls described above.

Follow-up validation: 282 tests passed, zero failed/skipped. The demo flow now runs check summaries rather than posting fixtures. Existing applicability-review assertions were updated to require automated checks instead of the removed fixture JSON editor; clinical approval assertions were retained.
