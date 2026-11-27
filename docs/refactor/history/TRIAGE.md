**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Scored triage implementation report

## Scope and interpretation

Triage is decision support for the person doing triage. It records a category, not an instruction to withhold action. A clinician can override a scored category with a recorded reason; the original event remains unchanged. No real chart, clinical validity, Ministry-defined priority or colour scheme, or patient-outcome validation is claimed.

The only sample rule is the supplied adult respiratory-rate/AVPU rule. Its thresholds, explicit ordinal points, score bands, category ordering and rule override are unchanged and marked `placeholder: true`. These are invented test values. Real values must be authored from the reviewed, Ministry-approved chart and pass the existing two-reviewer, fixture and signed-release gate. Reviewer strings in this prototype do not establish real Ministry governance or authenticated independent reviewers.

The user resolved the task's adult-rule/child-demo inconsistency by choosing the **adult** demo and keeping the supplied rule. The demo records all five available vitals, with AVPU last; only respiratory rate and AVPU are required/scored by this node. Pulse, temperature and SpO2 are retained as encounter observations but do not invent additional scoring parameters. No paediatric chart or age-to-population cutoff was inferred.

The supplied score bands end at 99, but the maximum attainable score is 6. Fixtures exercise all attainable category edges and all numeric input boundaries. An actual score of 99 cannot be generated without changing the supplied sample; no second sample rule was created to fabricate it.

## Files added or changed

| File | Behavior |
| --- | --- |
| `src/triage-ir.js` | Strict scored-triage schema: numeric coverage, discrete integer score coverage, explicit ordinal points, unique parameters/levels/categories/override IDs, equality-only override conditions, safe integer score bounds and unknown-field rejection. |
| `src/ir.js` | Registers scored_triage and its fields; retains provenance and high-risk reviewer checks. |
| `src/compiler.js` | Projects all triage fields, gates typed triage fixtures separately from prescription advice fixtures, and emits triage_nodes. Scored fixture expectations require explicit score/category. |
| `src/package.js` | Verifies the triage count and applies the compiled schema. Old prescription-only manifests without triage_nodes remain compatible as zero triage nodes. |
| `src/evaluator.js` | Adds pure triage(package, context), one deterministic result per matching node. Checks all missing inputs before mapping points/overrides. Invalid and incomplete results have metadata but no score, category, components or fired overrides. Prescription evaluation ignores triage nodes. |
| `src/plausibility.js` | Loads separate data-quality definitions and validates the five triage input types/ranges. No clinical triage thresholds or category labels are embedded here. |
| `samples/triage/entry-guards.json` | Placeholder entry bounds and AVPU string enumeration, separate from clinical scoring. |
| `src/context.js` | Builds a frozen encounter context with null defaults and latest non-superseded values, without mixing encounters or patients. |
| `src/events.js` | Validates encounter-opened, encounter observations, triage-recorded and triage-overridden. Prevents cross-encounter supersession and retains append-only storage. |
| `src/triage-records.js` | Validates full result shapes and metadata; rejects partial score/category fields on incomplete or invalid results. |
| `src/encounters.js` | Opens encounters, guards input, records every evaluation and linked clinician override, serves current encounter state and performs exact historical replay. API summary chooses the highest category only for compatible category orders; incomparable charts remain individual results. |
| `src/emr.js` | Extends the existing replay route to triage events. |
| `src/review.js` | Imports authored triage as an unapproved draft and permits structured triage edits. Two reviewers and current authored fixtures remain required. |
| `src/fixtures.js` | Accepts typed triage contexts/expectations and includes them in the existing release gate without treating category results as prescription advice. |
| `src/server.js` | Adds encounter, triage config/sample/import and scoring/override routes; allowlists the UI module and sample chart PDF. |
| `public/triage.js` | Displays API results and API-selected summary, entry forms, missing badges and clinician override form. Performs no scoring or ranking. Uses a fixed UI-only colour mapping keyed by category name, with a neutral fallback. |
| `public/emr.html`, `public/emr.js`, `public/style.css` | Triage panel, population/encounter controls, current header category, components table, fired rule overrides and linked event history/replay. Incomplete/invalid/currently unscored states clear an earlier header category. |
| `public/review.html`, `public/review.js` | Authored IR import, structured triage JSON editor, fixture editor and reviewer controls. Imports do not masquerade as PDF extraction. |
| `ir/triage_example.ir.json` | The single supplied placeholder rule; source document checksum binds its accompanying chart PDF. |
| `fixtures/triage_example.fixtures.json` | Normal, attainable score edges, numeric boundaries, automatic priority override, missing inputs and invalid values. |
| `samples/triage/placeholder.pdf`, `scripts/generate-triage-pdf.py` | Guideline-style placeholder chart rendered directly from the one IR sample, including bands, points and override. No demo patients or software entry guards are presented as guideline content. |
| `samples/triage/demo.json` | Data-only normal vitals, reason and release identity for the adult demo. |
| `scripts/prototype-flow.js`, `scripts/prototype-demo.sh` | Existing dose checks plus adult encounter, four vitals/incomplete, AVPU/scored, clinician override, event trail and replay. The separate triage release passes import, independent approvals and fixture gating. |
| `README.md` | Updated scope and Triage section explaining workflow, API, placeholder status, source approval, limits and the requested entry/scoring boundary distinction. |
| `test/triage/` | Schema, compiler/determinism, evaluator, encounter projection, API, replay, literal checks, rendering-state and end-to-end demo tests. |

## Important behavior

- The evaluator has no event-log, clock, network, filesystem or environment access. It imports only the existing canonical hashing module; the original purity test is unchanged.
- Numeric coverage follows each declared parameter's half-open range. Score bands operate on integer totals, so adjacent inclusive ranges ending at 2 and beginning at 3 have no integer gap. Negative integer points are not silently converted or inferred; the validator computes the full minimum/maximum possible total from explicit points.
- AVPU values are strings with explicit points. Enumeration order is documentary; no numeric ordinal comparisons occur.
- Missing required parameters short-circuit the entire node before any partial score or automatic override is computed. Even an available unresponsive value cannot yield a category when respiratory rate is missing.
- Rule overrides compete with the score-band category according to categories_order. They cannot lower the result. A clinician override is different: it is an explicitly chosen category from the recorded package, linked to a scored original with a reason.
- Entry limits are the requested data-quality limits, not clinically validated thresholds. Respiratory rate 100 is accepted by the inclusive 0–100 entry guard but yields invalid under the sample's exclusive 100 scoring endpoint. The value is not clamped or silently scored. Unknown ordinal values are rejected at API entry; pure evaluation still returns invalid for such historical/synthetic input.
- Results of every status include node ID, package version, engine version, placeholder flag and input hash. The stored triage event also records exact package fingerprints and the predecessor context cutoff.
- Observations changing after scoring clear the current summary and require rescoring before a clinician override. Previous results stay visible as history. An incomplete or invalid evaluation does not acquire a category through the override endpoint.
- Replay reconstructs the encounter's input values at the recorded cutoff, using the exact signed release. Later observations, corrections or overrides cannot change the replayed result.

## Verification

Baseline: 156 tests passed. Schema stage: 185. Compiler/evaluator stage: 206. Encounter/API stage: 210. Demo and initial rendering checks: 216. Mixed-rule compile coverage: 217. Final expectation-strengthening check: **218 tests passed, zero skipped**, including the unchanged purity test and original terminology literal test.

Tests under `test/triage/` cover:

- every schema rule, nested unknown fields, gaps/overlaps, missing/duplicate ordinal levels, numeric ordinal values, explicit points, category references, reviewer counts, and incomplete score coverage;
- byte-identical rules, manifests and signatures; compiled triage counts; mixed prescription/triage packages; refusal of underspecified fixture expectations;
- all supplied numeric boundaries and reachable score edges, ordinal ordering independence, missing inputs before overrides, invalid ordinal/numeric values, sorted multi-node output, unmatched scope, and category-rank precedence;
- encounter isolation, latest values, permanent supersession and historical cutoffs;
- incomplete/scored/invalid recording, entry range/type rejection, blank reason and unknown category rejection, separate clinician overrides and required review before release;
- exact replay of incomplete, scored and invalid results after later corrections;
- renderer absence of score/category/colour/table for incomplete and invalid results, and clearing stale patient-header categories;
- the complete curl demo through reviewed publication, incomplete → scored → overridden states and replay.

The no-literals tests verify that category labels are absent from src, except the pre-existing risk enum's unrelated `standard` homonym. Sample clinical boundary constants are checked in the pure scorer/schema; structural small integers for indexing/counters are not treated as clinical constants. Entry limits and ordinal input values live in separate placeholder data, not scoring code. No npm dependencies were added.

The generated chart PDF was rendered and visually inspected. Live browser verification was **not completed**: the isolated browser-test server rejected access, and permission to investigate another test origin was declined. No alternate browser surface or egress workaround was used. Both temporary servers were stopped; the user's server on 8080 and existing patient data were not modified. API and dependency-free DOM rendering tests passed, but these do not replace a completed live browser check.

## Not covered

The real chart's parameters/thresholds, paediatric and adult clinical variants, Ministry colour/priority mapping, outcome validation, authenticated governance, production key custody/distribution, or automatic demographic-to-chart selection are outside this proof of concept. The reviewed IR and evaluator interfaces allow additional chart content, but no clinical equivalence or integration readiness is asserted.


## Combined placeholder guideline follow-up

The main placeholder now contains both the existing drug guidance and triage scoring in one two-page PDF. Page 1 retains the original drug tables and pregnancy statement unchanged; page 2 renders the single supplied triage sample's parameters, points, score categories and automatic override. No clinical values or scoring semantics changed. The compatibility path under samples/triage contains identical PDF bytes.

The checksum-bound mock fixture has four blocks across both pages. Triage block b4 is attached to the authored IR using matched provenance (page, bbox and text), rather than duplicated as a manual block. Attachments receive source-scoped node IDs to preserve older versions. Unconverted blocks still prevent release; independent reviewer approvals and fixtures remain required for all four rules. The full demo now performs one upload and publishes one combined release, poc-demo-0.4.0, for prescribing and triage.

The generator updates source data, both PDF paths, mock fixture, source checksums and fixture IDs together. The original triage renderer entry point delegates to the combined generator. Both PDF pages were rendered and visually checked, and pypdf extraction verified source text and checksums. The README and sample instructions describe the unified review flow. PDF files are marked binary in .gitattributes so Git does not treat PDF cross-reference padding as source whitespace errors.

The verification follow-up adds the authored sample triage to Create drafts automatically for the exact combined-PDF checksum and matching source provenance. It appears beside the three existing rule cards with empty reviewers/approvals. Generic sources do not gain inferred triage rules. Repeat drafting preserves prior revisions and approvals. The sample bundle carries the explicit authored mapping; the generator keeps it aligned with the chart. The complete suite now passes **221 tests, zero skipped**, including the new four-rule verification and source-attachment regressions.

## Review input controls

The triage review card now exposes required parameter names and encounter input keys, numeric coverage/bands and points, ordinal levels and points, total-score bands/categories, category priority and automatic override equalities. The structured editor serializes the same IR fields; saving still resets approvals and makes prior fixtures stale. Advanced JSON remains in a collapsed disclosure, with a recovery path when invalid schema prevents structured rendering. The import panel is hidden once a triage card exists, removing the duplicated import/card workflow. This change does not alter the EMR panel or scoring logic. Two rendering/serialization regressions verify preservation of band inclusivity and ordinal strings and safe editing of point values. Full suite: **223 passed, zero skipped**.
