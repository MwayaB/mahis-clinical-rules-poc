# Placeholder guideline sample

All clinical values are placeholders, not clinical guidance.

- `placeholder.pdf` contains guideline content only: malaria and pneumonia indications and dose tables, plus a pregnancy restriction on page 1, and the adult triage scoring chart on page 2. It includes the drug identifiers and applicability used by the rules.
- `source.json` is the digitised authoring data; the triage scoring values come from `ir/triage_example.ir.json`. `scripts/generate-sample-pdf.py` rebuilds the PDF and its content-addressed mock fixture with ReportLab.
- `digitisation.json` mirrors the matching fixture in `fixtures/digitised/`. This is a human-authored mock, not OCR or PDF extraction.
- `bundle.json` contains metadata, source-matching fixtures and demo diagnosis data. `sample-fixtures.json` mirrors its fixtures.

Drug drafting reads explicit applicability from the source text. Create drafts automatically includes the explicitly authored sample triage mapped to block b4. Verify, approve and save fixtures for all four rules before creating one combined release. This mapping applies only to the exact shipped mock source; arbitrary chart text is not interpreted as scoring logic. The EMR selects approved rules automatically from patient data. Run `bash scripts/prototype-demo.sh` for the complete API flow, or follow the root README for the review and release UI.
