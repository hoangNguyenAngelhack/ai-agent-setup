<div align="center">

# AI Agent Setup

### Universal AI engineering configuration for Claude Code and Codex

[![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/create-ai-agent-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%20%7C%2022%20%7C%2024-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

**English** | **[Tiếng Việt](README.vi.md)**

</div>

> **Status: V2 preview, not released.** The version on npm (`npx create-ai-agent-setup`) is still
> **1.6.1 (V1)**. This branch contains the V2 foundation described below; to try it, build it from
> source (see [Quick start](#quick-start-v2-from-source)). V1 users: read
> [Migrating from V1](docs/guides/migrating-from-v1.md) before running V2 in a V1 project.

## What it does

- **Creates projects** from seven templates (Express, NestJS, Next.js, Vite, fullstack Next.js,
  Expo, React Native CLI) and gives them an AI engineering configuration.
- **Sets up existing projects** safely: dry-run, unified diff, backup, conflict handling, rollback
  and an integrity check. Files you changed are never overwritten silently.
- **Generates native configuration for each host** from one versioned catalog: Claude Code
  (`.claude/`) and Codex (`AGENTS.md`, `.agents/skills`, `.codex/`).
- **Enforces a safety policy** with a hook that runs before every shell command and file write.
  Destructive commands (`rm -rf`, `git push --force`, `DROP TABLE`, `npm publish`, …) need explicit
  approval. Writing a credential in a known token format is blocked.

## Quick start (V2 from source)

```bash
git clone https://github.com/hoangNguyenAngelhack/ai-agent-setup.git
cd ai-agent-setup && git checkout feature/v2-foundation
npm ci && npm run build

# Create a new project (V1 flags work)
node bin/cli.js my-api -t backend -f nestjs -y

# Add the configuration to an existing project: review first, then apply
node bin/cli.js diff ../my-project
node bin/cli.js setup ../my-project --yes
node bin/cli.js doctor ../my-project
node bin/cli.js rollback ../my-project      # undo the last install
```

## Commands

| Command | What it does |
|---|---|
| `[name] [options]` or `create <name>` | Create a project from a template and install the AI configuration |
| `setup [dir]` | Add the configuration to an existing project; asks before writing (`--yes` to skip, `--dry-run` to only plan) |
| `diff [dir]` | Show the plan and a unified diff of every change; writes nothing |
| `doctor [dir]` | Check managed files and sections against `.ai-agent-setup/manifest.json` |
| `rollback [dir] [--force]` | Restore the state before the latest install, byte for byte |
| `catalog validate [dir]` | Validate a catalog (schemas, references, policies, context budget) |
| `plan "<task>"` *(V2.1 preview)* | Propose a plan: domains, agents, skills, gates and estimated cost, with an explanation; `--mode`, `--domain`, `--agent`, `--exclude-agent`, `--allow-tools`, `--budget`, `--approve-at`, `--json` |
| `explain <plan-id>` | Show a saved plan with its explanation |
| `impact [files...]` *(V2.1 preview)* | What changed files touch: modules, areas, risk, related tests, CODEOWNERS owners; without files it reads uncommitted git changes, `--since <ref>` diffs against a ref. `plan --files`, `--changed` and `--since` use the same analysis |
| `gates list\|run\|history [dir]` *(V2.2 preview)* | Quality gates with evidence: `list` shows every gate, its support status and the command it would run; `run` executes the required gates (profile + `.ai-agent-setup/gates.json`) and writes redacted, checksummed evidence; exit 0 PASS, 1 FAIL, 2 NOT_VERIFIED. `--gate`, `--skip`, `--run`, `--profile`, `--json` |
| `run <action>` *(V2.1 preview)* | Execution runs (ADR-009): `create <plan-id>`, `approve` and `approve-step` (interactive terminal, id typed back), `deliver --host claude-code\|codex [--dry-run] [--timeout s]`, `event`, `verify <run-id> <step>`, `cancel`, `status`. A run SUCCEEDS only when every step was reported executed and passed its gates; gates passing without execution reports give OUTCOME_VERIFIED (exit 2). Runs are signed with a local key (ADR-016). `deliver --isolation restricted [--network deny] [--pass-env a,b]` runs the host in a macOS kernel sandbox ([guide](docs/guides/runtime-isolation.md)) |
| `isolation check` *(V2.2 preview)* | Runtime Isolation (ADR-017, proposed): platform matrix and, per control, what a profile (`none`, `restricted`, `isolated`) enforces here; exit 2 when the profile cannot be enforced |
| `report [dir]` *(V2.2 preview)* | Execution report across runs: runs by status and integrity, gate pass rate (verified runs only), durations, mixed results on one commit, tokens per host and per accepted outcome (signed usage only); `--since <date>`, `--json`. Read-only; tokens measured, money only as the host's own estimate |

### Create options (same as V1)

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

### Setup options

| Option | Meaning |
|---|---|
| `-a, --adapter claude-code,codex` | hosts to generate for (default: the hosts already configured, otherwise Claude Code) |
| `--profile <id>` | `profile.starter`, `profile.standard` (default), `profile.strict` |
| `--strategy <s>` | conflicts: `write-new` (default: writes `<file>.ai-agent-setup.new` next to yours), `skip`, `backup-overwrite` |
| `--enable-tool <id>` | opt in to an MCP server, e.g. `tool.mcp-github` |

## What gets installed

| | Claude Code | Codex |
|---|---|---|
| Instructions | managed section in `.claude/CLAUDE.md` | managed section in `AGENTS.md` (kept under a 24 KiB budget) |
| Rules | `.claude/rules/` (path-scoped rules use `paths:`) | in `AGENTS.md`; scoped rules become skills |
| Skills | `.claude/skills/` | `.agents/skills/` |
| Agents | `.claude/agents/` (V1 agent names kept) | `.codex/agents/*.toml` |
| Workflows | `/spec`, `/plan`, `/build`, `/test`, `/review`, … in `.claude/commands/` | skills invoked with `$spec`, `$plan`, … |
| Safety | `ask`/`deny` permissions + policy hook in `.claude/settings.json` | policy hook in `.codex/hooks.json`; `workspace-write` sandbox with `on-request` approvals |
| MCP servers | `.mcp.json`, only the ones you enable | `[mcp_servers]` in `.codex/config.toml`, only the ones you enable |

Everything the installer writes is recorded in `.ai-agent-setup/manifest.json` (commit it). Backups
and transaction journals stay local in `.ai-agent-setup/backups/` and `.ai-agent-setup/transactions/`.

## Catalog

All configuration comes from `catalog/`: YAML entries validated by JSON Schemas, organised into 12
capability domains (product, design, frontend, backend, mobile, data and AI, DevOps, quality,
security, architecture, docs and developer experience, integration). Every domain and capability is
defined; most guidance still comes from the V1 rules, skills and agents, and deeper domain content
is on the roadmap.

<!-- catalog-summary:begin (generated by `npm run docs:summary`; do not edit) -->
| Catalog | Count |
|---|---|
| Domains | 12 |
| Capabilities | 123 |
| Agents | 9 canonical + 10 V1 aliases |
| Skills | 14 |
| Rules | 17 (6 always-scoped, 7 path-scoped, 4 capability-scoped) |
| Workflows | 9 |
| Profiles | 3 |
| Tools | 16 MCP servers (opt-in) + 1 other |
| Policies | 2 (12 rules) |
| Adapters | claude-code, codex |
<!-- catalog-summary:end -->

## Known limitations

- **Not tested inside real hosts yet:** generated files follow the Claude Code and Codex docs
  (checked 2026-11-24) and are covered by golden tests, but they have not been loaded into running
  `claude` or `codex` binaries.
- **Codex** loads project `.codex/` config, agents and hooks only in trusted projects, and runs hooks
  only after you approve them with `/hooks`.
- **V1 projects** keep their existing `.claude/settings.json` allow rules, including `Bash(rm *)`;
  `setup` warns about them but does not delete your configuration.
- **Node.js:** CI tests Node 20, 22 and 24. `package.json` still declares `>=18`, which is untested
  (open question OQ-07).
- `--db mysql` / `sqlite` switch the Prisma provider; migrating each template's schema on those
  databases has not been verified.
- **Runtime state protection** blocks agent writes to `.ai-agent-setup/` through the hosts' tools, and
  runs are signed with a key kept in your configuration directory (`ai-agent-setup/keys`). Neither is
  a security boundary against programs the agent runs under your account; see
  [docs/v2/11](docs/v2/11-runtime-threat-model.md).
- **Run delivery and quality gates** have been tested with synthetic commands and a fake host
  process only. Delivering a plan to a real `claude` or `codex` CLI is NOT_VERIFIED; the host message
  formats come from their published docs. The secret scan is pattern-based and does not prove that
  a change is free of secrets.
- **No performance claims:** token, cost and speed effects have not been measured yet. The benchmark
  plan is in [docs/v2/09](docs/v2/09-testing-and-benchmark-strategy.md). CodeGraph's own published
  figures are the vendor's claims and were not measured here.

## Documentation

- [Migrating from V1](docs/guides/migrating-from-v1.md)
- [V2 design documents](docs/v2/README.md): audit, product and architecture specifications,
  roadmap with current status ([08 §9](docs/v2/08-implementation-roadmap.md#9-implementation-status)),
  testing strategy, architecture decisions.
- [Changelog](CHANGELOG.md)

## Development

```bash
npm ci
npm run typecheck
npm run lint              # ESLint with type-aware rules, zero warnings
npm test                  # unit, contract, golden, installer and end-to-end tests
npm run test:coverage     # the same with V8 coverage; fails below 80% on any metric
npm run catalog:validate  # also prints the measured always-loaded context per profile
npm run docs:summary      # refresh the catalog table in both READMEs
```

CI runs on Linux, macOS and Windows with Node 20, 22 and 24.

## Contributing

1. Work on a `feature/*` or `fix/*` branch with conventional commits.
2. Add or update tests; keep `npm test` green.
3. Catalog changes must pass `npm run catalog:validate`.

## License

MIT
