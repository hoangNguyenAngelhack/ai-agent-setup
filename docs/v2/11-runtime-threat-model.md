# Runtime Threat Model (run artifacts, approvals, evidence)

| Field | Value |
|---|---|
| Scope | `.ai-agent-setup/` run artifacts, plan approvals, events, gate evidence, the policy hook |
| Decisions | [ADR-016](10-architecture-decisions.md#adr-016-local-integrity-of-run-artifacts), accepted by the Product Owner on 2026-11-24; [ADR-017](10-architecture-decisions.md#adr-017-runtime-isolation-w22-09), proposed |
| Status | ADR-016 implemented. **PARTIAL:** not a security boundary against code running under the same OS account (§5). Runtime Isolation (ADR-017, proposed, §6) adds a kernel sandbox on macOS with `--isolation restricted` |
| Date | 2026-11-24 |

## 1. Assets

| Asset | Where | Why it matters |
|---|---|---|
| Approved plan revision | `runs/<run-id>/execution-plan.json` | Defines the scope the user approved |
| Event log | `runs/<run-id>/events.jsonl` | Source of every step state and of the run result |
| Gate records and logs | `runs/<run-id>/gates/g<n>/`, `evidence/g<n>/` | The only basis for SUCCEEDED |
| Host transcript | `runs/<run-id>/evidence/host-*.jsonl` | What the host said it did |
| Gate configuration | `.ai-agent-setup/gates.json` | Which commands verify the project |
| Integrity key | `<user config>/ai-agent-setup/keys/<project-id>.key` (outside the project, mode 0600) | Signs approvals, events and evidence |

## 2. Actors and trust boundaries

| Actor | Trust | Boundary |
|---|---|---|
| User | Trusted: approves plans and steps | Interacts through the toolkit CLI |
| Toolkit (orchestrator, CLI processes) | Trusted code; holds the key | Writes run artifacts; signs them |
| Host adapter | Trusted code, untrusted input | Parses the host's stream; never decides success |
| Agent (inside Claude Code or Codex) | **Untrusted**: may make mistakes or be steered by prompt injection | Acts only through host tools; the policy hook sits on those tools |
| Code the agent runs (scripts, `node -e`) | **Untrusted and not mediated** | Runs under the user's OS account |
| Filesystem | Shared by all of the above | No separation between processes of the same user |

## 3. Threats and controls

| # | Threat | Control | Test |
|---|---|---|---|
| T1 | Forge an orchestrator event (gate PASS) by appending to `events.jsonl` | Every event the toolkit writes is signed in `integrity.jsonl`; unsigned events are not applied and become `INTEGRITY_VIOLATION`; file-tool and shell writes to `.ai-agent-setup/**` are denied by policy | `integrity.test.ts` T1 |
| T2 | Change a recorded event (for example a FAIL into a PASS) | The signature covers the exact line and its position | T2 |
| T2b | Reorder signed events (revive a verification rejected the first time) | Signed events must appear in the order they were written | HIGH 2 regression |
| T3 | Widen an approved plan and recompute its digest | The approval signature covers run id, revision, digest, approver and time; the run is refused | T3 |
| T4 | Change who approved | Same signature | T4 |
| T5 | Replace gate records, gate logs or the host transcript | Their checksums are signed with the event that recorded them and checked on every load | T5, host-flow transcript test |
| T6 | Truncate or roll back the log together with its signatures | The log head (count, last signature) is kept with the key, outside the project | T6 |
| T7 | Make a signed run look unsigned (delete `integrity.json`, approve long after creating, fabricate an old-looking run id) | Once the project has a key, every run must be signed except the runs approved before the key existed; that list is recorded with the key, outside the project. `integrity.json` alone also forces signing | T7, HIGH 1 regressions |
| T8 | Run without the key (deleted or moved) | A signed run without its key is refused | T8 |
| T9 | Sign with another key (for example by pointing the key directory elsewhere) | Verification uses the key of the user's configuration | T9 |
| T10 | Read the key | Key outside the project, mode 0600. The hook resolves every file-tool path (symlinks, case on macOS/Windows) and denies the key directory, anything in it and its parents; shell commands naming the configuration directory are denied whatever the case, quoting or wildcards after it | T10, MEDIUM 3 regression, policy tests |
| T11 | Approve a step or plan as the agent | `run approve` and `run approve-step` need an interactive terminal and the id typed back; an agent's shell has no terminal. `project.run-approval` also makes the host ask | `main.test.ts`, `run.test.ts`, `policy-engine.test.ts` |
| T14 | Point the key directory into the project | Refused (`AI_AGENT_SETUP_KEY_DIR` inside the project) | LOW 5 regression |
| T12 | Make a gate pass with a no-op command (`echo`, `true`, empty script) | NOT_VERIFIED | `gate-engine.test.ts` |
| T13 | Concurrent writers corrupt the log | Cross-process lock per run; stale locks are taken over | `integrity.test.ts` |

## 3a. Security assumptions

The controls above hold only while all of these are true:

1. The agent acts through the host's tools (Claude Code `Bash`, `Write`, `Edit`, `MultiEdit`, `Read`,
   `Grep`, `Glob`; Codex `Bash`, `apply_patch`) and the policy hook is installed and trusted by the
   host (Codex runs project hooks only after the user approves them with `/hooks`).
2. The agent does not run code that opens files on its own (scripts, interpreters, compiled tools),
   or such code does not target the key directory.
3. The host does not give the agent an interactive terminal (so the approval check can tell a person
   from an agent). Not verified against the real CLIs (W2.0-15).
4. The user's account and configuration directory are not shared with other people.
5. The toolkit binary is the one the user installed.

## 4. Result semantics

`run-result.integrity` is VERIFIED, UNSIGNED (runs created before signing existed; shown, not
trusted more than before) or VIOLATED. Any violation keeps the run from SUCCEEDED and is listed as an
`INTEGRITY_VIOLATION` anomaly with its reason.

## 5. Residual risks (why this is PARTIAL)

1. **Same OS account.** Without `--isolation restricted` (macOS, §6), code the agent runs under the
   user's account can read the key file and write anything; the policy hook only sees host tool calls and command text. Signatures then stop
   only tampering that does not also read the key. Closing this needs an OS-level boundary that is
   not available locally without user action: a separate OS user for the agent, a sandbox that
   hides the key directory (for example a Codex sandbox or a container), or a key in an OS keychain
   that prompts on access.
2. **Patterns the hook cannot see.** A `Glob` or `Grep` pattern that reaches the key without naming
   it in `path`, or a shell command that builds the path at run time (`$(echo …)`), is not matched.
3. **Approvals.** The terminal check assumes the host does not give the agent an interactive
   terminal (true for the documented Claude Code and Codex tool shells; not verified against the
   real CLIs, W2.0-15). A signature proves the toolkit wrote the approval, not who typed it.
4. **Host self-reports.** Execution evidence is what the host reported; the gates verify outcomes.
5. **Unsigned legacy runs** keep the guarantees they had.

## 5a. Attack scenarios that are not protected

| Scenario | Why it succeeds | Needs |
|---|---|---|
| The agent writes and runs a script that reads the key and signs forged events | Same OS account; the hook sees only `node script.js` | Runtime Isolation (W2.2-09) |
| A shell command builds the key path at run time (`cat "$(printf …)"`) and reads the key | Command text does not name the directory | Runtime Isolation |
| The agent deletes the key directory and every `integrity.json` | Signed runs then look like runs without integrity data; the hook denies the key directory to host tools but not to arbitrary code | Runtime Isolation |
| A host that gives the agent a real terminal lets it type an approval | Assumption 3 broken | Verification with the real CLIs; Runtime Isolation for the approval channel |
| The agent edits gate commands in project files it may change (package.json scripts) | Gate commands are project code; no-op commands are NOT_VERIFIED, but a script that lies is not detected | Review of gate commands; out of scope for ADR-016 |

## 6. Runtime Isolation (W2.2-09, ADR-017)

### 6.1 Four boundaries

| Boundary | Stops | Does not stop |
|---|---|---|
| **Integrity** (ADR-016) | Changes to run artifacts by anything that does not hold the key | Code that reads the key under the same account |
| **Runtime isolation** (`--isolation restricted`, macOS) | The agent's processes reading the key, credentials, other projects and the home directory; writing outside the workspace or into `.ai-agent-setup/`; running dropped programs from temporary areas; signalling or inspecting the user's other processes; network (deny-all); Apple Events, `open`, clipboard | Anything §6.3 lists |
| **Host trust boundary** | The agent producing approvals, verdicts (RUN_COMPLETED, gate results) or signatures: only the toolkit outside the sandbox signs, and it accepts step reports only, through the inbox | A host that gives the agent the user's real terminal (approval typed by the agent: ADR-016 assumption 3) |
| **OS trust boundary** | Everything between different OS users | Not in use: profile `isolated` needs an OS user created by an administrator, so it refuses |

### 6.2 Scenarios of §5a with `restricted`

| Scenario | Without isolation | With `restricted` (macOS) | Test |
|---|---|---|---|
| Script reads the key and signs forged events | Succeeds | Read refused by the kernel (EPERM); `run event` goes to the inbox, which refuses approvals and verdicts | security tests 1, 9 |
| Shell builds the key path at run time | Succeeds | Refused whatever the command text | 1, 7 |
| Agent deletes the key directory or `integrity.json` | Succeeds | Refused (key directory closed; `.ai-agent-setup/` not writable) | 1, 10 |
| Agent types an approval in a real terminal | Possible if the host gives a TTY | Still possible in principle: approvals need the user's terminal; NOT_VERIFIED with the real hosts | — |
| Agent edits gate commands in project files | Succeeds | Still succeeds (workspace is writable by design) | — |

### 6.3 What remains unprotected

Same OS user (no identity separation); system locations outside the home and temporary directories
are readable; the workspace is writable and executable; network allow-all by default and no domain
allowlist; keychain items reachable through the security daemon (NOT_VERIFIED); an adversarial fast
double fork that clears its environment can outlive the run, confined; kernel or Seatbelt bugs;
`sandbox-exec` is deprecated by Apple; real Claude Code and Codex not verified under the sandbox;
Linux and Windows have no provider. Details and the per-test results:
[ADR-017](10-architecture-decisions.md#adr-017-runtime-isolation-w22-09),
[12](12-runtime-isolation-security-report.md).

### 6.4 Remaining options for a full boundary

| Option | Required for it to count | Platform notes |
|---|---|---|
| Separate OS user for the agent (profile `isolated`) | Key directory and run state readable only by the user's account; the agent's account has write access only to the working tree; approvals only from the user's account | macOS, Linux, Windows; needs an administrator and the user's permission; not done by the toolkit |
| Container or VM | Key directory not mounted; `.ai-agent-setup/` read-only or absent; network limited; the orchestrator outside | Needs a container runtime; never a default dependency |
| Linux / Windows kernel sandboxes | bubblewrap or Landlock; AppContainer or restricted token + Job Object | Not implemented; must be verified on each OS |
