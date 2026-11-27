**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Decisions

## Shared guarantees

- Applicability-skipped nodes produce no envelope and no event. Known drug, age, sex, diagnosis or population exclusions skip silently; unresolved applicability inputs remain incomplete.
- Every evaluated node produces one recorded envelope, including incomplete and invalid inputs. No outcome exists until all required inputs are valid.
- High-risk content requires two distinct ledger reviewers; other content requires one. Edits and rejections reset evidence. IR display metadata never authorizes compilation.
- Fixture kinds are explicit authored evidence. Each type declares its required kinds and validates eligible evidence. Triage also requires coverage of each declared category. Generated boundaries supplement authored coverage.
- Unknown fields are rejected by shared schema checks and type validators. Type modules are pure; clinical constants live in authored data.

## Packages and replay

- Canonical JSON rejects undefined, non-finite numbers, cycles and non-plain objects. Arrays preserve order; object keys are canonical.
- Ed25519 signs a manifest pinning rule bytes. Releases are immutable and published by staging then rename. Crash durability/fsync is not claimed.
- Type names and versions are signed. Historical manifests without a types list remain readable for retained package compatibility.
- Replay uses the original package, input cutoff, evaluation date, population and scope; it compares the full result and fingerprint. Later corrections do not alter that snapshot.
- Historical event upcasting happens on read, preserving stored bytes and sequence references. See the [refactor report](refactor/REPORT.md).

## Dosing and input semantics

- Dosing coverage is half-open `[min,max)`. Adjacent bands must cover exactly without gaps or overlaps. Inclusive maximum coverage is not expressible in this prototype.
- Confirmed and presumptive diagnoses establish indications; suspected and ruled-out diagnoses do not. ICD prefix matching is case-sensitive, including dots. Missing indications remain visible; unrelated active diagnoses skip.
- The deprecated prescription wrapper preserves the original advice shape, synthetic missing-drug warning, severity ordering and retained prescription behavior. It delegates evaluation and recording to the shared flow and retains legacy receipt events for clients.
- Generic assessments use `incomplete` or `invalid` for bad inputs. The wrapper translates those to its historical warning advice.
- Sequence order selects the latest non-superseded observation. Corrections cannot cross patients, types, fields or encounters. Supersessions are interpreted only within the replay cutoff.
- Overrides append a reasoned action against an original assessment sequence; they do not edit or manufacture an outcome. Current observations must be assessed first.

## Scope and trust

Reviewer strings are audit labels, not authenticated people. Population is explicitly selected at encounter creation. This prototype establishes neither production governance nor clinical validity. Colours are fixed presentation mappings, not a clinical ranking calculation.
