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

