# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2.0.0 (preview)

V2 foundation on branch `feature/v2-foundation`; not published to npm. Design:
[docs/v2](docs/v2/README.md). Upgrade steps: [Migrating from V1](docs/guides/migrating-from-v1.md).

### Added
- `update [dir]` (docs/v2/07 §4.4): updates a V2 installation to this version's catalog with the
  adapters and profile recorded in the manifest, after showing whether the catalog changed. Migration
  paths A to D are now verified on fixtures (B, C, D in `tests/e2e/migration-paths.test.ts`). `update`
  is reserved as a first argument.
- Benchmark task suite (W2.2-03): 36 tasks in `benchmarks/suite/` in the distribution of docs/v2/09 §5.3,
  over four dependency-free fixtures (Node API and web UI, mobile data layer, Python ETL, product
  documents), with hidden checks (mutants for testing tasks; structural checks plus a rubric for
  documents) and a reference solution per task. A test runs the real oracle on every task: the
  fixture is rejected and the solution accepted. Development set: second review and held-out tasks
  pending.
- Evaluation framework (W2.2-02): `npm run bench -- --model <id>` runs a benchmark suite
  (`benchmark-task` YAML) across arms A (V2 permissions only), B (pinned V1) and C (V2) for n
  repetitions in seeded order, judges each trial (data loss outside the task scope, secrets and
  security checks, hidden tests; rubric tasks NOT_VERIFIED), and writes a `benchmark-report` with
  95% bootstrap intervals, paired comparisons, the veto rule and validity (≥ 30 tasks, n ≥ 3).
  Tested against a host test double only; the task suite is W2.2-03.
- Release readiness (W2.2-08): `npm run release:check` runs 13 measured gates (build, typecheck, lint,
  tests with coverage, catalog, evaluation regressions, `npm audit`, CLI version, published file
  list, secrets in published files, documentation links, tested Node range, CHANGELOG entry) and
  reads the sign-off list in [docs/v2/13](docs/v2/13-release-checklist.md); READY needs both.
  `prepublishOnly` now runs it, so `npm publish` stops unless the release is READY.
- KPI report (W2.2-07): `report --kpi [--since date] [--json]` (`kpi-report` schema) reports every KPI of
  docs/v2/09 §6 with definition, source, sample size and status. Measured: task acceptance rate,
  regression rate over gate history, median completion time, human intervention, tokens per accepted
  task, tool calls (now counted from the host stream, each id once); estimated: cost per accepted task
  (host figure). NOT_VERIFIED with the reason: test pass rate, security findings, installation
  reliability. The C-vs-B hypotheses stay NOT_VERIFIED until the benchmark runs.
- Regression detection on the evaluation set (W2.2-06): `benchmarks/eval/baseline.json` records every
  case's checks and metrics; `npm run eval:regressions` reports REGRESSED (a passing check now fails,
  or a metric got worse; sensitive-impact regressions are a veto), STALE (the set changed) or PASS,
  and runs in CI; `npm run eval:baseline` records the baseline again. Seeded faults in the classifier
  and router are detected on exactly the cases they break. Benchmark-run regression rate waits for
  W2.2-02 and W2.2-03.
- Token usage per accepted outcome (W2.2-04): `run deliver` reads the token usage each host prints
  in its own stream (Claude Code: the session total of its result message; Codex: per turn) and
  keeps it as a `host-usage` file signed with the transcript; `report` adds tokens per host and per
  accepted outcome (SUCCEEDED run), only from signed usage files, and gives no per-outcome figure
  while any delivery is unproved. Money is never computed: only Claude Code's own `total_cost_usd`,
  labelled estimated. Real host streams are not yet verified (no CLI installed here).
- Execution reports (W2.2-05): `gate-report` and `execution-report` JSON Schemas; every gate
  report is checked against its records before it is stored (an inconsistent PASS becomes
  NOT_VERIFIED); `report [--since date] [--json]` aggregates execution runs and gate history from
  local artifacts, read-only, with measured figures only.
- Runtime Isolation (W2.2-09, ADR-017 proposed): `isolation check` and `run deliver --isolation
  none|restricted|isolated --network allow|deny --pass-env names`. On macOS, `restricted` runs the host
  in a Seatbelt kernel sandbox (key, credentials, home and temporary directories closed; workspace
  only; `.ai-agent-setup/` read-only; no signals to other processes; optional network deny-all);
  step events go through a host-side inbox signed by the orchestrator; every descendant is killed at
  the end of the run. `isolated` (separate OS user), Linux and Windows are refused with the reason;
  nothing falls back to a weaker profile. Security tests: docs/v2/12.
- Versioned catalog (`catalog/`) validated by JSON Schemas: 12 capability domains, 123
  capabilities, 9 canonical agents, V1 rules, skills, agents and commands migrated unchanged, three
  profiles from the V1 tiers, MCP servers as opt-in tools, and a mandatory safety policy.
- Native adapters for **Claude Code** and **Codex** (`AGENTS.md`, `.agents/skills`, `.codex/`).
- Policy hook for both hosts: asks before destructive commands and blocks writing credentials in
  known token formats.
- Safe installer: dry-run, unified diff, conflict strategies, journaled atomic apply with backups,
  automatic rollback on failure, `rollback`, `doctor`, and `.ai-agent-setup/manifest.json`.
- Commands `setup`, `diff`, `doctor`, `rollback` and `catalog validate`, plus `--adapter`, `--profile`,
  `--strategy` and `--enable-tool`.
- Project detection for JavaScript/TypeScript, Python, Java/Kotlin, Go, .NET, Rust, Ruby, PHP,
  Flutter, native mobile, CI providers and monorepo workspaces.
- `plan` and `explain` (V2.1 preview): a deterministic task classifier and hybrid router that
  propose domains, agents, skills, gates and an estimated cost, with an explanation record.
  Manual selections only narrow the plan; conflicts are reported. Routing is measured on a
  140-task development set with `npm run eval:routing`.
- `impact` (V2.1 preview): Project Intelligence and Impact Analysis. Changed files (given, uncommitted
  or since a git ref) are mapped to modules, areas, capabilities, risk, related tests and CODEOWNERS
  owners. `plan --files`, `--changed` and `--since` use the result: risk follows touched areas,
  path-scoped rules load only for matching files, and steps are ordered by execution phase with
  dependencies.
- `gates list|run|history` (V2.2 preview): Quality Gate Engine with 14 gates over 11 categories,
  each with an explicit support status. PASS needs executed evidence; missing commands, missing
  tools, timeouts, cancellation, stale coverage and skipped required gates are NOT_VERIFIED. Evidence
  logs are redacted and checksummed; records, reports and history stay in git-ignored folders.
  Exit codes: 0 PASS, 1 FAIL, 2 NOT_VERIFIED.
- `run` (V2.1 preview, ADR-009): canonical execution plans with immutable approved revisions, an
  event log, step states, dependency and approval enforcement, gate-based step verification,
  reconciliation, and plan delivery to `claude` / `codex` (not yet verified against a real host).
- Impact-based reviews (ADR-014): payment, credential and personal-data work gets a mandatory
  specialist review with a recorded reason; words in unrelated contexts (design tokens, token usage,
  fixtures, UI copy, docs) no longer trigger one. Policy rule `project.run-approval` makes an agent
  ask before approving or cancelling a run.
- Development checks: `npm run lint` (ESLint 9 + typescript-eslint, type-aware, zero warnings) and
  `npm run test:coverage` (V8, 80% minimum for statements, branches, functions and lines), both in
  CI. `gate.coverage-80` / `-95` 1.1.0 now check all four metrics, not only lines.
- Run integrity (ADR-016): approvals, events and recorded evidence are signed with a per-project key
  kept outside the project; unsigned or changed events, replaced evidence and truncated logs are
  reported as `INTEGRITY_VIOLATION` and rule out SUCCEEDED; agents are denied the key directory
  (shell, writes, Claude Code `Read`/`Grep`/`Glob`). Threat model in `docs/v2/11`. Not a boundary
  against code the agent runs under the same OS account.
- `run deliver`: `--timeout`, cancellation with Ctrl-C (the host process tree is stopped),
  `--event-command`, the redacted host transcript kept as signed evidence of the run. Tested with a
  fake host; real Claude Code and Codex CLIs are not verified yet (W2.0-15).
- `run approve` and `run approve-step` need an interactive terminal and the id typed back.
- Planned: Runtime Isolation (W2.2-09), the boundary ADR-016 does not provide.
- Installer and policy branch coverage enforced at 95% (98.84% and 96.88%).
- Early step events (ADR-015): host work on a step whose dependencies the host finished is accepted
  before the orchestrator verified them; earlier events are kept, replayed in log order and flagged
  `DEPENDENCY_ORDER_VIOLATION`; gates run only after the dependencies succeeded; a pending approval is
  never lost and keeps the run from SUCCEEDED. `run-result` rules version 2 (`deferred`,
  `approval.pending`); `run status` reports what changed when an old log is replayed.
- Runtime state protection: mandatory policy rules deny agent writes to `.ai-agent-setup/**` (file
  tools, Codex patches and shell writes) and ask before other shell access; policies can now match
  written paths (`match.paths`). A gate never passes on a command that checks nothing. A guard, not
  a security boundary against code the agent runs under the same account.
- `run-result` JSON Schema: `run status` validates the final report and never reports an invalid
  result as SUCCEEDED. SUCCEEDED needs both the outcome (gates) and execution evidence (host step
  reports); gates passing without execution reports give OUTCOME_VERIFIED.
- Test suite (unit, contract, golden, installer, end-to-end, V1 characterization) and CI on Linux,
  macOS and Windows with Node 20, 22 and 24.

### Changed
- Node.js 20 or later is required (`engines.node >=20.0.0`, was `>=18.0.0`): Node 18 is past upstream
  end of life and was never tested; CI tests 20, 22 and 24 (OQ-07, decided by the maintainer).
- The package no longer ships `templates/.claude` and `templates/.agents` (unused by V2; removed in
  2.0 by docs/v2/07 §5): 76 fewer published files. They stay in the repository for the V1
  scripts deprecated until 2.1.
- `bin/cli.js` is a launcher for the TypeScript CLI in `dist/`; the package now ships `dist/` and
  `catalog/`.
- The AI configuration is generated from the bundled catalog instead of being downloaded from GitHub
  at create time.
- `.claude/settings.json` no longer contains an `allow` list; destructive commands are `ask`.
- `.claude/CLAUDE.md` is a generated managed section.
- Rules load by scope: five always, language and area rules by file path, four on demand.
- Unknown options are errors; `create`, `setup`, `diff`, `doctor`, `rollback` and `catalog` are
  reserved as first arguments.

### Fixed
- Claude Code token usage was undercounted: per-message usage in its stream carries the output
  count from the start of each message (found with the installed CLI 2.1.332: 23 output tokens per
  message against 321 in the session total). Usage now comes from the result message's
  `modelUsage`, which also counts auxiliary model calls; per-message usage is only the fallback when
  the host stops early, and is labelled possibly incomplete.
- Stored host transcripts are valid JSON again: redaction ran on the raw text of each stream line and
  left unbalanced quotes and braces. JSON lines are now redacted field by field with the same rules
  (every key and string, plus any value under a sensitive key name such as `token` or `api_key`);
  other lines are redacted as text, as before.
- `run deliver` cancelled with Ctrl-C could exit 1 after a 10-second wait instead of recording
  RUN_CANCELLED: stopping the host's process tree also killed the agent's in-flight `run event`,
  which left the run lock behind (taken over only after 30 seconds). The lock now records its owner
  process and is taken over at once when that process no longer exists.
- `-f/--framework`, `--db` and `-T/--tier` were ignored.
- `--version` printed 1.5.1; help used the wrong command name.
- Generated `settings.json` contained the maintainer's machine paths.
- Hooks never received their input, and the secret scan never blocked.
- A failed git commit left a half-created project.
- Build resolver agents had no frontmatter and were never loaded.
- README counts and unmeasured performance claims (counts are now generated from the catalog).

### Deprecated
- `scripts/init.sh`, `scripts/create-project.js`, `make init` and `make copy` (removal planned for
  2.1).

### Also on `main` since 1.6.1 (not in any npm release)
- `data-transform` skill (a993136, a47a057, 51bfc3a).
- Vietnamese README (182e046).

## [1.6.1] - 2026-06-02

- Published the changes listed under 1.6.0 below; there is no separate `v1.6.0` tag in git.
- Redesigned README (0c42fd1).
- Known issue: `--version` printed `1.5.1` (fixed in 2.0).

## [1.6.0] - 2026-06-02

### Added
- **Hooks System** — Automated checks before/after tool operations
  - PreToolUse hooks: `security-scan.sh` (block secrets), `lint-check.sh`
  - PostToolUse hooks: `auto-format.sh`, `typescript-check.sh`, `console-log-warn.sh`
  - Lifecycle hooks: `session-summary.sh`, `cost-tracker.sh`
  - `.claude/hooks/README.md` with documentation
- **MCP Server Configs** — Pre-configured MCP servers collection
  - `mcp-servers.json` — Full collection (16 servers)
  - `mcp-servers.minimal.json` — Minimal set (3 servers)
  - `.env.example` — Environment variables template
  - Servers: Supabase, Vercel, Playwright, GitHub, Sentry, and more
- **Build Resolver Agents** — Specialized agents for fixing build errors
  - `react-build-resolver.md` — React/Next.js build errors
  - `react-native-resolver.md` — Metro, iOS, Android build errors
  - `node-build-resolver.md` — npm, TypeScript, ESM/CJS issues
  - `prisma-resolver.md` — Migration, schema, query errors
- **Language-Specific Rules** — Best practices for specific languages
  - `typescript-patterns.md` — Type safety, generics, utility types
  - `python-patterns.md` — PEP8, type hints, async patterns
  - `sql-patterns.md` — Query optimization, N+1 prevention, indexes

### Changed
- Updated CLAUDE.md with Hooks System and MCP Configs sections
- Updated README.md with new features documentation
- Agent count increased from 11 to 15
- Rule count increased from 14 to 17

---

## [1.5.1] - 2026-05-26

### Added
- **Honesty Rule** — Optional rule to reduce AI hallucinations
  - New CLI flag `--honesty` / `-H` to include honesty rule
  - Interactive prompt (Step 8) asking user to include rule
  - Rule instructs Claude to:
    - Acknowledge uncertainty instead of fabricating answers
    - Never invent sources, statistics, or quotes
    - Flag information that may be outdated
- **Honesty Guide** — Documentation for setting up honesty prompt
  - `docs/guides/claude-honesty-prompt.md` (English)
  - `docs/guides/claude-honesty-prompt-vi.md` (Vietnamese)

### Changed
- CLI now has 9 steps (added honesty rule step after CodeGraph)
- Updated rules count from 13 to 14

---

## [1.5.0] - 2026-05-25

### Added
- **UI Library Selection** for frontend projects
  - New CLI flag `--ui` / `-u` to specify UI library
  - Interactive prompt for UI library selection
  - 4 UI library options: `shadcn`, `antd`, `chakra`, `semantic`
- **UI Config Templates** (`templates/ui-configs/`)
  - `shadcn/` — Radix UI + Tailwind CSS components (Button, Input, Card)
  - `antd/` — Ant Design components with Tailwind integration
  - `chakra/` — Chakra UI components with theme provider
  - `semantic/` — Semantic UI React components
- **Tailwind + Ant Design Compatibility**
  - Automatic `important: true` in tailwind.config for antd
  - Automatic `preflight: false` to prevent Tailwind resetting antd styles
- **Component Files**: Each UI library includes Button, Input, Card components

### Changed
- CLI now shows UI library in configuration summary
- Commit label includes UI (e.g., `frontend/nextjs/antd`, `frontend/vite/shadcn`)
- Updated README with UI library examples

### Technical Details
- New `mergeUIConfig()` function handles:
  - Dependency merging into package.json
  - File copying from ui-configs to project
  - Tailwind config modifications for antd compatibility

---

## [1.4.0] - 2026-05-25

### Added
- **NestJS Backend Template** (`templates/backend-nestjs/`)
  - Full NestJS setup with TypeScript
  - Prisma ORM with User model and Role enum
  - JWT authentication with Passport
  - Role-based access control (RBAC) with `@Roles()` decorator
  - Redis caching via `@nestjs/cache-manager`
  - Swagger/OpenAPI documentation at `/api-docs`
  - Global HTTP exception filter
  - Custom decorators (`@CurrentUser`, `@Roles`)
  - Repository pattern for data access
  - Modular structure (auth, users modules)
- **Backend Framework Selection** in CLI
  - New prompt: "Backend framework: Express or NestJS?"
  - Express remains the default for quick setup
  - NestJS option for enterprise/DI patterns

### Changed
- CLI now shows framework in summary for backend projects
- Commit label includes framework (e.g., `backend/nestjs`, `backend/express`)
- Updated README with NestJS documentation

---

## [1.3.5] - 2026-05-25

### Added
- **NestJS Skill**: New `nestjs-backend` skill for enterprise NestJS development
  - Dependency Injection patterns
  - Guards, Interceptors, Pipes
  - TypeORM/Prisma integration
  - Microservices patterns
- **Impact Levels**: All skills now include severity levels (CRITICAL, HIGH, MEDIUM)
- **Compile Script**: `scripts/compile-skills.js` generates `AGENTS.md` from all skills
- **AGENTS.md**: Auto-generated compiled output of all skills

### Changed
- **Skills Updated**: All 6 skills now have impact level annotations
- **Better Organization**: Skills follow agent-nestjs-skills patterns

---

## [1.3.3] - 2026-05-25

### Added
- **Agent Skills (Open Standard)**: Added 5 skills following [agentskills.io](https://agentskills.io) standard
  - `nodejs-backend` — Express, Prisma, Redis, BullMQ patterns
  - `react-frontend` — Next.js/Vite, TailwindCSS, Zustand, TanStack Query
  - `react-native-mobile` — Expo/RN CLI, NativeWind, React Navigation
  - `code-review` — Five-axis code review framework
  - `tdd` — Test-Driven Development workflow
- **`.agents/skills/` Directory**: Skills compatible with 30+ AI agents
- **Agent Skills Badge**: Added compatibility badge to README

### Changed
- **README Reorganization**: Complete restructure for better readability
  - Added Table of Contents
  - Grouped installation methods together
  - Created dedicated Integrations section
  - Added compatible agents table with install commands
  - Added Related Projects section

### Compatible Agents
Claude Code, Cursor, VS Code Copilot, OpenAI Codex, Gemini CLI, Junie, OpenCode, OpenHands, and 20+ more

---

## [1.3.2] - 2026-05-25

### Added
- **CodeGraph Integration**: Optional MCP server for semantic code exploration
  - New CLI flag `--codegraph` / `-c` to setup during project creation
  - Interactive prompt (step 7) asking about CodeGraph setup
  - Auto-runs `npx @colbymchenry/codegraph init -i` when enabled
- **Documentation**: Added "Recommended Tools" section to CLAUDE.md with CodeGraph benefits and usage

### CodeGraph Benefits
- 57% fewer tokens processed
- 35% cost reduction on average
- 46% faster responses
- 71% fewer tool calls

---

## [1.3.1] - 2026-05-21

### Changed
- Version bump for npm publish fix

---

## [1.3.0] - 2026-05-21

### Added
- **Pre-built Templates**: All project types now use pre-built templates instead of generating code inline
- **Template Directory**: `templates/` folder with ready-to-use project structures

### Changed
- CLI now copies from `templates/` directory for faster project creation
- Improved placeholder replacement for project configuration

---

## [1.2.0] - 2026-05-20

### Added
- **Project Templates**: Added `templates/` folder with pre-configured project structures
- **Improved Permissions**: Better default permissions in settings.json

---

## [1.1.0] - 2026-04-29

### Added
- **Mobile Support**: Full React Native development support with both Expo and React Native CLI
- **Mobile Developer Agent**: New agent (`agents/mobile.md`) for React Native development
- **Mobile References**: 
  - `mobile-performance-checklist.md` — FPS, memory, bundle size optimization
  - `mobile-release-checklist.md` — App Store & Play Store submission requirements
- **Mobile Examples**: 
  - `examples/mobile-expo/` — 10 example files for Expo projects
  - `examples/mobile-cli/` — 8 example files for React Native CLI projects
- **Mobile Templates**:
  - `templates/mobile-expo/` — Ready-to-use Expo project template
  - `templates/mobile-cli/` — Ready-to-use React Native CLI project template
- **Create Project Script**: Added `mobile-expo` and `mobile-cli` options to `scripts/create-project.js`

### Changed
- **tech-stack.md**: Added 15 new entries for mobile development (React Native, Expo, NativeWind, React Navigation, MMKV, Reanimated, etc.)
- **CLAUDE.md**: Added Mobile Developer agent and mobile references to documentation

### Tech Stack (Mobile)
- Framework: React Native 0.74+ / Expo SDK 51+
- Navigation: React Navigation 6 / Expo Router
- Styling: NativeWind (Tailwind CSS)
- State: Zustand + MMKV
- Server State: TanStack Query
- Forms: React Hook Form + Zod
- Animations: react-native-reanimated
- Images: expo-image / FastImage
- Storage: expo-secure-store / react-native-keychain

---

## [1.0.0] - 2026-04-28

### Added
- Initial release with production-ready Claude Code configuration
- **Workflow**: `/spec` → `/plan` → `/build` → `/test` → `/review` → `/deploy`
- **10 Agents**: Frontend, Backend, Systems Architect, Code Reviewer, Test Engineer, Security Auditor, QA, Project Manager, UI/UX Designer, Copywriter/SEO
- **13 Rules**: clean-code, code-style, error-handling, tech-stack, system-design, project-structure, api-conventions, naming-conventions, database, security, monitoring, testing, git-workflow
- **5 Skills**: TDD, code-review, incremental-implementation, deploy, security-review
- **4 References**: security-checklist, testing-patterns, performance-checklist, accessibility-checklist
- **Examples**: Backend (11 files) and Frontend (4 files) sample implementations

### Tech Stack
- Frontend: Next.js 14, React, Vite, Tailwind CSS, shadcn/ui, Zustand, TanStack Query
- Backend: Express.js, TypeScript, Prisma, PostgreSQL, Redis, BullMQ
- Testing: Vitest, Playwright
- Monitoring: Prometheus, Grafana, Pino

---

## Version Guidelines

### When to bump versions

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking rule changes | Major (X.0.0) | Changing required test coverage from 80% to 90% |
| New rules/agents/commands | Minor (0.X.0) | Adding a new `/audit` command |
| Bug fixes, typos, clarifications | Patch (0.0.X) | Fixing a typo in documentation |

### How to document changes

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or rules

### Changed
- Updates to existing rules (document old → new)

### Deprecated
- Rules that will be removed in future versions

### Removed
- Rules or features that were removed

### Fixed
- Bug fixes or corrections
```
