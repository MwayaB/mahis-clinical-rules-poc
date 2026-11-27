**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Validation evidence

The pre-refactor baseline was 223 passing tests. The shared guarantees checkpoint passed 262 tests. The generic API, event upcast and unified assessment panel checkpoint passed 267 tests with no skipped tests. Final counts and demonstration evidence are recorded in the [refactor report](refactor/REPORT.md).

Tests use Node's built-in runner, SQLite and HTTP server without npm dependencies. Shared registry-driven cases cover envelopes, applicability, missing/invalid input, ledger approvals, fixture kinds, recording, reasoned overrides and replay. Type tests exercise dosing boundaries, triage bands/ordinal levels and priority behavior. DOM-surface tests check output presentation; HTTP tests check server integration.

The historical database fixture contains the previous event names and an actual signed package with a public key. Tests copy the fixture, upcast on read, replay both states and verify original rows remain unchanged. A temporary dummy registered type demonstrates shared compile/evaluate/record/replay behavior with no extra route or event name.

Documentation checks cover README length/order, links, API/router parity, retired names, placeholder notices and npm command existence. Purity and no-literals checks continue to run with the full suite.

The demo exercises the generic assess endpoint for dosing and adult triage, including incomplete, scored, overridden and replayed states. It retains signed releases and event history. No real clinical accuracy, patient outcome, production security, facility sync or programme integration has been validated.

Browser access was unavailable during this refactor; automated DOM and HTTP checks are the UI evidence. Historical manual evidence remains in the [archived validation](refactor/history/VALIDATION.md) and [prototype audit](refactor/history/PROTOTYPE-VALIDATION.md).
