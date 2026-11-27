**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Data quality

`src/inputs.js` loads placeholder limits and field definitions from `samples/data-quality.json` and `samples/triage/entry-guards.json`. Entry checks are separate from rule interpretation. Generic observations also check the selected signed release's declared domains. Registered types can supply additional input definitions without new endpoints.

`src/plausibility.js` defines entry guards, separate from clinical rule content. They reject implausible recorded data with HTTP 422 and a field/limit message; these bounds are not clinical limits or dosing recommendations. Age is optional at registration and stays null when missing. Recording pregnancy true requires eligible recorded sex and age. The status API uses pregnancy ranges from the explicitly selected, verified release (`release_version`), rather than scanning historical releases. The EMR submits its selected release. With no release supplied, workflow/CLI use the sample pregnancy rule as the documented demo fallback. An unverifiable selected release still fails closed; an unrelated historical release does not block status entry. False pregnancy status remains recordable without inferring eligibility. Unknown observation/status fields remain rejected by the existing event allowlists.



Respiratory rate 100 satisfies the inclusive entry guard when no release is supplied, but fails the sample rule's exclusive upper bound when that release is selected. The generic assessment itself also reports invalid input without an outcome. No input is clamped. These ranges are invented demonstration data, not validated clinical limits.

Blank fields remain not recorded; zero is an explicit value. The UI generates fields from API definitions. Unknown fields and malformed values return 422. Null is permitted only for declared nullable proposal fields. Pregnancy true also checks recorded patient eligibility and selected-release applicability.
