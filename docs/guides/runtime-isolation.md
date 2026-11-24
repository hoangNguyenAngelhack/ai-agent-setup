# Runtime Isolation (preview)

`run deliver` can start the agent's host CLI inside an operating-system sandbox, so code the agent
runs cannot read your keys and credentials, change the toolkit's run state, or approve its own work.
Decision and limits: [ADR-017](../v2/10-architecture-decisions.md#adr-017-runtime-isolation-w22-09);
test results: [security report](../v2/12-runtime-isolation-security-report.md).

## Install

Nothing to install. On macOS the toolkit uses the built-in `/usr/bin/sandbox-exec`; no Docker, no
administrator rights, no new OS user.

## Profiles

| Profile | What you get | Where |
|---|---|---|
| `none` (default) | Today's behaviour; the agent runs as a normal process of your account. Nothing is claimed | Everywhere |
| `restricted` | Kernel sandbox, same OS account: workspace read/write, home and temporary directories closed, key and credentials closed, `.ai-agent-setup/` read-only, no signals to your other processes, optional network deny-all | macOS only |
| `isolated` | Separate OS user | Not available: needs an administrator to create the user; refused with the reason |

A profile that cannot be enforced is refused and nothing starts. The toolkit never falls back to a
weaker profile.

## Check what this machine supports

```bash
npx create-ai-agent-setup isolation check                         # platform matrix + restricted
npx create-ai-agent-setup isolation check --isolation isolated    # exit 2: not enforceable here
npx create-ai-agent-setup isolation check --network deny --json
```

The output lists the requested profile, the provider and platform, each control with SUPPORTED /
PARTIAL / UNSUPPORTED / NOT_VERIFIED and its reason, and why a profile is refused.

## Run with a profile

```bash
npx create-ai-agent-setup run deliver <run-id> --host claude-code --isolation restricted
npx create-ai-agent-setup run deliver <run-id> --host codex --isolation restricted --network deny
npx create-ai-agent-setup run deliver <run-id> --host codex --isolation restricted --pass-env MY_VAR,OTHER
```

`run deliver` prints the requested and applied profile, the provider, what is enforced and what is
not. The same report is stored as signed evidence of the run (variable names only, never values).

- The agent reports steps with `run event` as usual; inside the sandbox the request goes to an inbox
  that the toolkit checks and signs. Approvals and verdicts from the agent are refused and listed.
- Approve steps yourself with `run approve-step` in your own terminal.
- Only these variables reach the agent: `PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `LANG`, `TERM`,
  `TZ`, `COLORTERM`, `NO_COLOR`, `LC_*`, `ANTHROPIC_*`, `CLAUDE_*`, `OPENAI_*`, `CODEX_*`, and names you
  pass with `--pass-env`.
- `--network deny` blocks all IP traffic, including the model API; real hosts need allow (default).

## Platform support

| Platform | `restricted` | `isolated` |
|---|---|---|
| macOS | Supported (verified on macOS 26.2) | Not available |
| Linux | Not available yet | Not available |
| Windows | Not available yet | Not available |

## Known limits

Same OS account; system folders (`/etc`, `/usr`, `/Applications`, …) stay readable; the workspace is
writable; no domain allowlist; a deliberately escaping process (fast double fork with a cleared
environment) can outlive the run but stays sandboxed; Apple marks `sandbox-exec` as deprecated (the
toolkit probes it before every run); real Claude Code and Codex under the sandbox are not verified
yet, and Codex's own sandbox cannot start inside another sandbox.
