# 01 — Current State Audit (V1)

| Field | Value |
|---|---|
| Status | Draft for review |
| Audited revision | `main` @ `51bfc3a` (npm `create-ai-agent-setup` 1.6.1) |
| Audit date | 2026-11-23 |
| Related | [02 Feature Inventory](02-feature-inventory.md) · [03 Technical Debt](03-technical-debt.md) · [07 Migration Strategy](07-migration-strategy.md) |

## 1. Purpose and scope

Record what V1 actually does, with evidence, so the V2 documents start from verified facts instead of
README claims.

**In scope:** `bin/cli.js`, `package.json`, `scripts/`, `Makefile`, `.claude/`, `.agents/`,
`templates/`, `AGENTS.md`, `README.md`, `CHANGELOG.md`, `docs/`, `tasks/`, `.github/`.

**Out of scope:** the quality of the generated application templates as applications. They are
inventoried, not reviewed line by line. Runtime behaviour of third-party tools (CodeGraph, the MCP
servers) is also out of scope.

### 1.1 Status vocabulary

Every finding uses one status from [EXECUTION-SPECIFICATION §2.3](EXECUTION-SPECIFICATION.md):

| Status | Meaning |
|---|---|
| `EXISTING` | Verified in the repository (code read, or behaviour reproduced) |
| `PARTIAL` | Present, but incomplete or not working as documented |
| `MISSING` | Not implemented |
| `PLANNED` | Proposed for V2 (used in later documents, not here) |
| `UNVERIFIED` | Insufficient evidence |

### 1.2 Evidence methods

| Code | Method |
|---|---|
| `R` | Source read; the path and line are cited |
| `X` | Reproduced by running the CLI on 2026-11-23 (Node, macOS) in a throw-away directory outside the repository. Commands used: `node bin/cli.js --version`, `node bin/cli.js demo-nest -t backend -f nestjs -T strict -y`, `node bin/cli.js demo-sqlite -t backend --db sqlite -y` |
| `D` | Checked against official host documentation on 2026-11-23: Claude Code at `code.claude.com/docs`, Codex at `learn.chatgpt.com/docs` and `github.com/openai/codex` (latest stable release 0.171.0). Host behaviour changes often, so re-verify before implementing. |
| `O` | Observed in a live Claude Code session that loaded a configuration derived from this repository |

## 2. What V1 is

V1 is a **project scaffolder plus a static Claude Code configuration pack**:

1. An interactive or flag-driven CLI (`bin/cli.js`) that copies one of seven application templates.
2. At run time it downloads the repository's `.claude/` folder from GitHub.
3. It initializes a git repository and makes one commit.

There is no runtime component. V1 has no project detection, no routing, no orchestration, no quality
gates that produce evidence, and no install manifest. All "intelligence" is static Markdown that the
host agent (Claude Code) reads.

```mermaid
flowchart LR
  U[User] -->|npx create-ai-agent-setup| CLI[bin/cli.js]
  CLI -->|prompts / flags| CFG[config object]
  CLI -->|copyDirRecursive| T[templates/&lt;name&gt;]
  CLI -->|npx degit .../.claude --force| GH[(GitHub main HEAD)]
  CLI -->|mergeUIConfig| UI[templates/ui-configs/&lt;ui&gt;]
  CLI -->|git init + commit| P[New project dir]
  CLI -.optional.->|npx @colbymchenry/codegraph init -i| CG[CodeGraph]
  GH --> P
  T --> P
  UI --> P
```

## 3. Findings

### 3.1 Packaging and CLI

| ID | Finding | Status | Evidence |
|---|---|---|---|
| F-01 | The package is `create-ai-agent-setup` 1.6.1, with `bin` → `bin/cli.js` and published `files` = `bin`, `templates`, `README.md`, `LICENSE`. It has no runtime dependencies and requires `engines.node >=18`. It is CommonJS JavaScript, not TypeScript. | EXISTING | R `package.json` |
| F-02 | **Version drift.** `VERSION = '1.5.1'` (`bin/cli.js:8`), but the package is 1.6.1. The newest CHANGELOG entry is 1.6.0, and tag `v1.6.1` exists. `--version` prints `create-ai-agent v1.5.1`. | PARTIAL | R `bin/cli.js:8`, `CHANGELOG.md`; X |
| F-03 | **Name drift.** The help text and banner say `create-ai-agent`, but the published binary is `create-ai-agent-setup`. | PARTIAL | R `bin/cli.js:48-83, 178` |
| F-04 | **`-f/--framework` is ignored.** `parseArgs` reads `framework`, but the `config` object built in `main()` never copies it (`bin/cli.js:183-193`). `-t backend -f nestjs -y` produced the Express template, and the commit was labelled `backend/express`. README examples that use `-f` do not behave as documented. | PARTIAL | R `bin/cli.js:124-126, 183-193, 227-239`; X |
| F-05 | **The tier is not written to CLAUDE.md.** The replacement regex `/Tier: Standard/` (`bin/cli.js:407`) does not match the template text `**Tier:** Standard`. With `-T strict`, the generated `CLAUDE.md` still said `Standard`, while the commit message said `strict`. | PARTIAL | R `bin/cli.js:407`, `.claude/CLAUDE.md:4`; X |
| F-06 | **`--db` has no effect on the template path.** All template Prisma schemas hard-code `provider = "postgresql"`, and no template contains `{{DATABASE}}`. `--db sqlite` produced a PostgreSQL schema and `DATABASE_URL`. Only the unused fallback `createBackendProject()` honours `--db`. | PARTIAL | R `templates/*/prisma/schema.prisma:6`, `bin/cli.js:576, 684-690`; X |
| F-07 | **The AI configuration is fetched at run time from GitHub HEAD.** `npx degit hoangNguyenAngelhack/ai-agent-setup/.claude .claude --force` (`bin/cli.js:393`) is not pinned to the package version and needs network access. If it fails, the CLI writes a 3-line `CLAUDE.md` and only prints a warning. The packaged `templates/.claude/` is never read by `bin/cli.js`. | PARTIAL | R `bin/cli.js:390-400`; grep shows no `templates/.claude` reference |
| F-08 | **Maintainer-specific settings ship to users.** The root `.claude/settings.json` (the file degit downloads) contains absolute paths under `/Users/<maintainer>/…` in `permissions.allow` and in a top-level `additionalDirectories`. In the generated project, 8 lines contained such paths. | EXISTING (defect) | R `.claude/settings.json:41-61`; X |
| F-09 | `.agents/skills/` (the Agent Skills format) is **not installed by the CLI**. Users can only get it through the manual `npx degit …/.agents` command in the README. | MISSING (in CLI) | R `bin/cli.js`; X (no `.agents/` in output) |
| F-10 | **There is no setup flow for existing projects.** `validateProjectName` rejects any existing directory (X: `Directory "demo-sqlite" already exists`). The alternatives are README "Method 2" (`degit`) and `make copy TARGET=…` (`cp -r .claude $(TARGET)/`). Neither provides detection, diff, backup, rollback or a manifest. | MISSING | R `bin/cli.js:152-157`, `Makefile:28-41`; X |
| F-11 | The CLI runs `git init`, `git add -A` and `git commit` itself. If the commit fails (for example, no git identity configured), the outer `catch` exits with code 1 after the files are already written, leaving a partial project. | UNVERIFIED (inferred from code, not reproduced) | R `bin/cli.js:440-451, 499-503` |
| F-12 | Dead and fallback code: `createVanillaProject()` is never called. `createBackendProject`, `createViteProject` and `createNextjsProject` run only when a template directory is missing. | EXISTING (debt) | R `bin/cli.js:514-528, 1248` |
| F-13 | **Three divergent initializers** exist: `bin/cli.js` (4 types plus frameworks), `scripts/create-project.js` (6 types, uses `npm create vite` / `create-expo-app`), and `scripts/init.sh` (4 types, `cp -r .claude`). Option sets and outputs differ. The scripts are not in the npm package. | EXISTING (debt) | R `scripts/create-project.js:48-56`, `scripts/init.sh:28-42, 124` |
| F-14 | **No automated tests or CI.** `npm test` is `echo "No tests yet"`. `make test` only validates JSON syntax, and `make lint` only lists Markdown files. There is no `.github/workflows/`, and none of the seven templates contains a test file. | MISSING | R `package.json`, `Makefile:44-61`; `ls .github` |

### 3.2 AI configuration pack

| ID | Finding | Status | Evidence |
|---|---|---|---|
| F-15 | **Agents:** there are 15 files in `.claude/agents/`. 11 have `name`/`description` frontmatter, using display names such as `Backend Developer`. The four resolver agents (`node-build-resolver`, `prisma-resolver`, `react-build-resolver`, `react-native-resolver`) **have no frontmatter**. Claude Code requires `name` and `description` for subagents, so these four are not registered as subagents. A live session listed the 11 agents with frontmatter and none of the resolvers. | PARTIAL | R `.claude/agents/*.md`; D sub-agents; O |
| F-16 | **Commands:** 9 files in `.claude/commands/`. Six have frontmatter (`build`, `debug`, `plan`, `simplify`, `spec`, `test`); three do not (`deploy`, `fix-issue`, `review`). The README advertises 8. Claude Code has merged custom commands into skills, but command files still work. | EXISTING | R; D skills |
| F-17 | **Two skill trees with different conventions.** `.claude/skills/` has 6 skills (`code-review`, `data-transform`, `deploy` plus a stray `deploy.md`, `incremental-implementation`, `security-review`, `tdd`), and several `name` values are display strings (`Code Review & Quality`). `.agents/skills/` has 6 skills in Agent Skills format (`code-review`, `nestjs-backend`, `nodejs-backend`, `react-frontend`, `react-native-mobile`, `tdd`) with slug names and `metadata.version: "1.3.5"`. `code-review` and `tdd` exist in both trees with different content. The README lists `data-transform` under "Agent Skills", but it exists only in `.claude/skills/`. | PARTIAL | R |
| F-18 | **Rules:** there are 19 files in `.claude/rules/`: 17 topic rules (as counted in the CHANGELOG, including the optional `honesty.md`), `TIERS.md`, and `react-native.md`. `react-native.md` is undocumented and project-specific ("Mandatory rules for this React Native project", brand red `#DC2626`, `pages/delivery/`). Claude Code **auto-loads all `.claude/rules/*.md` at launch**, and none uses `paths:` scoping. Every generated project therefore loads about 113 KB of rules (`tech-stack.md` alone is 35.5 KB) plus a 12 KB `CLAUDE.md`, whatever its type. Token counts were not measured. | EXISTING (context cost) | R `wc -c`; D memory |
| F-19 | **Tiers are labels only.** Starter, Standard and Strict exist as prose in `TIERS.md`, and nothing enforces their thresholds. The CLI's attempt to write the tier fails (F-05). | PARTIAL | R `.claude/rules/TIERS.md`, `bin/cli.js:407` |
| F-20 | **The hooks are very likely inert.** All 7 scripts read the `$TOOL_INPUT` environment variable. Claude Code delivers hook input as JSON on **stdin** and documents no `TOOL_INPUT` variable, so the scripts see empty input and `exit 0`. Three more problems: (a) `security-scan.sh` never blocks even when it detects a secret (always `exit 0`, and its comment suggests `exit 1`, but Claude Code blocks only on exit code 2 or a JSON `deny` decision); (b) the scripts use `grep -oP`, which macOS BSD grep does not support (there is a `sed` fallback); (c) the "Lifecycle" hooks are bound to `Stop`, which fires after every turn. The session-end event is `SessionEnd`. `cost-tracker.sh` does not measure tokens; its own comment calls it a placeholder. | PARTIAL (documented as working) | R `.claude/hooks/**`, `.claude/settings.json:63-112`; D hooks |
| F-21 | **`settings.json` keys.** `context_window`, `rules_dir`, `commands_dir`, `skills_dir` and `agents_dir` are not documented Claude Code settings and are ignored. `model: "claude-opus-4-5"` is hard-coded. The allow list grants `Bash(rm *)`, `Bash(curl *)`, `Bash(kill *)`, `Edit(*)`, `Write(*)`, `WebFetch(*)` and `mcp__*`. This conflicts with the "Sensitive Commands Policy" in `CLAUDE.md`, which says `rm -rf` must not run automatically. Per the docs, MCP allow-rules need a literal server prefix, so a bare `mcp__*` allow rule may not behave as intended. | PARTIAL | R; D settings, permissions |
| F-22 | **The MCP configs are reference material only.** `.claude/mcp-configs/mcp-servers.json` lists 16 servers. Claude Code reads project MCP servers from `.mcp.json` (project) or `~/.claude.json` (user/local) and does not read this path. The README in that folder tells users to copy it to `~/.claude/mcp-servers.json`, which is not a documented location. | PARTIAL | R; D mcp |
| F-23 | **`AGENTS.md` is generated** from `.agents/skills/` by `scripts/compile-skills.js`. It is 35,465 bytes. Codex reads `AGENTS.md` with a default combined limit (`project_doc_max_bytes`) of 32 KiB, so the generated file would be truncated under Codex defaults. Codex also discovers `.agents/skills/` natively, so V1 already has unplanned and undocumented partial Codex compatibility. | PARTIAL | R `scripts/compile-skills.js:11-12`; D Codex AGENTS.md, skills |
| F-24 | **Two copies of the pack are kept in sync by hand.** `.claude/` and `templates/.claude/` (and `.agents/` and `templates/.agents/`) are near-duplicates. `diff -rq` shows that `references/external-skills.md` is missing from templates and that `settings.json` differs. The committed allow-list contains the `cp` commands used for syncing. | EXISTING (debt) | R `diff -rq .claude templates/.claude` |
| F-25 | **Templates:** there are 7 application templates (`backend`, `backend-nestjs`, `frontend-nextjs`, `frontend-vite`, `fullstack`, `mobile-expo`, `mobile-cli`, with 12–27 files each) and 4 UI overlays (`shadcn`, `antd`, `chakra`, `semantic`) merged through `config.json` (`mergeUIConfig`). | EXISTING | R `templates/`, `bin/cli.js:1096-1164` |
| F-26 | `examples/` holds reference code (backend, frontend, mobile-cli, mobile-expo) that is not shipped in the npm package. | EXISTING | R `examples/`, `package.json#files` |

### 3.3 Documentation and process

| ID | Finding | Status | Evidence |
|---|---|---|---|
| F-27 | **README claims that do not match the code:** "8 Commands" (there are 9); "7 Skills" (6 + 6 in two trees); "7 hooks auto-check" (see F-20); `-f` and `--db` examples (F-04, F-06). | PARTIAL | R `README.md` |
| F-28 | **Third-party or unmeasured claims:** "Compatible with 30+ AI coding agents" and the CodeGraph figures (57% fewer tokens, 35% cheaper, 46% faster, 71% fewer tool calls). This repository contains no measurement for any of them. | UNVERIFIED | R `README.md`, `bin/cli.js:12` |
| F-29 | Task trackers in `tasks/` are stale. For example, `tasks/ecc-integration-todo.md` has every box unchecked although hooks, MCP configs and resolvers were released in 1.6.0. | EXISTING (debt) | R |
| F-30 | There is no V2 documentation before this set (`docs/v2/` did not exist). Earlier feature specs are in `docs/specs/`. | EXISTING | `ls docs` |

## 4. Current limitations against the V2 direction

| V2 requirement ([04](04-product-specification.md)) | V1 position |
|---|---|
| Provider-independent core | MISSING. All artifacts are Claude Code files. Codex compatibility is accidental (F-23). |
| 12 capability domains | PARTIAL. Strongest in frontend, backend and mobile (Node/React only); thin in data/AI, DevOps, docs and integration ([02 §3](02-feature-inventory.md#3-12-domain-coverage-of-existing-assets)). |
| Hybrid orchestration | MISSING. Agents are chosen by the host model from descriptions. No plan, no override contract, no explanation. |
| Dynamic, task-relevant context | MISSING. About 125 KB of always-loaded instructions (F-18). |
| Safe installer (dry-run, diff, backup, rollback, manifest) | MISSING (F-07, F-10). |
| Evidence-based quality gates | MISSING. Hooks are inert (F-20), tiers are prose (F-19). |
| Cost tracking | MISSING. `cost-tracker.sh` is a placeholder (F-20). |
| Reproducible, tested toolkit | MISSING (F-14). |

## 5. Acceptance criteria for this document

- [x] Every finding has a status and at least one evidence reference.
- [x] Behavioural claims about the CLI were reproduced (`X`) or marked `UNVERIFIED`.
- [x] Host-convention claims cite the official documentation (`D`) and the check date.
- [x] README claims are not treated as evidence.
- [ ] A maintainer has reviewed the findings. **Pending.**
