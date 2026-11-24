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
| Minimality (simple tasks routed with ≤ 1 agent, ≤ 3 skills) | 0.903 (93/103) | ≥ 0.95 |

Classifier parameters, chosen by sweep on this set: phrase weight 8, secondary-domain ratio 0.7. The
sweep moved domain F1 from 0.786 to 0.943.

Minimality is below the hypothesis. Of the 10 failures:
- **6** add an independent review step because the task looks high-risk: it mentions payments,
  tokens or personal data, or its main capability is rated high risk (for example app store
  release). This follows docs/v2/05 §7.3. Either those labels are wrong or the risk cues are too
  strict; that is a product decision (OQ-11 in docs/v2/10).
- **4** come from a wrong secondary domain (classifier error).

Weakest area: secondary domains of multi-domain tasks (recall 0.732).
