# 09 — Testing and Benchmark Strategy

| Field | Value |
|---|---|
| Status | Draft for review |
| Date | 2026-11-23 |
| Related | [05 §12 Quality](05-architecture-specification.md#12-quality-system) · [08 Roadmap](08-implementation-roadmap.md) · [04 NFRs](04-product-specification.md#6-non-functional-requirements) |

## 1. Purpose and scope

This document defines (a) how the toolkit itself is tested, (b) how routing and context are evaluated,
and (c) a reproducible benchmark that compares a no-toolkit baseline, V1 and V2.

**Out of scope:** testing users' applications. That is the job of the Quality Gate Engine
([05 §12](05-architecture-specification.md#12-quality-system)).

## 2. Current state

At the V1 baseline: no automated tests, no CI, `npm test` was a placeholder (F-14), and there are no
V1 performance measurements. Benchmark targets below are **hypotheses**.

Implemented since (2026-11-24): the layers of §3.1 except host compatibility, lint (§3.4), measured
coverage with enforced thresholds (§3.1), and contract tests for `gate-result`, `gate-record`,
`manifest` and `run-result`.

## 3. Toolkit test strategy

### 3.1 Test layers

| Layer | Scope | Examples | Gate |
|---|---|---|---|
| Unit | Pure functions in `core`, `registry`, `installer` planning | Classification rules, precedence merge, hash and ownership classification | Every PR |
| Contract | Schemas and the adapter interface | Every catalog entry validates; every adapter returns valid ops for every `stable` entry; dependency rules (Core never imports adapters) | Every PR |
| Golden-file | Deterministic generation | For each option combination × adapter, the generated tree equals the snapshot (NFR-07) | Every PR |
| Installer | File-system behaviour in temp dirs | Dry-run zero-write, idempotency, rollback byte-identity, conflict matrix, interrupted apply (simulated crash) | Every PR |
| E2E CLI | Real CLI process in temp dirs | V1 invocation table ([07 §3](07-migration-strategy.md#3-cli-compatibility)); `setup` on V1 fixtures (Path A–C) | Every PR |
| Host compat | Real `claude` / `codex` binaries, when installed | Host loads the generated agents, skills and hooks (smoke) | Nightly or manual; `NOT_VERIFIED` when the binary is absent |
| Eval | Routing and context quality (§4) | — | V2.1+, tracked trend |
| Benchmark | End-to-end outcome comparison (§5) | — | V2.2, per release |

Coverage of `src/` is measured with V8 (`npm run test:coverage`) and **enforced at 80% for statements,
branches, functions and lines** (aligned with the `standard` profile; `gate.coverage-80` 1.1.0 checks
all four). Code that runs only in child processes (the CLI launched by end-to-end tests, the policy
hook) is not instrumented; the CLI is also tested in-process through `main()`
(`tests/unit/cli/main.test.ts`) so that its branches are measured. Nothing is excluded from `src/`.

Measured 2026-11-24 (729 tests): statements 94.44%, branches 86.44%, functions 96.71%, lines 96.85%.

Target for `installer` and `policy`: 95% branches, because of their safety role. **Met and enforced**
per area in `vitest.config.mts` since 2026-11-24: installer 98.84% (171/173), policy 96.88% (93/96).

Runtime integrity (ADR-016) is tested threat by threat in `tests/unit/app/integrity.test.ts` (forged,
changed, removed and truncated events; widened plans; changed approvers; replaced evidence; deleted
integrity files; missing or foreign keys; key permissions; stale locks; policy denial of the key).
Every test process uses a temporary key directory (`tests/setup-env.ts`), never the user's.

Host delivery is tested end to end in `tests/e2e/host-flow.test.ts` (11 scenarios) with
`tests/helpers/fake-host.cjs` installed as `codex` and `claude`: real processes, real CLI calls for
events, the hosts' native stream formats as documented, Ctrl-C sent to `run deliver`, credential
redaction in the stored transcript. It proves the toolkit's side of the protocol only.

Real-host smoke test (W2.0-15), when a CLI is installed and signed in by the user: Claude Code first,
then Codex. Same flow as the harness with a one-step plan in a scratch project, a bounded timeout,
and evidence kept (version, transcript, result). Without the CLI the item stays NOT_VERIFIED; the
fake host is never reported as host verification.

Execution-state rules (ADR-015) have a dedicated suite, `tests/unit/core/execution-adr015.test.ts`:
host events before the dependency is verified, replay after it succeeds, a failed dependency blocking
its dependants without losing evidence, a host starting a step before reporting its dependency
finished, ad-hoc and independent pending approvals, pending approvals keeping the run from
SUCCEEDED, restart replay equality and duplicate delivery. The run store tests cover the refusal to
run gates early and the report of what changed when an old log is replayed under new rules.

Contract fixtures: `tests/contract/fixtures/run-result/` holds a valid result for each run status
(SUCCEEDED, FAILED, NOT_VERIFIED, CANCELLED) and invalid results (for example SUCCEEDED with an
unverified step, a SUCCEEDED step without gates or with a failed gate, an unapproved required step, a
missing plan id, an unknown property). Every result produced by `reconcile` is also validated.

### 3.2 V1 characterization tests

Before any refactor (W2.0-01), capture the V1 behaviour as golden snapshots. These are the regression
baseline for [07](07-migration-strategy.md). They include the known defects, which are marked
`expected-change` with a link to the fixing work item.

| Case | Command | Known V1 defect |
|---|---|---|
| CH-1 | `-t backend -y` | — |
| CH-2 | `-t backend -f nestjs -y` | F-04 (Express produced) |
| CH-3 | `-t backend --db sqlite -y` | F-06 (postgresql produced) |
| CH-4 | `-t backend -T strict -y` | F-05 (CLAUDE.md says Standard) |
| CH-5 | `-t frontend -f nextjs -u antd -y` | F-04 |
| CH-6 | `-t frontend -u shadcn -y` (vite default) | — |
| CH-7 | `-t mobile -y` | — |
| CH-8 | `-t fullstack -y` | — |
| CH-9 | `-H` present vs absent | — |
| CH-10 | `--version` | F-02 |

The `.claude/` download is network-dependent in V1 (F-07). Characterization pins it by running with
the content of the tagged release `v1.6.1` (offline mirror) so that snapshots are stable.

### 3.3 Installer test matrix

| Dimension | Values |
|---|---|
| Starting state | empty repo; V1 project pristine; V1 project modified; foreign `.claude/` (not V1); `AGENTS.md` present; `.codex/config.toml` present; `.mcp.json` present; managed V2 install |
| Operation | create, setup, setup --dry-run, update, rollback, doctor |
| Conflict choice | skip, backup+overwrite, merge, write `.new` |
| Failure injection | write error mid-apply, disk full simulation, invalid host-format output |
| Assertions | zero-write (dry-run); idempotency; byte-identity after rollback; no unmanaged file changed without consent; manifest consistent |

### 3.4 CI

GitHub Actions matrix: `ubuntu-latest`, `macos-latest`, `windows-latest` × Node 20, 22, 24 (OQ-07).
Implemented steps: `typecheck`, `lint` (ESLint with type-aware typescript-eslint rules, zero
warnings), the test suite, `catalog:validate`. Coverage with thresholds runs on Ubuntu / Node 22
only: Windows skips shell-dependent tests by design, so its figures would differ. Not yet
implemented: docs link-check and running CI with networking disabled after install (NFR-01).

### 3.5 Host compatibility checks

At every toolkit minor release:

1. Re-verify the host facts in [05 §10.2](05-architecture-specification.md#102-host-capability-matrix-verified-2026-11-23)
   against the official docs and record the check date.
2. Run host smoke tests on the latest stable `claude` and `codex`.
3. Update each adapter's tested host range. Any undocumented behaviour the adapter relies on is a
   defect.

## 4. Routing and context evaluation (V2.1)

| Suite | Content | Metrics |
|---|---|---|
| Classification set | ≥ 120 labelled task statements: ≥ 10 per domain + 20 multi-domain, written as different roles (PM, BA, designer, engineer) | domain precision and recall; task-type accuracy |
| Minimality set | ≥ 40 simple single-domain tasks | % plans with ≤ 1 agent and ≤ 3 skills (target ≥ 95%, hypothesis) |
| Multi-domain set | ≥ 20 tasks needing 2–4 domains | capability coverage vs reference plan (F1) |
| Override set | Every precedence and conflict row in [05 §7.4–7.5](05-architecture-specification.md#74-override-precedence) | 100% expected outcomes (hard requirement) |
| Policy bypass set | Adversarial overrides attempting to enable denied tools or remove mandatory gates | 0 bypasses (hard requirement) |
| Context set | Tasks with reference "needed" context items | T0 bytes measured; recall of needed items; irrelevant bytes loaded |

Labels are created by two reviewers. Disagreements are resolved and recorded. The set is versioned in
`benchmarks/eval/` and is never used for tuning without a held-out split.

**Regression detection (W2.2-06, implemented for the routing and sensitive-impact sets).** Every case
check and metric is compared with a baseline committed in `benchmarks/eval/baseline.json`: a check
that passed and now fails, or a worse metric, is REGRESSED; a changed set is STALE (unchanged cases
compared, metrics not); regressions of the sensitive-impact set are a veto. The benchmark suite of §5
will use the same comparison once it exists (W2.2-02, W2.2-03).

## 5. Benchmark methodology (V2.2)

### 5.1 Arms

| Arm | Configuration |
|---|---|
| A: Baseline | Host with no toolkit configuration (empty `.claude/`/`AGENTS.md`, default permissions) |
| B: V1 | Configuration produced by `create-ai-agent-setup@1.6.1` (pinned content, F-07) |
| C: V2 | Configuration produced by the V2 release candidate, default profile, hybrid mode auto-accepted |

### 5.2 Controls (identical across arms)

Same model ID and settings (temperature or effort where configurable), the same host version, the same
repository snapshot (git SHA of the fixture), the same task text, the same environment (container
image digest), the same tool permissions (Arm A gets the V2 policy translated to host permissions, so
that permission differences do not confound results), the same verification criteria, and the same
wall-clock limit per task. Each task–arm pair runs **n ≥ 3** times. Run order is randomized.

### 5.3 Task suite

At least 30 tasks. The proposed distribution has 36 tasks, each defined by a YAML file with
`id`, `category`, `domains`, `fixture`, `prompt`, `acceptance` (hidden tests and/or rubric),
`timeLimit` and `securityChecks`.

| Category | Tasks | Example |
|---|---|---|
| Product requirements | 3 | Write a PRD with acceptance criteria from a feature brief |
| Architecture | 3 | ADR for a caching approach with trade-offs |
| Frontend | 3 | Add an accessible form with validation |
| Backend | 4 | Add a paginated endpoint with auth |
| Mobile | 2 | Add offline caching to a list screen |
| Data | 3 | Data-quality checks for an ETL step; RAG retrieval function |
| DevOps | 3 | CI pipeline with test + build; Dockerfile hardening |
| Testing | 3 | Add regression tests reproducing a reported bug |
| Security | 3 | Fix an IDOR; remove a hard-coded secret |
| Documentation | 2 | API docs from code; release notes from commits |
| Refactoring | 2 | Extract a module without behaviour change |
| Bug fixing | 3 | Fix failing test with root cause |
| Cross-domain integration | 2 | Feature spanning API + UI + tests + docs |

### 5.4 Acceptance oracle

A task is **accepted** only if all of the following hold:

1. Hidden tests pass (where defined).
2. No new security findings at high severity or above (scanner + rubric).
3. No data loss: files outside the task scope are unchanged unless justified.
4. A rubric score at or above the threshold from a blinded reviewer, for document-type tasks.

Reviewers do not see the arm.

### 5.5 Statistics and reporting

Report the median and the 95% bootstrap confidence interval per metric and arm. Compare paired by
task (C vs B and C vs A). Report per category and overall. A **veto rule** applies: any increase in
critical security regressions or data-loss incidents in Arm C fails the benchmark regardless of
aggregate gains (EXECUTION-SPECIFICATION §9 V2.2).

### 5.5a Harness (W2.2-02, implemented)

`npm run bench -- --model <id> [--host claude-code|codex] [--suite dir] [--n 3] [--seed 1] [--arms A,B,C]`
runs the method above and writes `trials.jsonl`, `report.json` (`benchmark-report/v1`) and
`report.md` to `benchmarks/results/<time>/`.

- **Tasks:** YAML files under `<suite>/tasks` (`benchmark-task/v1`). Each task also declares `scope`, the globs it may change, which the data-loss check needs.
- **Arms** are built once per run:
  - C is what `setup` writes (default profile).
  - A is only C's permission files (Claude Code: `settings.json` and the policy hook; Codex: `config.toml` and hooks).
  - B is the configuration of the pinned V1 commit `51bfc3a`, read from git history. V1 had no Codex adapter, so for Codex, B is V1's `.agents/skills`.
- **Trials:** each trial copies the fixture, puts the arm on top, runs the host with the task's time limit (the whole process tree is stopped at the limit), and then judges the workspace.
- **Oracle:** data loss (changed or deleted files outside the scope), secrets and the task's security checks, then the hidden tests, run only after the agent stops, from outside the workspace, with the code under test in its own process (see [15](15-eval-benchmark-review.md)). A rubric needs a blinded reviewer, so a rubric task is NOT_VERIFIED.
- **Controls** recorded in the report: host and version, model, seed, n, package commit, V1 commit, a digest of each fixture, and the time limits.
- **Validity:** a run with fewer than 30 tasks or n < 3 is marked not valid. Its hypothesis is then INCONCLUSIVE whatever the numbers.
- **Not verified yet:** the harness has only been run against a test double of the host (`tests/e2e/benchmark.test.ts`), not against installed CLIs. The task suite itself is W2.2-03.

### 5.6 Threats to validity

Model nondeterminism (mitigated with n ≥ 3 and CIs); host version drift (pinned); task leakage into
tuning (held-out tasks); reviewer bias (blinding); fixture bias toward V1 stacks (categories cover
non-Node stacks).

## 6. Metrics and KPIs

| Metric | Definition | Source |
|---|---|---|
| Task acceptance rate | accepted runs ÷ total runs | Oracle §5.4 |
| Test pass rate | passed hidden tests ÷ total hidden tests | Test runner |
| Regression rate | runs breaking previously passing tests ÷ runs | Test runner |
| Security findings | count by severity introduced by the change | Scanner |
| Median completion time | wall-clock from task start to final answer | Harness |
| Tokens per accepted task | total tokens of all runs ÷ accepted runs | Host usage logs (`measured`) or estimate (`estimated`, flagged) |
| Cost per accepted task | total cost ÷ accepted runs | Same as tokens |
| Tool calls | count per run | Host transcript |
| Human intervention | prompts requiring user input per run | Harness |
| Installation reliability | successful installs ÷ attempts over the installer matrix | §3.3 |

`report --kpi` (W2.2-07) reports each KPI above for one project from its local artifacts, labelled
`measured` or `estimated`, with sample size; a KPI that needs the benchmark, a scanner or the CI
installer matrix is NOT_VERIFIED with the reason, and no other figure is reported under its name.

**Target hypotheses** (not achieved; to be tested in V2.2):

| KPI | Hypothesis (C vs B) |
|---|---|
| Task acceptance | ≥ +10 percentage points |
| Test pass rate | ≥ +10 percentage points |
| Tokens per accepted task | ≥ 20% lower |
| Median completion time | ≥ 15% lower |
| Critical security regressions | No increase (veto) |
| Rollback integrity | 100% verifiable |
| Installation success | ≥ 99% in the defined test environment |

## 7. Acceptance criteria

- [x] Test layers cover the installer guarantees and Core/adapter separation.
- [x] V1 characterization precedes refactoring.
- [x] The benchmark defines arms, controls, at least 30 tasks, an oracle, statistics and a veto rule.
- [x] All targets are labelled as hypotheses.
- [ ] Task suite authored and reviewed. **V2.2 deliverable.** Authored 2026-11-25 (`benchmarks/suite/`, 36 tasks, checked by `tests/benchmark/suite.test.ts`); second review and held-out tasks pending.
