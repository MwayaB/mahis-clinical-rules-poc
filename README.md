# Shared clinical guideline rules for MaHIS

A proof of concept for authoring and reviewing guideline rules once, then using the same signed rules and evaluator across programme systems.

## Placeholder notice

Every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, **not clinical guidance**. This local prototype has no authentication or clinical validation. PDF digitisation is mocked.

## Problem statement

Malawi's national clinical guidelines are shared across programmes. Antiretroviral therapy, tuberculosis, antenatal care, immunisation, child health and non-communicable disease care all draw on common rules for dosing, contraindications, triage and follow-up. In practice, each programme encodes these rules separately, in its own system, from its own reading of the guideline document. The same weight-band dose table can exist in several places, each maintained by a different team, and each updated on a different schedule.

The *Concept of MaHIS* describes programme-specific systems as the historical pattern. The HIV ART electronic data capture system, first piloted by implementing partners, became a point-of-care record in 2012, and programme modules have grown around it. The concept's business-logic layer calls for guidelines, protocols and procedures to be “strictly adhered to”, but it does not say where that logic lives, who owns it, or how it reaches each programme. The result is that the same clinical rule can be correct in one programme, out of date in another, and undetectable as a discrepancy because no one compares them.

This produces three problems for the Ministry:

1. **Duplicated effort.** Each programme pays to re-author and re-test rules that another programme already has, and does so in different tools.
2. **Divergence.** When a guideline changes, updates reach programmes at different times, or not at all. Two patients with the same weight and diagnosis can receive different advice depending on which programme they are registered in.
3. **No single record of what the rule was.** When advice is questioned, there is usually no way to establish which version of a rule produced it, who approved that version, or whether other programmes were using the same one.

This project asks whether guideline rules for MaHIS can be authored and reviewed once, compiled into signed and versioned packages, and consumed by each programme and each facility node through the same evaluator, so that a rule change is made once, propagates to every programme, and leaves an auditable trail.

## Summary

The prototype takes human-authored guideline content through review, hash-bound approvals, fixture checks and signed, versioned releases. One generic assessment flow evaluates weight-based dosing, pregnancy contraindications and scored triage in a simulated EMR. It selects applicable rules from recorded facts, records every result and can replay it with the exact historical package.

Every registered type uses the same approval, input validation, recording, override and replay guarantees. Missing or invalid inputs produce no outcome. A reasoned override is a separate event that retains the original assessment.

It does not integrate existing programme systems, extract rules from real PDFs, distribute packages to facilities, establish Ministry governance, or validate clinical advice or real-chart triage. The architecture separates these concerns; compatibility with real programme systems remains unproven.

## Quickstart

Use Node.js 22 or later with built-in `node:sqlite`, and `curl`. No npm dependencies are needed.

```sh
node --version
npm test
npm run demo
```

The demo uses one generic assess endpoint for dosing and adult triage, and prints incomplete, scored, overridden and replayed results. It starts a loopback server and prints these URLs:

- [Guideline library](http://127.0.0.1:8080/guidelines.html)
- [Simulated EMR](http://127.0.0.1:8080/emr.html)

It leaves the server running and prints its PID and stop command. Stop an existing server on port 8080 before rerunning. Set `PROTOTYPE_NO_OPEN=1` to suppress browser opening and `PROTOTYPE_DATA_DIR` for an isolated data directory. Existing releases remain immutable.

## Where to read next

- [Documentation index](docs/README.md): engineering and implementation reports.
- [Design](docs/design.md): shared flow, registry and storage.
- [API reference](docs/api.md): generic assessment routes and compatibility wrapper.
- [CLI](docs/cli.md): commands, flags and exit codes.
- [Decisions](docs/decisions.md), [terminology](docs/terminology.md) and [data quality](docs/data-quality.md).
- [Triage scope](docs/triage.md), [validation](docs/validation.md) and [audit](docs/audit/AUDIT.md).
- [Refactor inventory](docs/refactor/INVENTORY.md) and [report](docs/refactor/REPORT.md).
