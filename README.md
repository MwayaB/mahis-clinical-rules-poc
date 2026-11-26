# Clinical rules pipeline proof of concept

All clinical values, drug codes, messages, source excerpts, patients and reviewer IDs are **placeholders, not clinical guidance**. This is a software demonstration only.

Requires Node >=22 with built-in `node:sqlite`; no npm dependencies.

## Decisions

- JSON is restricted to finite numbers and plain JSON structures; invalid values fail closed.
- Requirements and validation results are documented as implementation proceeds.
