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
| 1b | Critical | Arms run in different permission states: with `-p` and no flag, editing depends on each arm's settings | **Fixed partly:** every arm runs with `--permission-mode acceptEdits` (Claude Code) or `--sandbox workspace-write` (Codex). Arm B's own allow rules (`Bash(node *)`, `WebFetch(*)`, …) still differ from C's, because they are what V1 shipped |
| 2 | Critical (as reported) | Arm B should come from `templates/.claude` | **Not accepted.** V1 1.6.1 installs `.claude` by `npx degit hoangNguyenAngelhack/ai-agent-setup/.claude` (`git show 51bfc3a:bin/cli.js`, line 393), so the root `.claude` at the pinned commit is what V1 users received, maintainer paths included (TD-01). The permission difference in 1b stays open as a method question |
| 3 | Critical | Codex trials do nothing: the workspace is not a Git repository, and host failures still count as REJECTED | **Fixed.** Each trial workspace is a committed Git repository (`.git/` is not part of the judged tree); a trial with an error exit or no model usage makes the run invalid for claims |
| 4 | Major | Oracle false positives: breaking `/health` and deleting `test/` was ACCEPTED (reproduced) | **Fixed for both cases.** The fixture's own test script runs after the hidden checks; deleting a pre-existing test file is data loss even inside the scope; the `shop` health test now checks the status code. 36 reference solutions are still accepted |
| 4b | Major | Hidden checks `require` the agent's code in-process, so code that detects the checker can exit 0 | **Open.** Needs checks that report through a file from a separate process. Hidden checks are copied in only after the host exits, which limits but does not remove this |
| 5 | Major | Processes left by the agent keep running while the workspace is judged | **Fixed.** The host's process group is killed when it exits, not only on timeout |
| 6 | Major | The 8 rubric tasks count toward the 30-task rule but can never be accepted, which shrinks a real gain (about +7.8 pp shown for +10 pp) | **Open:** needs a decision: exclude rubric tasks from automated acceptance, or a way to enter blinded scores |
| 7 | Major | "Security" in the veto is only the secret scanner: no task defines `securityChecks` | **Open:** add injection and XSS checks to the security tasks |
| 8 | Major | Drift is not fully recorded: dirty tree flag, digests of prompts and hidden checks, the model actually used | **Open** |
| 9 | Major | `npm run eval:baseline` lets a change rewrite the baseline that judges it | **Open:** require a code owner for `benchmarks/eval/baseline.json` (repository setting) or refuse a baseline change together with a classifier change |
| 10 | Minor | False negatives: fe-01 needs double quotes, se-03 rejects `&#34;`, do-01 checks YAML with regexes | **Open** |
| 11 | Minor | `--keep` leaves hidden checks readable to later trials | **Open** |
| 12 | Minor | Confidence intervals depend on the order of `--arms` | **Open** |
| — | Contamination | Tasks are textbook exercises (IDOR, XSS escaping, slugify); a public repository makes hidden checks crawlable | **Open:** held-out tasks kept out of the repository (09 §5.6) |
| — | Labelling | One author labelled the 140 routing tasks and tuned the classifier on them; no held-out split | **Open:** the release notes call the figures development-set figures (S8) |

Leakage checked and sound: hidden checks are copied into the workspace only after the host exits;
reference solutions are never copied; `benchmarks/` is not in the npm package.

## 2. Checklist for the second reviewer

Tick each item yourself; none of them is ticked by the implementer or an agent.

- [ ] Ran one trial per arm in a clean environment and confirmed that arm A loads no instructions and every arm can edit files.
- [ ] Decided whether arm B keeps V1's own allow rules (finding 1b) and recorded the decision in 09 §5.2.
- [ ] Confirmed one Codex trial produces events and edits in a Git workspace.
- [ ] Re-ran the two se-01 false-positive cases of finding 4 and saw both REJECTED.
- [ ] Read at least 5 tasks' prompts against their hidden checks for solvability and leakage.
- [ ] Decided findings 4b, 6, 7, 8 and 9 (fix before the first scored run, or accept and state the limit).
- [ ] Labelled a held-out routing split independently of the original author.

Reviewer: ______________________  Date: __________  Signature: ______________________
