**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Audit record

The original defect audit and test evidence are preserved in the [historical audit](../refactor/history/AUDIT.md). Its old endpoint descriptions are historical, not the current API.

The current refactor inventory identifies duplicated assessment paths and approval reads before changes. The [refactor report](../refactor/REPORT.md) documents replacements, test changes and compatibility handling. Runtime approval now comes solely from the review ledger; display metadata cannot authorize a release.

Limitations remain: local audit labels are unauthenticated, chart values are invented, uploaded PDFs are not interpreted, historical packages and keys must be retained, and there is no clinical validation or production deployment claim.
