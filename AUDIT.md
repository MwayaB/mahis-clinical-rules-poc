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
