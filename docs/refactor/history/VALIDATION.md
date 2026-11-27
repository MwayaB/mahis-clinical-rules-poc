**Placeholder notice: every clinical value, threshold, category, code, patient and reviewer identity is a placeholder, not clinical guidance.**

# Validation results

Runtime verified before implementation: Node v22.18.0; `node:sqlite.DatabaseSync` available. Default PATH pointed at unsupported v18.12.1, so all successful runs explicitly selected the installed Node 22 binary. No npm dependencies installed. SQLite prints its Node 22 experimental warning; tests and demo succeed.

| Completed part | Full suite passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Canonical JSON | 2 | 0 | 0 |
| IR validation | 27 | 0 | 0 |
| Compiler and fixture gate | 35 | 0 | 0 |
| Package verification | 48 | 0 | 0 |
| Pure evaluator and boundaries | 88 | 0 | 0 |
| Events and context | 92 | 0 | 0 |
| CLI, workflow and replay | 97 | 0 | 0 |
| Final scripts, documentation and checks | 99 | 0 | 0 |

Each part was committed after its passing full test run. The initial compiler used a temporary fixture checker until the production evaluator existed; Part 5 replaced it with the production evaluator. The final gate always runs actual evaluations.

Final commands, with the installed Node 22 directory prepended to PATH:

```sh
npm test
bash scripts/demo.sh
```

Both exited 0. Full captured output is in [results/tests.txt](../../../results/tests.txt) and [results/demo.txt](../../../results/demo.txt).

The demo asserted one warning for the placeholder 12 kg / 2 tablet proposal and zero advice for the placeholder 10 kg / 1 tablet proposal, then printed all seven ordered SQLite events. Clinical values, drug codes, patients and messages are placeholders and not clinical guidance.

Tests additionally cover signature/checksum tampering, signed unknown schema fields/types, wrong trusted keys, compiler fixture removal, deep freezing, complementary endpoint inclusion, missing inputs, block prescriptions being recorded with CLI exit 2, rollback, correction chains, responses, and replay using the exact recorded package/context cutoff. Moving the placeholder shared boundary from 15 to 14 changes advice within `[14,15)` and leaves sampled weights elsewhere unchanged.

No real clinical source documents or provenance attestations were supplied. The remaining qualifications and conservative interpretations are listed in README Decisions.
