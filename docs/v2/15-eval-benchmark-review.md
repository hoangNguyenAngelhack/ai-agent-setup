# 15. Review of the evaluation set and the benchmark (2026-11-25)

**Status: first review done by an AI reviewer that did not write the code; the human second review
of 09 §4 and §5.6 (sign-off S8) is still open.** This review does not replace that person: it gives
them the findings, what was fixed, and a checklist to confirm and sign.

| Field | Value |
|---|---|
| Scope | Routing evaluation (`src/app/routing-eval-run.ts`, `src/app/eval-regression.ts`, `benchmarks/eval/`), benchmark harness (`src/app/benchmark/`), task suite (`benchmarks/suite/`) |
| Reviewed at | `main` 0e5d4dc plus the working tree of `release/v2.0.0-alpha.0` |
| Reviewer | An independent AI review agent, read-only, with no part in writing the code |
| Not run | No real host (`claude`, `codex`) and no model call; whether the GitHub repository is public; the Python checks da-01 to da-03 in detail; every one of the 36 hidden checks (about 12 were read) |

## 1. Findings and what happened to them

Each finding was checked by the implementer before acting on it. "Fixed" means a test fails on the
old code and passes on the new one.

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | The host runs with the user's own configuration (settings, MCP servers, rules) in every arm, so arm A is not a clean baseline | **Fixed in the invocation, effect NOT_VERIFIED.** Claude Code: `--setting-sources project,local --strict-mcp-config`; Codex: `--ignore-user-config --ignore-rules`. The flags exist in the installed CLIs; whether the user's `CLAUDE.md` memory still loads is not verified without a model call. 09 §5.2 still asks for a container |
| 1b | Critical | Arms run in different permission states: with `-p` and no flag, editing depends on each arm's settings | **Partly fixed:** every arm runs with `--permission-mode acceptEdits` (Claude Code) or `--sandbox workspace-write` (Codex). Arm B's own allow rules still differ from C's. **Decision prepared** (§3, D-1b) |
| 2 | Critical (as reported) | Arm B should come from `templates/.claude` | **Not accepted.** V1 1.6.1 installs `.claude` by `npx degit hoangNguyenAngelhack/ai-agent-setup/.claude` (`git show 51bfc3a:bin/cli.js`, line 393), so the root `.claude` at the pinned commit is what V1 users received, maintainer paths included (TD-01). The permission difference in 1b stays open as a method question |
| 3 | Critical | Codex trials do nothing: the workspace is not a Git repository, and host failures still count as REJECTED | **Fixed.** Each trial workspace is a committed Git repository (`.git/` is not part of the judged tree); a trial with an error exit or no model usage makes the run invalid for claims |
| 4 | Major | Oracle false positives: breaking `/health` and deleting `test/` was ACCEPTED (reproduced) | **Fixed for both cases.** The fixture's own test script runs after the hidden checks; deleting a pre-existing test file is data loss even inside the scope; the `shop` health test now checks the status code. 36 reference solutions are still accepted |
| 4b | Major | Hidden checks `require` the agent's code in-process, so code that detects the checker can exit 0 | **Fixed.** Checks never enter the workspace: they run from a new directory under one parent outside it, created after the host is stopped and removed after judging. Code under test runs only in a subject process (`benchmarks/suite/runtime/isolate.cjs`, `isolate.py`); every assertion stays in the check process. On macOS the subject, and the host during the trial (Claude Code), run under a Seatbelt profile that denies the check rooms, `hidden/`, `solutions/`, `security/` and the results. Adversarial tests (`tests/security/benchmark-checks.test.ts`): exit at load, checker detection, patched built-ins and `assert`, reading or writing the checks (EPERM), and ending the fixture's tests early are all REJECTED; the first attack passed the old check. Limit: without Seatbelt (Linux, Windows) the subject is a separate process only and could read the checks; such runs are marked `secrets: unprotected` and invalid for claims |
| 5 | Major | Processes left by the agent keep running while the workspace is judged | **Fixed.** The host's process group is killed when it exits, not only on timeout |
| 6 | Major | The 8 rubric tasks count toward the 30-task rule but can never be accepted, which shrinks a real gain (about +7.8 pp shown for +10 pp) | **Decision prepared** (§3, D-6) |
| 7 | Major | "Security" in the veto is only the secret scanner: no task defines `securityChecks` | **Fixed.** `benchmarks/suite/security/`: `auth-required` (order endpoints never answer without a valid token), `js-dangerous-calls` and `py-dangerous-calls` (no evaluation, shell access, raw HTML injection or unsafe deserialisation in the fixture's source). Assigned to the 33 code tasks. Each passes on the untouched fixture and on every reference solution, and fails on an insecure variant (tests). Static scans miss obfuscated calls |
| 8 | Major | Drift is not fully recorded: dirty tree flag, digests of prompts and hidden checks, the model actually used | **Fixed.** The report records the dirty flag, toolkit and evaluator versions, arms, per-task digests of prompt, hidden checks and security checks, the host command line, the protection of secrets and the models the hosts reported. A dirty toolkit, unprotected secrets or a requested model no host reported make the run invalid for claims |
| 9 | Major | `npm run eval:baseline` lets a change rewrite the baseline that judges it | **Decision prepared** (§3, D-9) |
| 10 | Minor | False negatives: fe-01 needs double quotes, se-03 rejects `&#34;`, do-01 checks YAML with regexes | **Fixed.** fe-01 parses attributes with any HTML quoting and accepts a wrapping label; se-03 accepts named, decimal and hexadecimal references; do-01 parses the workflow as YAML (invalid YAML is rejected; any trigger form, a Node matrix and `npm ci` are accepted). `cx-01`/`cx-02` accept any attribute quoting. Each correct variant was rejected by the old check and is accepted now; broken variants are still rejected (`tests/benchmark/false-negatives.test.ts`) |
| 11 | Minor | `--keep` leaves hidden checks readable to later trials | **Fixed** by 4b: hidden checks never enter the workspace, so `--keep` keeps none |
| 12 | Minor | Confidence intervals depend on the order of `--arms` | **Fixed.** Each statistic has its own random stream from the seed and a fixed label; the same trials give the same intervals in any `--arms` order (test) |
| — | Contamination | Tasks are textbook exercises (IDOR, XSS escaping, slugify); a public repository makes hidden checks crawlable | **Open:** held-out tasks kept out of the repository (09 §5.6) |
| — | Labelling | One author labelled the 140 routing tasks and tuned the classifier on them; no held-out split | **Open:** the release notes call the figures development-set figures (S8) |

Leakage checked at review time: hidden checks were copied into the workspace only after the host exited (since the fixes they never enter it, see 4b);
reference solutions are never copied; `benchmarks/` is not in the npm package.

## 2. Checklist for the second reviewer

Tick each item yourself; none of them is ticked by the implementer or an agent.

- [ ] Ran one trial per arm in a clean environment and confirmed that arm A loads no instructions and every arm can edit files.
- [ ] Confirmed one Codex trial produces events and edits in a Git workspace.
- [ ] Re-ran the two se-01 false-positive cases of finding 4 and saw both REJECTED.
- [ ] Read at least 5 tasks' prompts against their hidden checks for solvability and leakage.
- [ ] Read the fixes of findings 4b, 7, 8, 10, 11 and 12 and their tests, and agree they close the findings.
- [ ] Approved, changed or rejected decisions D-1b, D-6 and D-9 (§3).
- [ ] Labelled a held-out routing split independently of the original author.

Reviewer: ______________________  Date: __________  Signature: ______________________

## 3. Decisions to approve

Each decision changes what the benchmark measures, so it belongs to the Product Owner (D-1b, D-6) or
the maintainer and the reviewer (D-9). Nothing below is applied until it is approved.

### D-1b: tool permissions across arms

| Option | Effect on fairness |
|---|---|
| A. Keep each arm's own permission rules (today) | Measures V1 *as shipped*, but B can run `node`, `npm` and `WebFetch` without a prompt while A and C cannot. In headless mode a denied command is simply refused, so B's broader rules can win tasks that need tests, whatever the guidance is worth. Breaks "same tool permissions" (09 §5.2) |
| B. Remove the `permissions` block from every arm and give all arms one list on the command line | Every arm gets the same tools; the arms differ only in instructions, skills, agents and hooks, which is what V2 claims to improve. Does not measure the effect of V1's broad allow rules |
| C. Give every arm V1's broad rules | Same tools, but wider than V2 would ever ship; a security regression in the test setup itself |

**Recommended: B**, with one list for every arm: edits in the workspace (`--permission-mode acceptEdits`), and
`Bash(node *)`, `Bash(npm *)`, `Bash(npx *)`, `Bash(python3 *)`, `Bash(git status*)`, `Bash(git diff*)`.
It is the only option that meets 09 §5.2; V1's permission rules are still kept on disk in arm B, so a
reader can see them. To approve: *"D-1b approved: option B with the listed tools."*

### D-6: rubric tasks in acceptance

| Option | Effect |
|---|---|
| A. Count them as not accepted (today) | Every arm loses the same 8 tasks, which shrinks a real difference (a +10 pp gain shows as about +7.8 pp) and can turn SUPPORTED into INCONCLUSIVE |
| B. Leave them out of acceptance and of the 30-task rule | Only 28 tasks remain: no run could be valid until two automated tasks are added |
| C. Score them: blinded reviewer scores enter the report, and a task counts once it has a verdict | Measures all 36 tasks as 09 §5.4 intends; needs a reviewer per run |

**Recommended: C, with B until scores exist.** The acceptance rate is computed over tasks that have a
verdict. Rubric tasks enter when blinded scores are supplied (a `--rubric-scores <file>` input is to be
built after approval). The validity rule counts tasks with a verdict, so a run without scores needs
two more automated tasks to be valid. To approve: *"D-6 approved: option C; until scores exist, rubric
tasks are excluded and two automated tasks are added."*

### D-9: who may change the evaluation baseline

| Option | Strength |
|---|---|
| A. Code owners: `benchmarks/eval/baseline.json` needs the owner's review (GitHub CODEOWNERS plus branch protection "Require review from Code Owners") | Strong; a repository setting only an administrator can enable |
| B. A CI check fails a pull request that changes both the baseline and the classifier or router (`src/core/planning`, `src/core/routing`) | Automatic, but anyone can split the change into two pull requests |
| C. Both | A catches a split change; B explains why it is refused |

**Recommended: C.** Proposed `.github/CODEOWNERS` line: `/benchmarks/eval/baseline.json <owner>`
(the maintainer's GitHub account), then enable code-owner review on `main`. To approve: *"D-9 approved:
add CODEOWNERS and the CI check; branch protection enabled by <administrator>."*

## 4. Methodology re-audit (2026-11-25, after the fixes)

| Area | State | Evidence |
|---|---|---|
| Dataset leakage | Hidden checks, solutions and security checks are outside the npm package and, on macOS, unreadable to the host during the trial (Claude Code) and to the code under test during judging | `subject.ts`, `tests/security/benchmark-checks.test.ts`; `claude --version` runs under the profile, `cat` of a hidden check gives EPERM |
| Oracle integrity | Verdicts come only from the check process; the fixture's tests must pass in at least the untouched fixture's number | `oracle.ts`, adversarial tests |
| Evaluator manipulation | Checks are prepared outside the workspace after the host is stopped and its process group killed; nothing the agent wrote runs inside the check process | `run.ts`, `oracle.ts` |
| Trial validity, failed hosts | A trial with an error exit or no model usage makes the run invalid for claims | `report.ts`, unit test |
| Process cleanup | The host's process group is killed when it exits and at the time limit | e2e test (late write never happens) |
| Configuration parity | Same permission mode and no user configuration in every arm; tool lists still differ (D-1b) | `promptInvocation`; D-1b |
| Statistics | Bootstrap intervals independent of `--arms` order; validity needs ≥ 30 tasks and n ≥ 3; rubric weighting open (D-6) | unit tests; D-6 |
| Reproducibility | Seeded order with a digest (`--dry-run`), dirty flag, versions, task digests, command line, observed models | `report.ts`, schema |
| Codex | Not protected by Seatbelt (its own sandbox cannot be nested): its runs are invalid for claims outside a container | `run.ts` |
| Not verifiable without quota | Whether a real scored run behaves as the fake host does | — |
