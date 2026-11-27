**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Scored triage implementation

The adult-only sample declares two scoring inputs: respiratory rate and AVPU. All five supplied vital fields can be recorded; only declared parameters contribute. The sample's numbers, category names and priorities are invented. A child is never scored using this adult chart. Population classification is explicit and not inferred from age.

The pure triage type validates numeric bands, ordinal levels, points, score bands and priority overrides. The shared evaluator checks applicability, required inputs and domains before invoking it. A completed result uses `status: ok`, `outcome: {category}` and payload score, components and overrides_fired. Missing inputs return `incomplete`, invalid input returns `invalid`; neither has a score or category.

The same review event ledger, required fixture-kind gate, compiler, package verifier, assess endpoint, event writer and replay implementation serve every type. A clinician override uses a declared category and a nonempty reason in a separate linked event; original data remain unchanged.

The combined two-page [placeholder guideline](../samples/dose-guide/placeholder.pdf) contains drug and pregnancy guidance on page one and triage scoring on page two. Mock digitisation and checksum-matched authored mapping create all four cards together. Review exposes triage inputs, bands, ordinal points, categories, approvals and fixtures. Arbitrary PDFs require manual authoring; no rules are extracted automatically.

The unified Assessment panel displays API results with fixed category colours, score and component table. Incomplete/invalid results have no category styling or score. All type results remain separate; the UI does not calculate a highest category. Changes to observations clear current results until reassessment.

Not covered: real-chart parameters, paediatric variants, Ministry-approved colours, automatic population selection, clinical validation, real programme integration or governance. Historical implementation evidence is preserved under [refactor history](refactor/history/TRIAGE.md); historical routes there have been superseded by the [generic API](api.md).
