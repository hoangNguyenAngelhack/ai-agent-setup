<div align="center">

# AI Agent Setup

### One catalog of engineering rules, skills and agents, installed natively for Claude Code and Codex

[![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/create-ai-agent-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-20%20%7C%2022%20%7C%2024-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

**English** | **[Tiếng Việt](README.vi.md)**

```bash
npx create-ai-agent-setup setup
```

</div>

AI Agent Setup gives your coding agent the rules, skills, agents and workflows of an experienced
engineering team, for the languages your project uses, and puts guard rails around what the agent
may do. It writes the native configuration of each host (`.claude/` for Claude Code; `AGENTS.md`,
`.agents/` and `.codex/` for Codex) and manages it like a dependency: reviewable, updatable and
reversible.

## Why use it

- **Native for both hosts.** One versioned catalog becomes Claude Code rules, skills, agents and
  slash commands, and Codex `AGENTS.md`, skills, agents and configuration.
- **Only what your project needs.** It detects your stack and installs the language packs you use:
  a Go service gets Go guidance, not React's. Language rules load only when the agent touches those
  files, so the always-loaded context stays small.
- **Safe to install.** Every change is shown as a diff first, backed up, and undone with `rollback`.
  Files you edited are never overwritten: the new version is written next to yours.
- **Guard rails.** A policy hook checks every shell command and file write. Destructive commands
  (`rm -rf`, `git push --force`, `DROP TABLE`) and publishing in any ecosystem (`npm publish`,
  `cargo publish`, `docker push`, …) need your approval; writing a known credential format is blocked.
- **Verification, not claims.** Quality gates run your project's own build, tests, linters, coverage
  and dependency audit, and record evidence. Anything they cannot check is reported as
  NOT_VERIFIED, never as a pass.

## Quick start

Requires Node.js 20 or later.

```bash
# In an existing project: review, then apply
npx create-ai-agent-setup diff
npx create-ai-agent-setup setup --yes

# Add Codex as well (or only Codex)
npx create-ai-agent-setup setup --adapter claude-code,codex --yes

# Start a new project from a template
npx create-ai-agent-setup my-api -t backend -f nestjs -y
```

Then open the project in Claude Code or Codex. For Codex, trust the project and approve its hooks
with `/hooks`: Codex loads project configuration only in trusted projects.

## Supported languages

| Stack | Guidance installed | Gates it can run |
|---|---|---|
| TypeScript / JavaScript | TypeScript rules; Node, React, React Native and Prisma skills | `package.json` scripts, coverage (Istanbul), `npm audit` |
| Python | Python rules, build skill | pytest, Ruff, mypy, coverage (pytest-cov), pip-audit |
| Go | Go rules, build skill | `go build`, `go test`, `go vet`, coverage, govulncheck |
| Java, Kotlin | Java and Kotlin rules, JVM build skill | Maven or Gradle build and tests, ktlint or detekt, JaCoCo |
| Android | Android rules, build skill | Gradle, Android Lint |
| C# / .NET | C# rules, .NET build skill | `dotnet build`/`test`/`format`, coverlet, vulnerable packages |
| Rust | Rust rules, build skill | `cargo build`/`test`/`clippy`/`check`, cargo-llvm-cov, cargo-audit |
| PHP | PHP rules, build skill | PHPUnit or Pest, PHPStan, coverage, `composer audit` |
| Ruby | Ruby rules, build skill | RSpec or Minitest, RuboCop, SimpleCov, bundler-audit |
| Swift | Swift rules, build skill | `swift build`/`test`, SwiftLint, coverage |
| Dart / Flutter | Dart and Flutter rules, build skill | `flutter test`/`analyze` (or `dart`), coverage |
| C / C++ | C and C++ rules, build skill | CMake and CTest |

Gates run only tools your project declares: no RuboCop gate unless the project uses RuboCop. Every
project also gets the shared guidance: architecture, API design, testing, security, Git workflow,
code review, and agents for planning, implementation, review and security.

## Everyday commands

| Command | What it does |
|---|---|
| `setup [dir]` | Install the configuration (asks first; `--yes` to apply, `--dry-run` to only plan) |
| `diff [dir]` | Show every change as a diff; writes nothing |
| `update [dir]` | Move to the catalog of the installed version; your edits are kept |
| `doctor [dir]` | Check the installation against its manifest |
| `rollback [dir]` | Restore the state before the last install, byte for byte |
| `gates run [dir]` | Run the required quality gates and record evidence |
| `create <name>` | Create a project from a template (Express, NestJS, Next.js, Vite, fullstack, Expo, React Native) |

Planning, impact analysis, execution runs, reports and runtime isolation are in the
[CLI reference](docs/guides/cli-reference.md), with every option.

## What gets installed

| | Claude Code | Codex |
|---|---|---|
| Instructions | managed section in `.claude/CLAUDE.md` | managed section in `AGENTS.md` (kept under a 24 KiB budget) |
| Rules | `.claude/rules/` (language rules are path-scoped) | in `AGENTS.md`; scoped rules become skills |
| Skills | `.claude/skills/` | `.agents/skills/` |
| Agents | `.claude/agents/` | `.codex/agents/*.toml` |
| Workflows | `/spec`, `/plan`, `/build`, `/test`, `/review`, … | skills invoked as `$spec`, `$plan`, … |
| Safety | `ask`/`deny` permissions and the policy hook in `.claude/settings.json` | policy hook in `.codex/hooks.json`; `workspace-write` sandbox with `on-request` approvals |
| MCP servers | `.mcp.json`, only those you enable | `[mcp_servers]` in `.codex/config.toml`, only those you enable |

Everything written is recorded in `.ai-agent-setup/manifest.json` (commit it). Backups and
transaction journals stay local in `.ai-agent-setup/`.

## Catalog

All configuration comes from `catalog/`: YAML entries checked against JSON Schemas, organised into
12 capability domains, from product and design to security, DevOps and data.

<!-- catalog-summary:begin (generated by `npm run docs:summary`; do not edit) -->
| Catalog | Count |
|---|---|
| Domains | 12 |
| Capabilities | 123 |
| Agents | 9 canonical + 10 V1 aliases |
| Skills | 25 |
| Rules | 29 (6 always-scoped, 19 path-scoped, 4 capability-scoped) |
| Workflows | 9 |
| Profiles | 3 |
| Tools | 16 MCP servers (opt-in) + 1 other |
| Policies | 2 (12 rules) |
| Adapters | claude-code, codex |
<!-- catalog-summary:end -->

## Status and known limitations

The current release is listed on [npm](https://www.npmjs.com/package/create-ai-agent-setup) and in
the [changelog](CHANGELOG.md). What is verified, and what is not yet:

- **Claude Code:** plan delivery, stream events, token usage and permissions were checked with the
  installed CLI (2.1.332). **Codex** (0.172.0) is partly verified: start, failure, timeout and
  cancellation, but not a signed-in run. Codex runs only in a Git repository or trusted directory.
- **No effectiveness claims yet.** The benchmark that compares agents with and without this
  configuration is built and reviewed, but has not been run on real hosts.
- **Gate defaults** follow each tool's documentation and are tested with fixtures, not against every
  real toolchain. The dependency-audit tools' result messages are unverified; a mismatch gives
  NOT_VERIFIED, never a false pass.
- **Runtime isolation** (`run deliver --isolation restricted`) is a macOS-only preview; Linux and
  Windows are not supported yet ([guide](docs/guides/runtime-isolation.md)).
- **Guard rails are not a sandbox.** The policy hook and signed runs protect against mistakes, not
  against programs the agent runs under your account ([threat model](docs/v2/11-runtime-threat-model.md)).
- **V1 projects** keep their existing `.claude/settings.json` allow rules (including broad ones such
  as `Bash(rm *)`); `setup` warns about them but does not delete your configuration.
- `--db mysql` or `sqlite` switches the Prisma provider; each template's schema on those databases
  is not verified.

## Upgrading from 1.x

Read [Migrating from V1](docs/guides/migrating-from-v1.md), then run `diff` before `setup`. 1.x stays
available as `npx create-ai-agent-setup@1` and gets security fixes until 2027-05-25.

## Documentation

- [CLI reference](docs/guides/cli-reference.md)
- [Migrating from V1](docs/guides/migrating-from-v1.md)
- [Runtime isolation](docs/guides/runtime-isolation.md)
- [Language packs and gates](docs/v2/16-language-packs.md)
- [Design documents](docs/v2/README.md): architecture, decisions, roadmap and status
- [Changelog](CHANGELOG.md)

## Development

```bash
npm ci
npm run typecheck
npm run lint              # type-aware ESLint, zero warnings
npm test                  # unit, contract, golden, installer, security and end-to-end tests
npm run test:coverage     # fails below 80% on any metric
npm run catalog:validate  # also prints the always-loaded context per profile
npm run docs:summary      # refresh the catalog table in both READMEs
```

CI runs on Linux and Windows with Node 20, 22 and 24, and on macOS with Node 20 and 24. To contribute: work on a `feature/*`
or `fix/*` branch with conventional commits, add tests, and keep `npm test` and
`npm run catalog:validate` green.

## License

MIT
