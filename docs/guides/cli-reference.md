# CLI reference

Every command of `create-ai-agent-setup` (run with `npx create-ai-agent-setup <command>`). The
everyday commands are in the [README](../../README.md#everyday-commands). Commands marked *preview*
work and are tested, but their output and options may still change.

## Project setup

| Command | What it does |
|---|---|
| `[name] [options]` or `create <name>` | Create a project from a template and install the AI configuration |
| `setup [dir]` | Add the configuration to an existing project; asks before writing (`--yes` to skip, `--dry-run` to only plan) |
| `diff [dir]` | Show the plan and a unified diff of every change; writes nothing |
| `update [dir]` | Update an installation to this version's catalog, keeping its adapters and profile; files you changed are kept and the new version is written next to them |
| `doctor [dir]` | Check managed files and sections against `.ai-agent-setup/manifest.json` |
| `rollback [dir] [--force]` | Restore the state before the latest install, byte for byte |
| `catalog validate [dir]` | Validate a catalog (schemas, references, policies, context budget) |

### Create options

| Option | Values |
|---|---|
| `-t, --type` | `backend`, `frontend`, `fullstack`, `mobile` |
| `-f, --framework` | backend: `express`, `nestjs` · frontend: `nextjs`, `vite` · mobile: `expo`, `cli` |
| `-u, --ui` | frontend only: `shadcn`, `antd`, `chakra`, `semantic` |
| `-T, --tier` | `starter`, `standard`, `strict` (selects the profile) |
| `-d, --db` | `postgresql`, `mysql`, `sqlite`, `none` |
| `-H, --honesty` | include the honesty rule |
| `-c, --codegraph` | run the third-party CodeGraph installer (needs network) |
| `-y, --yes` | use defaults, no prompts |

### Setup and update options

| Option | Meaning |
|---|---|
| `-a, --adapter claude-code,codex` | hosts to generate for (default: the hosts already configured, otherwise Claude Code) |
| `--profile <id>` | `profile.starter`, `profile.standard` (default), `profile.strict` |
| `--strategy <s>` | conflicts: `write-new` (default: writes `<file>.ai-agent-setup.new` next to yours), `skip`, `backup-overwrite` |
| `--enable-tool <id>` | opt in to an MCP server, for example `tool.mcp-github` |

## Planning and analysis (preview)

| Command | What it does |
|---|---|
| `plan "<task>"` | Propose a plan: domains, agents, skills, gates and estimated cost, with the reasons; `--mode`, `--domain`, `--agent`, `--exclude-agent`, `--allow-tools`, `--budget`, `--approve-at`, `--json`; `--files`, `--changed`, `--since` add impact analysis |
| `explain <plan-id>` | Show a saved plan with its explanation |
| `impact [files...]` | What changed files touch: modules, areas, risk, related tests, CODEOWNERS owners; without files it reads uncommitted git changes, `--since <ref>` diffs against a ref |

## Quality gates (preview)

`gates list|run|history [dir]`: `list` shows every gate, whether it is supported for this project and
the command it would run; `run` executes the required gates (profile plus
`.ai-agent-setup/gates.json`) and writes redacted, checksummed evidence; exit code 0 PASS, 1 FAIL,
2 NOT_VERIFIED. Options: `--gate`, `--skip`, `--run`, `--profile`, `--json`.

Gate commands come from your configuration first, then your `package.json` scripts, then the default
of your stack (see [docs/v2/16](../v2/16-language-packs.md)). A gate with no command, or whose tool is
missing, is NOT_VERIFIED with the reason and the fix, never PASS.

## Execution runs (preview)

`run <action>` delivers an approved plan to a host CLI and verifies each step with the gates:

| Action | What it does |
|---|---|
| `create <plan-id>` | Create a run from a saved plan |
| `approve <run-id>`, `approve-step <run-id> <step>` | Approve the plan or a step (interactive terminal; you type the id back) |
| `deliver <run-id> --host claude-code\|codex` | Hand the plan to the host; `--dry-run`, `--timeout <s>`, `--event-command`, and `--isolation restricted [--network deny] [--pass-env a,b]` for the macOS sandbox ([guide](runtime-isolation.md)) |
| `event`, `verify <run-id> <step>`, `cancel`, `status` | Step reports from the agent, gate verification, cancellation, state |

A run succeeds only when every step was reported as executed and passed its gates. Runs are signed
with a key kept in your configuration directory.

## Reports and isolation (preview)

| Command | What it does |
|---|---|
| `report [dir]` | Runs by status and integrity, gate pass rate (verified runs only), durations, tokens per host and per accepted outcome; `--since <date>`, `--json`, `--kpi` for every KPI of [docs/v2/09 §6](../v2/09-testing-and-benchmark-strategy.md), measured or NOT_VERIFIED with the reason |
| `isolation check` | What each isolation profile (`none`, `restricted`, `isolated`) enforces on this machine; exit code 2 when a profile cannot be enforced |
