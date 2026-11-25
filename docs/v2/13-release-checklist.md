# 13. Release checklist (W2.2-08)

A release is READY only when every automated gate passes **and** every sign-off below is ticked.
The gates are run and measured by `npm run release:check` (`-- --json` for the
`release-check/v1` report); `npm publish` runs the same check through `prepublishOnly` and stops
unless it is READY.

A gate that could not run (for example `npm audit` without network) is NOT_VERIFIED, which is not a
pass. A sign-off is ticked in a reviewed change to this file by its owner, never by the script or an
agent. The script reads the list below as written: keep each item on one line in the form
`- [ ] **S<n>** <item> — owner: <owner>`.

## 1. Automated gates

| Gate | Checks | Source |
|---|---|---|
| `build` | `npm run build` | — |
| `typecheck` | `npm run typecheck` | [typescript rules](../../.claude/rules/typescript-patterns.md) |
| `lint` | `npm run lint` (no warnings) | — |
| `tests` | `npm run test:coverage`: every test passes, coverage thresholds met | [09 §2](09-testing-and-benchmark-strategy.md) |
| `catalog` | The bundled catalog validates | FR-17 ([04](04-product-specification.md)) |
| `eval-regressions` | No regression against `benchmarks/eval/baseline.json` | W2.2-06 |
| `audit` | `npm audit`: no high or critical advisory | [security rules](../../.claude/rules/security.md) |
| `cli-version` | `--version` prints the package version | F-02 ([07 §3](07-migration-strategy.md)) |
| `package-contents` | `npm pack --dry-run`: `package.json`, `README.md`, `LICENSE`, `bin/cli.js`, `dist/`, `catalog/schemas/` present; no environment file (`.env.example` allowed), key material, tests, coverage, run state, local settings, or `templates/.claude` / `templates/.agents` (removed in 2.0, [07 §5](07-migration-strategy.md#5-deprecations)) | — |
| `package-secrets` | High-confidence secret rules over every published text file; example connection strings to `localhost`, `127.0.0.1` or an upper-case placeholder host are not credentials | [security rules](../../.claude/rules/security.md) |
| `docs-links` | Every relative link in README, CHANGELOG, `docs/` and `benchmarks/` points to a file in the repository | — |
| `engines` | The lowest Node version in `engines.node` is one the CI matrix tests | OQ-07 ([10](10-architecture-decisions.md)) |
| `changelog` | `CHANGELOG.md` has a heading for the package version | — |

## 2. Sign-off

- [x] **S1** Release version and npm dist-tag chosen (07 §6: `2.0.0-alpha.N` on `next`), package.json and the CHANGELOG heading updated — owner: Maintainer
- [x] **S2** Minimum Node version decided (OQ-07) and `engines.node` aligned with the CI matrix — owner: Maintainer
- [x] **S3** CI green on the release commit for every OS and Node version of the matrix — owner: Maintainer
- [x] **S4** ADR-017 Runtime Isolation accepted, or the release notes state it is proposed and `restricted` is a preview — owner: Product Owner
- [x] **S5** Delivery verified with installed Claude Code and Codex CLIs (W2.0-15: stream events, token usage, tool calls), or the release notes state it is not verified — owner: Implementer with access to both CLIs
- [x] **S6** Migration paths A to D verified on fixtures (07 §7) — owner: Implementer
- [x] **S7** Benchmark run (W2.2-02, W2.2-03), or the release notes state that every V1-vs-V2 hypothesis is unverified — owner: Product Owner
- [x] **S8** Evaluation set labelled by a second reviewer with a held-out split (09 §4), or the release notes call the routing figures development-set figures — owner: Maintainer and reviewer
- [x] **S9** Support window for 1.x decided (OQ-08) — owner: Maintainer
- [x] **S10** Package and directory names decided (OQ-02) — owner: Maintainer
- [x] **S11** Release notes list the behaviour changes of 07 §3 and the known limitations (NOT_VERIFIED and PARTIAL items of 08 §9); draft in [14](14-release-notes-2.0.0.md) — owner: Maintainer

## 3. Sign-off record

S1–S11 were signed on 2026-11-25 by Hoang Nguyen, maintainer of the package, who stated that he signs
every item, including those owned by the Product Owner and the reviewer, on their behalf. The
release is `2.0.0-alpha.0` on the npm dist-tag `next`, from `main` at the merge of #23 (CI green on
every job of the matrix). Items met through their release-notes condition, not through the full
verification:

| Item | Signed on |
|---|---|
| S4 | Release notes state ADR-017 is proposed and `restricted` is a preview (ADR-017 stays proposed) |
| S5 | Claude Code verified on 2.1.332; Codex partly verified and stated as such in the release notes |
| S7 | No benchmark run; release notes state every V1-vs-V2 hypothesis is unverified |
| S8 | No second reviewer yet; release notes call the routing figures development-set figures |
| S9, S10 | The proposed answers to OQ-08 and OQ-02 in [10 §5](10-architecture-decisions.md#5-open-questions), approved as written |

## 4. Evidence on 2026-11-25 (branch `release/v2.0.0-alpha.0`)

Gates: run `npm run release:check` on the release commit; the result of this branch is in its pull
request. Sign-off: no item is ticked here. Each row says what the evidence shows, so the owner only
has to confirm and tick it.

| Item | Evidence state | What the owner still does |
|---|---|---|
| S1 | Prepared: `package.json` 2.0.0-alpha.0 with `publishConfig.tag` `next` (a guard against publishing to `latest`), CHANGELOG heading `[2.0.0-alpha.0]`. npm today: `latest` = 1.6.1, no `next` tag | Confirm the version and tag; tick |
| S2 | VERIFIED: `engines.node` `>=20.0.0`, CI matrix 20/22/24, gate `engines` PASS | Tick |
| S3 | NOT_VERIFIED until CI runs on the release commit (the commit that is published, after merge) | Check CI on that commit; tick |
| S4 | Release notes state ADR-017 is proposed and `restricted` is a preview: condition met. ADR-017 has a recommended acceptance text ([10](10-architecture-decisions.md#adr-017-runtime-isolation-w22-09)) | Product Owner: accept ADR-017 with the stated limits, or leave the release-notes wording; tick |
| S5 | Claude Code: VERIFIED on 2.1.332 (delivery, events, usage, tool calls, cost, permissions). Codex: PARTIAL on 0.172.0 without an account (start, failure, timeout, Ctrl-C, transcript, integrity); release notes state what is not verified: condition met | Optionally run `codex login`, then `npm run smoke:host -- --host codex`; tick |
| S6 | VERIFIED: paths A–D in `tests/e2e/setup.test.ts` and `tests/e2e/migration-paths.test.ts` | Tick |
| S7 | Not run (it uses model quota). Release notes state every V1-vs-V2 hypothesis is unverified: condition met. Plan: `npm run bench -- --dry-run` (324 trials, 72 h worst case) | Product Owner: tick on the release-notes condition, or approve a calibration run and then the full run |
| S8 | No human second reviewer yet; an AI first review is in [15](15-eval-benchmark-review.md). Release notes call the routing figures development-set figures: condition met | Maintainer and reviewer: tick on the release-notes condition; the full review stays open for the benchmark |
| S9 | Proposed answer in [10 §5 OQ-08](10-architecture-decisions.md#5-open-questions) | Maintainer: approve or change; tick |
| S10 | Proposed answer in [10 §5 OQ-02](10-architecture-decisions.md#5-open-questions): keep both names | Maintainer: approve or change; tick |
| S11 | Release notes checked against 07 §3 (all behaviour changes listed) and the PARTIAL items of 08 §9 (Codex, isolation, benchmark, KPIs, routing set, costs, V1 adoption, Codex trust, database switches) | Maintainer: read [14](14-release-notes-2.0.0.md) against the release commit; tick |
