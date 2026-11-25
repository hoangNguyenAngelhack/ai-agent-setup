# Runtime Isolation: security test report (W2.2-09)

| Field | Value |
|---|---|
| Decision | [ADR-017](10-architecture-decisions.md#adr-017-runtime-isolation-w22-09) (proposed, not yet accepted) |
| Machine | macOS 26.2 (25C56), Darwin 25.2.0, Node.js 24.21.0; one user account; no Docker used |
| Provider | `macos-seatbelt` (`/usr/bin/sandbox-exec`), profile `restricted` |
| Tests | `tests/security/runtime-isolation.test.ts` (real kernel sandbox, macOS only), `tests/unit/isolation/policy.test.ts`, `tests/unit/app/isolation.test.ts`, `tests/unit/cli/main.test.ts` |
| Date | 2026-11-24 |

Every attack runs as a real process under the generated Seatbelt profile. Each denial has a control
run that succeeds without the sandbox, so a denial proves the boundary, not a missing file. Fixture
secrets are fake and live in temporary directories; the real home, key and credentials are never
read.

## 1. Results

| # | Scenario | Result | Evidence |
|---|---|---|---|
| 1 | Read the HMAC key / list the key directory | **PASS** (EPERM; control reads it) | test 1 |
| 2 | Read an SSH key in the home directory | **PASS** | test 2 |
| 3 | Read cloud credentials (`.aws/credentials`, gcloud) | **PASS** | test 3 |
| 4 | Read outside the workspace (another project, a home file, list the home) | **PASS**; workspace readable | test 4 |
| 5 | Write outside the workspace | **PASS**; workspace writable; nothing created outside | test 5 |
| 6 | Run a program dropped in the temporary area | **PASS** (exec denied) | test 6 |
| 7 | Sandbox escape: child process, nested wider sandbox | **PASS** (child inherits; nested `sandbox-exec` refused) | test 7 |
| 7b | Escape through launchd (`launchctl submit`) | **PASS** (launchd refuses a sandboxed caller; control outside succeeds); manual probe, not automated: it creates a launchd job | manual, 2026-11-24 |
| 7c | Escape through Apple Events / `open` / clipboard | **NOT_VERIFIED**: rules in place (`appleevent-send`, LaunchServices and pasteboard lookups denied; sandboxed `pbpaste`/`pbcopy` exit 1); an automated control would open an app or touch the user's clipboard | profile, unit test |
| 8 | Network under deny-all | **PASS** (local TCP connect EPERM; same connect succeeds under allow-all) | test 8 |
| 8b | Domain allowlist | **NOT_APPLICABLE**: UNSUPPORTED with Seatbelt; the request is refused before anything starts | test 8 |
| 9 | Forge an approval or verdict | **PASS**: inbox refuses `APPROVAL_RESOLVED`, `RUN_*`, gate results; source forced to `host`; direct write to `events.jsonl` EPERM; approval stays pending; integrity VERIFIED | tests 9 (unit + lifecycle) |
| 10 | Tamper with events, integrity data, gate configuration | **PASS** (append EPERM; files unchanged; reading allowed) | test 10 |
| 11 | Reach a host process or file | **PASS**: signal and signal 0 to an outside process EPERM, the victim survives; host files as in 2–5 | test 11 |
| 12 | Children surviving normal end, timeout, cancellation, Ctrl-C | **PASS** for a child that left the process group (setsid) in all four paths | tests 12 |
| 12b | Adversarial: double fork faster than the 100 ms scan, environment cleared | **FAIL**: the process outlives the run (3 of 3 runs). Mitigated: it stays in the sandbox (reading the key gives EPERM) | test 12 known gap |
| — | Environment: tokens and key location not passed | **PASS** | env test, unit tests |
| — | `isolated` requested without an OS user | **PASS** (refused before start; no event written) | tests |
| — | Real Claude Code / Codex under `restricted` | **PARTIAL** (2026-11-25): first found that npm-installed hosts could not start (Codex's launcher could not read its own `package.json`; fixed by making the host's `node_modules` install readable and executable). Now `claude --version` (2.1.332) and `codex --version` (0.172.0) start in the sandbox, and a Codex delivery under `restricted` reached its API and ended in RUN_FAILED (401, not signed in), integrity VERIFIED. NOT_VERIFIED: a full agent session with tool calls under `restricted` (needs model quota), Codex's own sandbox nested inside it | `tests/unit/app/isolation.test.ts`; `npm run smoke:host -- --host <host> --isolation restricted` |

Totals for the 12 required scenarios: 12 PASS on their main case; additionally 1 FAIL (12b),
1 NOT_VERIFIED (7c), 1 PARTIAL (real hosts), 1 NOT_APPLICABLE (8b).

## 2. Acceptance criteria (W2.2-09)

| AC | Status | Why |
|---|---|---|
| AC1 OS identity separation | **UNSUPPORTED** | Needs an OS user created by an administrator; not done without permission (profile `isolated` refuses) |
| AC2 Filesystem access control | **PASS** (macOS) | Tests 1–5, 10 |
| AC3 Secret isolation | **PASS** (macOS) | Key, credentials, environment allowlist; transcript redaction (ADR-016) |
| AC4 Process restrictions | **PARTIAL** | Exec, signals, process info and tree kill pass; adversarial 12b fails |
| AC5 Network | **PARTIAL** | allow-all and deny-all enforced; allowlist UNSUPPORTED and refused |
| AC6 Approval boundary | **PASS** | Inbox on the host side; approvals still need the user's terminal (ADR-015/016 unchanged) |
| AC7 Cross-platform detection | **PASS** | `isolation check`: macOS PARTIAL (live probe), Linux and Windows UNSUPPORTED with reasons |

## 3. Platform matrix

| Platform | `restricted` | `isolated` | Verified here |
|---|---|---|---|
| macOS | SUPPORTED when the live probe passes (Seatbelt) | UNSUPPORTED (no OS user) | Yes |
| Linux | UNSUPPORTED (no provider: bubblewrap or Landlock planned) | UNSUPPORTED | No |
| Windows | UNSUPPORTED (no provider: AppContainer or restricted token + Job Object planned) | UNSUPPORTED | No |

## 4. Blockers

- Creating a dedicated OS user and setting permissions for `isolated`: needs administrator rights
  and the user's explicit permission.
- Linux and Windows providers: need those machines to implement and verify.
- Real Claude Code and Codex: installed in a user prefix; a full agent session under `restricted` uses the account's model quota and needs the user's go-ahead (`npm run smoke:host -- --host claude-code --isolation restricted`), and Codex needs `codex login` first.
