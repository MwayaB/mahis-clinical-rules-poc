# End-to-end prototype validation

Verified Node v22.18.0 and built-in `node:sqlite.DatabaseSync` before extending the repository. No npm dependencies were added. The pure evaluator is unchanged from the original PoC.

| Extension stage | Full suite passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Source registry and upload | 102 | 0 | 0 |
| Mock digitiser and manual blocks | 104 | 0 | 0 |
| Deterministic drafts | 108 | 0 | 0 |
| Review approvals and immutable history | 111 | 0 | 0 |
| Authored fixture gate and generated boundaries | 113 | 0 | 0 |
| Verified append-only releases | 115 | 0 | 0 |
| EMR service and thin HTTP routes | 120 | 0 | 0 |
| Vanilla UI pages | 121 | 0 | 0 |
| Sample bundle, demo, diagnosis prerequisite and corrected separate-patient cases | 123 | 0 | 0 |

The full suite was run after every stage and the stage was committed. The ninth stage includes the user's follow-up corrections: pregnancy uses a separate explicitly adult placeholder, weight is labelled in kg, and a coded diagnosis is required by the EMR before a prescription check.

## Automated results

`npm test` exits 0 with 123 passing tests and no skips. Full output: [results/prototype-tests.txt](results/prototype-tests.txt).

The main e2e test starts on an ephemeral loopback port, uploads the actual shipped PDF, loads the single matching mock fixture, supplies ATC mappings, records distinct reviewer approvals, saves authored fixtures, creates a fresh signed release and checks EMR advice and replay over HTTP. Separate service tests exercise the shipped bundle without HTTP. Other tests cover non-PDF/oversized uploads, idempotence, metadata gates, the manual fallback API, parse errors, unknown fields, fixture staleness, duplicate and whitespace-equivalent reviewers, edit resets, release immutability, wrong keys/tampering, loopback-only binding, traversal and private-key refusal, visible missing inputs and the original purity contract.

The EMR test proves that a missing coded diagnosis returns 409 and creates no prescription event. After a diagnosis is recorded, missing weight remains a visible warning. Adult pregnancy advice is checked on a separate patient and still records the prescription. ICD catalogue membership and drug–diagnosis compatibility are not claimed or tested.

## API demo

`bash scripts/prototype-demo.sh` completed successfully, printing each curl-driven API result and the browser URLs. The final corrected run retained the already-created immutable sample release, then created separate dose and adult-pregnancy patients, recorded coded diagnoses, asserted a warning at placeholder 12 kg / 2 tablets, no advice at 10 kg / 1 tablet, successful replay, and recorded block advice for the separate adult. New release creation is independently exercised from an empty store by the shipped-bundle e2e/service tests.

Captured output: [results/prototype-demo.txt](results/prototype-demo.txt). The server is retained in an active execution session at `http://127.0.0.1:8080`; the script prints its PID and saves it under ignored `data/prototype-demo/server.pid`.

## Browser checks

Observed the complete UI flow: sample upload, checksum/status table, `mock-fixture` cards, source page/bbox/table, sample ATC mapping, draft creation, release refusal before approval, first approval, edit resetting that approval, two distinct approvals on both nodes, release refusal before fixtures, authored fixture loading/saving, and successful signed release.

Observed the EMR missing-value badges, kg display, warning and no-advice cases, exact replay match, and red hard-stop text explicitly confirming the prescription was recorded. After feedback, observed refusal without an ICD-coded diagnosis and successful checking on the separate coded adult pregnancy example. The initial child-labelled test record was corrected via a superseding status event without deleting its audit history. Both the narrow and wide layouts were inspected using the browser's normal viewport. Final screenshot: [results/prototype-ui.jpg](results/prototype-ui.jpg).

The placeholder PDF was rendered with Poppler and visually inspected: disclaimer and explanatory text are legible and unclipped. The development renderer emitted local fontconfig cache warnings; these did not affect the PDF or application.

These checks verify the prototype's software behavior only. All clinical examples and outcomes are placeholders, not clinical guidance. No clinical validation, real OCR, LLM, authentication, terminology catalogue, FHIR, CDS Hooks, sync, concurrency or production deployment has been added.
