# Human-authored placeholder sample bundle

Every clinical value, ATC code, statement and expected outcome here is a placeholder, not clinical guidance. Generated draft nodes are explicitly marked `placeholder: true`; their human-authored templates are in `ir/`.

- `placeholder.pdf` contains the required disclaimer, not medical recommendations. Its exact bytes select the fixed fixture by SHA-256.
- `digitisation.json` is a hand-authored mock, not content extracted from the PDF. The one matching fixture is also shipped under `fixtures/digitised/<sha256>.json`.
- `bundle.json` provides explicit sample document metadata, reviewer-supplied ATC suggestions and authored fixture entries bound to the sample source/node IDs.
- `sample-fixtures.json` is the same authored fixture list on its own.

The pregnancy paragraph is deliberately unqualified. A first-trimester qualifier cannot be represented using only a boolean pregnancy field. Qualified paragraphs produce parse errors instead of a misleading all-pregnancy rule. A human reviewer must explicitly edit that mapping before approval.

Use `bash scripts/prototype-demo.sh` for the API flow. For the UI flow, choose Upload sample PDF, then Inspect blocks. Run mock digitisation, continue to review, use sample ATC mapping, create drafts, review/edit, approve with two distinct IDs, load/save sample fixtures per node, release, and open EMR demo. Manual entries are user-authored; the application invents no clinical recommendations.
