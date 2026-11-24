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

- [ ] **S1** Release version and npm dist-tag chosen (07 §6: `2.0.0-alpha.N` on `next`), package.json and the CHANGELOG heading updated — owner: Maintainer
- [ ] **S2** Minimum Node version decided (OQ-07) and `engines.node` aligned with the CI matrix — owner: Maintainer
- [ ] **S3** CI green on the release commit for every OS and Node version of the matrix — owner: Maintainer
- [ ] **S4** ADR-017 Runtime Isolation accepted, or the release notes state it is proposed and `restricted` is a preview — owner: Product Owner
- [ ] **S5** Delivery verified with installed Claude Code and Codex CLIs (W2.0-15: stream events, token usage, tool calls), or the release notes state it is not verified — owner: Implementer with access to both CLIs
- [ ] **S6** Migration paths A to D verified on fixtures (07 §7) — owner: Implementer
- [ ] **S7** Benchmark run (W2.2-02, W2.2-03), or the release notes state that every V1-vs-V2 hypothesis is unverified — owner: Product Owner
- [ ] **S8** Evaluation set labelled by a second reviewer with a held-out split (09 §4), or the release notes call the routing figures development-set figures — owner: Maintainer and reviewer
- [ ] **S9** Support window for 1.x decided (OQ-08) — owner: Maintainer
- [ ] **S10** Package and directory names decided (OQ-02) — owner: Maintainer
- [ ] **S11** Release notes list the behaviour changes of 07 §3 and the known limitations (NOT_VERIFIED and PARTIAL items of 08 §7) — owner: Maintainer

## 3. State on 2026-11-25

`npm run release:check` on branch `feature/w2.2-08-release-readiness`: **NOT_READY**.

- Gates: 12 of 13 PASS. `engines` FAILS: `engines.node` is `>=18.0.0` but CI tests Node 20, 22 and
  24 (decision OQ-07, sign-off S2). Not changed here: the minimum Node version is the maintainer's
  decision.
- Fixed for this release: the package no longer ships `templates/.claude` and `templates/.agents`
  (unused by V2, removed in 2.0 by 07 §5): 76 fewer published files. The
  folders stay in the repository for the V1 scripts that are deprecated until 2.1.
- Sign-off: S1 to S11 open.
