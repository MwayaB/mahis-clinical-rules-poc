# Prototype defect audit

## Baseline (before code changes)

Node 18 default cannot load node:sqlite (2 pass, 22 failed files). Using installed Node 22.18.0: sandbox run 116/123 pass; six HTTP failures are listen EPERM, one CLI URL pathname failure. Unrestricted run: 121/123 pass, zero skipped. Remaining failures: server static path and CLI test use URL pathname with encoded spaces in this workspace. These portability defects will be corrected without weakening assertions. Purity passes.

The task heading mentions two defects; all A–D checks below are in scope. Tests use node:test with audit-ID names in test/audit.test.js. Initial observations below are immutable pre-fix evidence.

### A1 — PRESENT

Location: `src/ir.js:39`. Relevant code: `fields(n.applies_to,['atc'],['atc']`.

Observed: Sex and age are rejected as unknown fields.

Demonstration: `audit-A1` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### A2 — PRESENT

Location: `src/evaluator.js:10`. Relevant code: `if(n.applies_to.atc!==ctx.proposed_atc) continue;`.

Observed: Male child with pregnant=true receives a block.

Demonstration: `audit-A2` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### A3 — PRESENT

Location: `src/evaluator.js:25`. Relevant code: `const absent=Object.keys(n.when).filter(k=>ctx[k]==null).sort();`.

Observed: Male child without pregnancy status receives pregnant not recorded.

Demonstration: `audit-A3` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### A4 — PRESENT

Location: `ir/contraindication_example.ir.json:34`. Relevant code: `"atc": "J01XX01"`.

Observed: Pregnancy rule has only drug applicability.

Demonstration: `audit-A4` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### A5 — PRESENT

Location: `src/ir.js:40`. Relevant code: `if(n.type==='predicate')`.

Observed: No pregnancy sex restriction validation.

Demonstration: `audit-A5` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### B1 — PRESENT

Location: `src/workflow.js:26; src/emr.js:30; src/context.js:14`. Relevant code: `const ctx=buildContext(db.listForPatient(patientId,{upToSeq:draft.seq}),{today});`.

Observed: Workflow delegates to context, which ignores diagnoses. API reads diagnosis presence only.

Demonstration: `audit-B1` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### B2 — PRESENT

Location: `src/emr.js:28`. Relevant code: `if(!patientDiagnoses(store,db,id).length) throw new ApiError`.

Observed: HTTP 409 blocks check without diagnosis; workflow emits dose advice without indication warning.

Demonstration: `audit-B2` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### B3 — PRESENT

Location: `src/ir.js:39; src/evaluator.js:10`. Relevant code: `fields(n.applies_to,['atc'],['atc']`.

Observed: ICD-10 applicability rejected and ignored by evaluator.

Demonstration: `audit-B3` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### B4 — PRESENT

Location: `ir/dose_band_example.ir.json:34`. Relevant code: `"atc": "P01BF01"`.

Observed: No sample indication. Manually projected B50 rule warns for B50.9, J18.9 and missing diagnosis alike.

Demonstration: `audit-B4` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### B5 — PRESENT

Location: `src/events.js:36; src/context.js:14`. Relevant code: `!['suspected','confirmed'].includes(p.certainty)`.

Observed: Ruled-out cannot be entered; certainty ignored by context.

Demonstration: `audit-B5` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### B6 — PARTIAL

Location: `src/emr.js:28; public/emr.js`. Relevant code: `patientDiagnoses(store,db,id).length`.

Observed: UI submits diagnoses; API only gates their presence, without indication matching.

Demonstration: `audit-B6` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### C1 — PARTIAL

Location: `src/events.js:34`. Relevant code: `p.value<=0`.

Observed: 0 and -1 rejected, 500 accepted, 10 accepted; entry errors lack requested 422 limits.

Demonstration: `audit-C1` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### C2 — PRESENT

Location: `src/events.js:35`. Relevant code: `p.field!=='pregnant'||typeof p.value!=='boolean'`.

Observed: Male pregnancy accepted.

Demonstration: `audit-C2` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### C3 — PRESENT

Location: `src/events.js:35; src/workflow.js:14`. Relevant code: `{name:args.name,sex:args.sex}`.

Observed: Age not recorded; female age 10 cannot be distinguished. Sample range will be 12–50 (narrower than global 10–60).

Demonstration: `audit-C3` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### C4 — ABSENT

Location: `src/events.js:34-35`. Relevant code: `p.field!=='weight_kg'`.

Observed: Observation and status field allowlists already reject unknown fields.

Demonstration: `audit-C4` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### C5 — PRESENT

Location: `src/events.js:34-35`. Relevant code: `p.value<=0`.

Observed: No central data-quality limits or documentation.

Demonstration: `audit-C5` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### D1 — PARTIAL

Location: `scripts/prototype-flow.js:28; scripts/demo.sh:12`. Relevant code: `sex:'U'`.

Observed: Child age unspecified, weight 12; adult sex F but age missing. No child pregnancy in prototype flow; adult missing age will fail new guard. No patient seed data found.

Demonstration: `audit-D1` regression test (expected corrected behavior; pre-fix outcomes recorded above).

### D2 — PRESENT

Location: `scripts/prototype-flow.js:29; scripts/demo.sh:14`. Relevant code: `certainty:'suspected'`.

Observed: Prototype supplies diagnosis; CLI omits diagnosis but only shows dose warning, no indication warning.

Demonstration: `audit-D2` regression test (expected corrected behavior; pre-fix outcomes recorded above).


## Final original-task outcomes

| Checks | Before | Final |
|---|---|---|
| A1–A5 | PRESENT | Fixed |
| B1–B5 | PRESENT | Fixed |
| B6 | PARTIAL | Fixed |
| C1 | PARTIAL | Fixed |
| C2–C3 | PRESENT | Fixed |
| C4 | ABSENT | ABSENT before; unchanged allowlists |
| C5 | PRESENT | Fixed |
| D1 | PARTIAL | Fixed |
| D2 | PRESENT | Fixed |

### Verification and commits

All 18 audit-ID tests live in `test/audit.test.js`. They pass in the corrected tree. In an isolated archive of pre-fix `999dbd1`, A1–A5, B1–B6, C1–C3, C5 and D1–D2 fail; C4 passes. The only harness adaptation made for that archive is dynamically importing the new plausibility module inside C5 so its absence does not prevent all tests loading. Some failures occur at prerequisites: B2/B6/C2/C3 reject the newly supplied age at registration before reaching the later assertion; C1 fails at the original HTTP 400 rather than 422; C5/D2 find the new module/script absent. These are regression sensitivity checks, not claims that each downstream assertion was separately mutation-tested.

| Commit stage | Node 22.18 full suite | Skipped |
|---|---|---|
| Audit `58ae6ef` | 121/123 (two pre-existing URL-space failures) | 0 |
| Applicability `31acc4a` | 128/128 | 0 |
| Indication `3c8ac1d` | 134/134 | 0 |
| Plausibility `f48adc8` | 139/139 | 0 |
| Demo `ea7a583` | 141/141 | 0 |
| README/report | 141/141 | 0 |

Every suite includes the unchanged evaluator purity test. HTTP suites require execution outside the sandbox to bind loopback. No npm dependencies added. Node 18 remains unsupported as declared in package.json.

### Files changed and test corrections

- `src/ir.js`, `src/evaluator.js`: schema validation, pregnancy guard and applicability/indication evaluation. `src/compiler.js`: preserves applicability (already copied the full object), now requires applicable nonmissing indication fixtures for clinical coverage.
- `src/context.js`, `src/workflow.js`, `src/events.js`: demographic projection/entry, active diagnoses with certainty, plausibility validation; no ambient access added to evaluator.
- `src/emr.js`: removes the diagnosis-presence block, accepts age, checks published pregnancy ranges. `src/cli.js`: age registration option.
- `src/plausibility.js`: central data-quality bounds. `src/fixtures.js`: expanded context validation, applicability-aware independent oracle and generated contexts.
- `src/draft.js`: retains template applicability fields instead of discarding them. This prototype still uses human-authored placeholder templates; applicability must be reviewed with each draft.
- `src/server.js`: decodes static public file URL with fileURLToPath to resolve the pre-existing workspace-space failure.
- `public/emr.html`, `public/emr.js`: age entry, certainty entry/display, and accurate missing-indication wording.
- `ir/contraindication_example.ir.json`: only applicability added (`sex: F`, age 12–50). `ir/dose_band_example.ir.json`: only applicability added (`icd10: B50`). Clinical values and placeholder flags unchanged.
- `fixtures/*.fixtures.json`, `samples/dose-guide/bundle.json`: female adult applicability and confirmed indication contexts. Added audit tests exercise missing inputs, exclusions, certainty and API behavior.
- `test/helpers.js`, `test/prototype/support.js`, `test/prototype/fixtures.test.js`, `test/prototype/release.test.js`, `test/prototype/e2e.test.js`: supply adult demographics/confirmed indications to existing scenarios that intend an applicable clinical check.
- `test/prototype/emr.test.js`: old 409/no-prescription assertion encoded defect B2; replaced with successful recorded prescription plus visible no-indication warning and adjusted event counts. Added adult age; diagnosis certainty confirmed for dose scenario.
- `test/workflow_end_to_end.test.js`: fileURLToPath fixes CLI test path; no assertion weakened.
- `scripts/demo.sh`, `scripts/demo-flow.js`, `scripts/prototype-flow.js`: realistic separate scenarios and explicit no-indication advice. Demo creates temporary databases and cleans them up.
- `README.md`, `AUDIT.md`: decisions, guards, evidence and outcome report.

No browser interaction/visual QA performed; API, static UI assertions and both executable demo paths are tested. No real clinical source validity is asserted. The narrower sample pregnancy range is placeholder applicability, not clinical guidance.

## Terminology

### Scope and final behavior

The user added terminology validation, then clarified that mock rule data must be present in the PDF and that the PDF should contain guideline material only. The final shipped source contains malaria, pneumonia and pregnancy sections, including the actual indication/drug identifiers and pregnancy age/sex scope. Patient scenarios and software instructions are excluded. The EMR automatically selects rules from patient data; no clinician chooses individual rules.

- `terminology/icd10-seed.json` preserves the requested 12-entry placeholder subset; `terminology/README.md` explains its status. `src/terminology.js` strictly rejects unknown fields, duplicate codes, missing metadata and empty labels, and supplies exact lookup, prefix lookup and labels.
- `src/ir.js` takes a terminology argument; unknown prefixes name both node and prefix. `src/compiler.js` validates against the supplied terminology, records its version in the signed manifest, and refuses unresolved prefixes. Terminology-change warnings cannot establish positive clinical fixture coverage.
- `src/workflow.js`, `src/events.js`, `src/emr.js` reject unknown diagnosis codes with HTTP 422. Events retain canonical `label`, entered text as `label_entered` when different, `system`, and `terminology_version`; response warnings are separate from stored event shape. The EMR displays those response warnings.
- `src/context.js` carries each active diagnosis's version and a `terminology_changed` flag. `src/evaluator.js` warns and defers indication evaluation across version changes, retaining purity. `src/package.js` requires a release terminology version and structurally validates signed rules without reinterpreting their prefixes against a different installed seed. Replay uses the exact recorded package version.
- `src/fixtures.js` accepts versioned known diagnosis contexts and generates exact known codes from the seed. Authored fixture validation keeps clinical input failures separate from applicability exclusions.

### Code literal audit

No quoted ICD-10 literal existed in `src/` before the terminology work, and none exists now (`test/terminology/no_literals.test.js` recursively checks). Generic validation patterns are logic; specific codes remain data. Existing script literals in `scripts/demo-flow.js` and `scripts/prototype-flow.js` were moved to `samples/dose-guide/bundle.json` (`demo_diagnoses`). The PDF generator also reads its diagnosis data from that bundle. IR examples, fixture contexts and tests intentionally contain code values. No code-specific branch was added to an evaluator, compiler, context, workflow or API module.

### Existing diagnosis data

The old implementation accepted arbitrary nonempty diagnosis strings. Before this change, `test/prototype/emr.test.js` explicitly entered the unknown value `PLACEHOLDER`, and the adult case used a code absent from this subset; those tests now use known seed codes. The former acceptance is replaced by explicit unknown-code rejection tests, not ignored.

Read-only inspection of `data/prototype-demo/clinical.db` found **5 diagnosis events, 0 codes outside the new seed, and 5 events lacking terminology_version**. This count was checked again after implementation. Existing append-only events were not rewritten. All five require a visible version-change warning in a current indication check. The saved database was not migrated or cleared. Old versionless releases cannot be silently upgraded to this schema; a new reviewed release is required.

### Unverified seed labels

All supplied labels remain unverified against WHO ICD-10:

- Plasmodium falciparum malaria, unspecified
- Unspecified malaria
- Infectious gastroenteritis and colitis, unspecified
- Tuberculosis of lung, confirmed by sputum microscopy
- Human immunodeficiency virus [HIV] disease
- Pneumonia, unspecified organism
- Acute upper respiratory infection, unspecified
- Type 2 diabetes mellitus without complications
- Essential (primary) hypertension
- Severe pre-eclampsia
- Supervision of normal pregnancy, unspecified
- Fever, unspecified

No clinical code or chapter taxonomy was inferred. Chapter markers were preserved exactly as supplied; they are not asserted to be authoritative WHO chapter identifiers. Diagnosis lookup is exact and case-sensitive. Prefix matching includes the literal dot; no dot stripping, case normalization or remapping is performed. Only confirmed/presumptive, non-retired diagnoses are active indications. Ruled-out and suspected entries never match. Missing or different version metadata triggers a warning rather than reinterpretation.

### Source and sample changes

- `samples/dose-guide/placeholder.pdf`: regenerated as a one-page guideline-only placeholder, retaining the original malaria weight bands/values. Added explicit malaria/pneumonia indications, ATC identifiers, pregnancy scope and a new pneumonia table (5 to <35 kg, 2 placeholder tablets). The new table does not alter any existing clinical value.
- `samples/dose-guide/source.json`: authoring source for that guideline. `scripts/generate-sample-pdf.py` generates the PDF, SHA-256, matching mock fixture and source-dependent fixture IDs. Repeating generation produces the same PDF hash.
- `fixtures/digitised/2ce9a9487071a28139cb62e4edfd178e3294c89a3ac75ca88bba891db3839497.json`: exact source blocks `b1` malaria, `b2` pregnancy, `b3` pneumonia. Replaces the old two-block fixture for the old PDF checksum. Mock digitisation remains a fixture lookup rather than OCR.
- `src/draft.js`: reads explicit ATC, ICD-10, sex and inclusive age annotations from source text. Generic source tables never inherit an indication from a sample template. Conflicting supplied/source ATC codes leave visible parser errors. The earlier template-applicability copying approach is superseded by source-grounded parsing.
- `ir/dose_band_example.ir.json`: original bands unchanged; malaria prefix remains. `ir/contraindication_example.ir.json`: female/12–50 applicability remains. `ir/pneumonia_dose_example.ir.json`: new separate placeholder pneumonia rule matching the PDF's second table.
- `samples/dose-guide/bundle.json`: matching checksum, fixtures for all three source rules, versioned diagnosis contexts and data-only demo diagnoses. The refreshed curl demo uses `poc-demo-0.2.0`, preserving prior signed releases.
- `fixtures/indication.fixtures.json`: all five requested indication cases (correct/wrong malaria dose, unrelated pneumonia, ruled-out malaria, no diagnosis). The final two assert visible no-indication warnings; neither is treated as clinical dose advice. `fixtures/pneumonia_dose_example.fixtures.json`: second rule positive/negative cases.
- `public/review.js`: preserves applicability on save, provides sex/age/indication fields in authoring, and preserves versioned diagnoses in fixture edits. Sex belongs under applies_to rather than when. The screenshot-related invalid state can be corrected through an audited edit; prior approvals reset and two reviewers are still required. Existing saved pregnancy draft was already correct when inspected and was not altered.
- `src/server.js`: consistently decodes default local data/key/public file URLs, fixing workspace names containing spaces.

### Tests, compatibility and limitations

All requested terminology test files are present under `test/terminology/`: `seed_loads`, `no_literals`, `ir_icd_prefix`, `diagnosis_api`, `terminology_version`, `indication_fixtures`, and `release_terminology`. They verify unknown codes, labels/metadata, low-level entry rejection, unresolved compile prefixes, all five fixture cases, cross-version warnings and exact replay. Added source tests ensure PDF authoring data equals mock block data and all three rule scopes are parsed without manual mapping. Generic draft tests ensure absent source scope is never invented.

Existing tests were updated only to supply the newly required terminology versions in synthetic contexts, use known codes where entry succeeds, and account for three source blocks rather than two. The old unknown-code acceptance test now uses a known code for its success path; dedicated rejection tests cover the corrected behavior. Helper HTTP fixtures explicitly add synthetic test scopes only where their generic mock source omits them; shipped-PDF tests read applicability directly from the source. No existing assertion was weakened or skipped.

PDF QA: generated and inspected the final rendered page; verified one page, all source text and table cells via pypdf extraction, and no patient scenarios/software implementation sections. No live browser interaction or WHO label verification was performed. Production signed terminology distribution remains outside this prototype. No npm dependencies were added; Python/ReportLab is authoring-time tooling only.

| Additional commit stage | Full Node 22.18 suite after commit | Skipped |
|---|---|---|
| Review form `541aac1` | 142/142 | 0 |
| Seed/loader `7d295c4` | 144/144 | 0 |
| Validation/versioning `33fd8b0` | 150/150 | 0 |
| PDF/source/sample alignment `cffe2b6` | 154/154 | 0 |
| Versioned fixture coverage/demo identity `d835311` | 155/155 | 0 |
| Final README/report | 155/155 | 0 |

Every suite includes the unchanged evaluator purity test. Both standalone and curl-driven demos run in regression tests, including a missing-indication warning, child dose correction, adult pregnancy block and replay.

## Public repository preparation

The README now leads with the MaHIS problem statement, distinguishes the implemented proof of concept from future programme integration/distribution, and removes machine-specific setup paths. Sample mirror files and their documentation match the current guideline PDF and fixtures. ATC prescription entry now rejects labels such as `ATC J01XX01` with HTTP 422 rather than silently finding no rule; the exact `J01XX01` code still produces the applicable pregnancy advice. Regression coverage verifies no partial events on rejected entry. Full suite: 156 passing, zero skipped. Local databases and signing keys remain ignored and are not part of tracked history.
