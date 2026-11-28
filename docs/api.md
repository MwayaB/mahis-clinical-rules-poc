**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# API reference

All routes are loopback-only and same-origin. JSON mutations require `Content-Type: application/json`. Upload requires raw `application/pdf` bytes (25 MiB maximum); JSON is limited to 2 MiB. Unknown body fields/query parameters are rejected. `X-User` is an unauthenticated audit label. Errors use `{error}`: bad request 400, data-quality errors 422, conflicts 409, missing resources 404, oversized requests 413 and wrong media types 415.

## Routes

| Method | Path | Body / purpose |
| --- | --- | --- |
| GET | `/api/guidelines` | List uploaded source records |
| POST | `/api/guidelines` | Raw application/pdf; filename and document_id query parameters |
| GET | `/api/guidelines/:sha256` | Read source metadata |
| POST | `/api/guidelines/:sha256/metadata` | {edition} |
| POST | `/api/guidelines/:sha256/digitise` | {}; mocked digitisation |
| GET | `/api/guidelines/:sha256/blocks` | List source blocks |
| POST | `/api/guidelines/:sha256/blocks` | {page,bbox,text,cells?}; manual block |
| POST | `/api/guidelines/:sha256/draft` | {atc_by_block}; generate drafts |
| POST | `/api/rules/import` | {document_sha256,node,block_id?}; authored rule draft |
| GET | `/api/ir` | document query parameter; drafts and ledger-derived approval evidence |
| POST | `/api/ir/:id/edit` | Type-declared editable fields; resets approvals |
| POST | `/api/ir/:id/approve` | {reviewer}; approval bound to current hash |
| POST | `/api/ir/:id/reject` | {reviewer,reason} |
| GET | `/api/ir/:id/history` | Revision and decision ledger |
| POST | `/api/ir/:id/checks` | {}; run automated checks and attach pre-authored checks for unchanged shipped sample drafts |
| GET | `/api/fixtures` | node query parameter |
| POST | `/api/fixtures` | {node_id,entries}; attach to current content hash |
| GET | `/api/releases` | List immutable releases |
| POST | `/api/releases` | {document_sha256,version}; shared validation, approval, fixture and signing gate |
| GET | `/api/assessment/config` | Optional release_version query; fields, populations, nodes, actions |
| POST | `/api/encounters` | {patient_id,population}; opens encounter |
| GET | `/api/encounters/:id` | Context, current per-node results and event history |
| POST | `/api/encounters/:id/observations` | {field,value,supersedes?,release_version?}; entry and selected-release domain checks |
| POST | `/api/encounters/:id/assess` | {release_version}; results and one event per applicable node |
| POST | `/api/encounters/:id/assess/:seq/override` | {node_id,action,reason}; separate reasoned event |
| GET | `/api/patients` | List placeholder patients |
| POST | `/api/patients` | {name,sex,age_years?} |
| POST | `/api/patients/:id/observations` | {field,value,supersedes?}; compatibility patient observation |
| POST | `/api/patients/:id/status` | {field,value,supersedes?,release_version?} |
| GET | `/api/patients/:id/diagnoses` | Active diagnoses |
| POST | `/api/patients/:id/diagnoses` | {icd10,label,certainty?} |
| POST | `/api/patients/:id/prescriptions/check` | DEPRECATED compatibility wrapper: {atc?,tablets?,release_version}; preserves advice shape |
| GET | `/api/patients/:id/events` | Read append-only history |
| GET | `/api/patients/:id/context` | Read patient context |
| POST | `/api/events/:seq/replay` | {}; replay assessment or compatibility advice receipt |
| GET | `/api/sample-bundle` | Shipped placeholder source, authored rules and fixtures |

## Assessment result

Each applicable node returns `{node_id,node_type,status,missing,invalid,payload,package_version,engine_version,inputs_hash}`. The hash is prefixed `sha256:`. Status is `ok`, `advice`, `incomplete` or `invalid`. Only `ok` and `advice` have `outcome`. Dosing outcome is `{items:[{rule_id,severity,message,source_ref}]}`; triage outcome is `{category}`. Payload carries renderer/actions plus matched bands or score/components. Missing and invalid results never carry score, components, category or outcome. Known applicability exclusions produce no result/event.

The assess response is `{results,events}`. One `assessment-recorded` event is appended per result. Scope is all applicable registered types; encounter inputs do not leak into other encounters. The recorded context cutoff, date, population, package fingerprints and full result pin replay. The encounter read endpoint returns `current` entries with `{result,event,actions}`; new observations clear current results until assessment.

`assessment-overridden` references `assessment_seq` and `node_id`. Dosing actions are `accepted`/`overridden`; triage actions come from the node's declared category order. Reason must be nonempty. An override cannot change the original envelope or turn incomplete/invalid data into a clinical outcome. Observation changes require a new assessment.

The deprecated prescription wrapper uses the same shared assessment/recording flow for patient-scoped dosing nodes, translates results into its historical `{advice,...}` response and retains prescription/receipt events. New clients should use encounters and assess. Historical result compatibility is documented in the [refactor report](refactor/REPORT.md).

## Fixtures and review

The clinical review UI shows a read-only automated-check summary and optional technical details. Clinicians do not load, save or author test cases. The following fixture API remains available to rule authors and engineers.

Fixture entries require `name`, `ctx`, `expect` and explicit `kinds`; optional `scope` and `node_id` target evidence. Release requires fresh authored fixtures with all type-required kinds. Approval evidence is read from review_events against current content, not IR status/reviewers. Generic rule import creates drafts only.

## Static presentation

The server serves an explicit file allowlist for the guideline, digitisation, review and EMR pages, browser modules, styles and placeholder PDF copies. These are presentation assets, not API routes. There is no arbitrary filesystem download endpoint.
