**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Design

## One assessment flow

Source PDF → mocked/manual digitisation → authored nodes → review event ledger → authored fixtures → compile and sign → verify package → assess → append events → replay.

The shared evaluator first applies scope and applicability, then collects each type's declared inputs. Missing inputs produce `incomplete`; invalid inputs produce `invalid`. Neither has an outcome. Complete valid inputs alone reach a type evaluator. Each returned envelope is recorded atomically with the release identity, context cutoff, package fingerprint and input hash. Known applicability exclusions are skipped without results or events.

`src/types/registry.js` exposes `registerType` and `getType`. Definitions provide version, node kinds, fields, validate, serialise, requiredInputs, evaluate, requiredFixtureKinds, scope and renderer. Optional fixtureVariants and eligibleFixtureKinds establish evidence; allowedActions constrains overrides. The two pure type modules own dosing and scored-triage logic. New types need a definition, registration and tests; routes and events remain shared. Registry registration returns a cleanup function for isolated plug-in tests.

The compiler dispatches through the registry. `approval.js` derives approval from the append-only `review_events` ledger against current content hashes. IR status and reviewers are display metadata. `compiler.js` runs shared/type validation, ledger approval and fixture-kind coverage before staging and signing. The manifest lists registered type names and versions. Unknown node fields, kinds and nested fields are rejected.

`assessment.js` owns result recording and replay. `encounters.js` owns generic input writes and reasoned overrides. `server.js` routes and enforces request boundaries. `public/assessment.js` displays envelopes using renderer hints without calculating clinical outcomes. `public/review-controls.js` shares visible approval evidence and fixture panels across review cards.

## Storage

Ignored `data/` holds `prototype.db` (sources, block records, node revisions, review events, authored fixtures, releases and patient index), `clinical.db` (append-only patient/encounter events), `sources/<sha256>.pdf` and `releases/<version>/`. Development private keys remain in ignored `keys/`. The repository contains only a public key with the historical compatibility fixture.

Compiled packages contain canonical `rules.json`, signed `manifest.json` and `manifest.sig`. Applying verifies signatures, fingerprints, schemas and supported type versions before returning immutable state. Retain historical packages and trusted public keys for replay. There is no distributed installation or archive service.

## Review screen

Every card shows its approval count, required count and reviewer identities for the current content hash, with approve/reject controls. Fixture sections open by default for every type. Dosing retains structured fixture editing; other types use JSON. Loading sample fixtures does not save them: inspect and explicitly save for the current revision. An edit invalidates earlier approvals and fixture attachment.
