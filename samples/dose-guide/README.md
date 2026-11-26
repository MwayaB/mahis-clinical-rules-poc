# Placeholder guideline sample

All clinical values are placeholders, not clinical guidance.

- `placeholder.pdf` contains guideline content only: malaria and pneumonia indications and dose tables, plus a pregnancy restriction. It includes the drug identifiers and applicability used by the rules.
- `source.json` is the authoring data. `scripts/generate-sample-pdf.py` rebuilds the PDF and its content-addressed mock fixture with ReportLab.
- `digitisation.json` mirrors the matching fixture in `fixtures/digitised/`. This is a human-authored mock, not OCR or PDF extraction.
- `bundle.json` contains metadata, source-matching fixtures and demo diagnosis data. `sample-fixtures.json` mirrors its fixtures.

Drafting reads explicit applicability from the source text. The EMR selects approved rules automatically from patient data. Run `bash scripts/prototype-demo.sh` for the complete API flow, or follow the root README for the review and release UI.
