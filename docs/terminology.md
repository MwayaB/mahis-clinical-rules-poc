**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Terminology

`terminology/icd10-seed.json` is a strict, versioned placeholder subset. Every seed label is **unverified**, and its chapter markers are supplied data rather than validated WHO chapter identifiers. Production terminology must come from a versioned, signed bundle; that distribution mechanism is not implemented here.

Diagnosis entry requires an exact known code, stores its canonical seed label, `system` and `terminology_version`, and preserves a differing user label as `label_entered` with a response warning. No code normalization or silent remapping occurs. IR indication prefixes must resolve against the compiler's supplied terminology. The signed manifest records that version. Context retains each active diagnosis's recorded version and flags changes; the evaluator warns and defers indication-dependent checks when versions differ. Runtime package validation preserves the signed release version rather than resolving its prefixes against a newer installed seed.

Legacy diagnosis events without version metadata remain unchanged and produce terminology-change warnings during current indication checks. Existing versionless packages are not silently upgraded; create a new reviewed release. Prefix matching is case-sensitive on the full code string, including the dot. `suspected` and `ruled-out` diagnoses never establish an indication.
