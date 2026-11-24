# Routing evaluation set

`classification.yaml` holds 140 labelled task statements: 10 per domain for the 12 domains, plus 20
tasks that span several domains. 103 are labelled `simple` (one domain, low risk, small). The
methodology is in [docs/v2/09 §4](../../docs/v2/09-testing-and-benchmark-strategy.md#4-routing-and-context-evaluation-v21).

**Status: development set.** The same author wrote these labels and the classifier's phrase
lexicon, and the classifier's two parameters were chosen by a sweep on this set. The numbers below
are therefore optimistic. Before they are reported as evaluation results, 09 §4 requires labels from
a second reviewer and a held-out split that is never used for tuning.

## Run

```bash
npm run eval:routing        # prints the metrics and every failure
npm test                    # tests/eval/routing.test.ts keeps the floors below
```

## Results (2026-11-24, catalog at this commit, automatic mode, no project detected)

| Metric | Value | Target (hypothesis, 09 §4) |
|---|---|---|
| Domain precision | 0.955 | — |
| Domain recall | 0.932 | — |
| Top domain correct | 0.986 | — |
| Domain recall on multi-domain tasks | 0.732 | — |
| Task type correct | 0.843 | — |
| Minimality (simple tasks routed with ≤ 1 agent, ≤ 3 skills) | 0.913 (94/103) | ≥ 0.95 |

Classifier parameters, chosen by sweep on this set: phrase weight 8, secondary-domain ratio 0.7. The
sweep moved domain F1 from 0.786 to 0.943.

Minimality is below the hypothesis (0.903 before ADR-014; labels unchanged). Of the 9 failures:
- **3** get a mandatory specialist review under ADR-014 because the work affects payments or
  credentials (be-09, in-01: payment handling; mo-07: mobile credential storage). The policy wins
  over the `simple` label; these are expected.
- **2** get an independent code review because their main capability is rated high risk
  (mo-05 app store release, in-09 external service integration).
- **4** come from a wrong secondary domain (classifier error: ux-01, ux-10, dx-06, in-03).

Weakest area: secondary domains of multi-domain tasks (recall 0.732).

## Sensitive-impact review set (ADR-014)

`sensitivity.yaml` holds 22 cases: 10 positive (real payment, credential or personal-data impact),
10 negative (the words appear in unrelated contexts: design tokens, model token usage, synthetic
fixtures, UI copy, documentation, mocks) and 2 ambiguous (non-code work that must be flagged for
assessment). `tests/eval/sensitivity.test.ts` requires every case to pass.

| Metric | Value |
|---|---|
| Expected mandatory reviews added | 1.0 (10/10) |
| Mandatory reviews added to negative cases | 0 |
| Ambiguous cases flagged for assessment | 1.0 (2/2) |

Same caveat as above: one author wrote the cases and the rules, so this shows consistency, not
real-world accuracy.
