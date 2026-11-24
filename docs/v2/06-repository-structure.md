# 06 — Repository Structure

| Field | Value |
|---|---|
| Status | Draft for review. **Target structure only.** Nothing has been moved. |
| Date | 2026-11-23 |
| Related | [05 Architecture §4](05-architecture-specification.md#4-layered-architecture-modular-monolith) · [07 Migration](07-migration-strategy.md) · [08 Roadmap](08-implementation-roadmap.md) |

## 1. Purpose and scope

This document defines the target directory structure, the responsibilities of each module, the
dependency rules, and where every current path goes. It is input for V2.0 implementation.

**Out of scope:** performing the reorganization. This documentation task does not reorganize the
repository (EXECUTION-SPECIFICATION §12).

## 2. Current structure (EXISTING, `51bfc3a`)

```
ai-agent-setup/
├── bin/cli.js                 # entire V1 CLI (1,404 lines, CommonJS)
├── scripts/                   # compile-skills.js, create-project.js, init.sh (not shipped)
├── templates/                 # 7 app templates + ui-configs + copies of .claude/.agents (shipped)
├── .claude/                   # V1 config pack (source for degit; also used by this repo itself)
├── .agents/skills/            # Agent Skills (6)
├── AGENTS.md                  # generated from .agents/skills
├── examples/                  # reference code (not shipped)
├── docs/{guides,specs,v2}/    # docs; v2 added by this task
├── tasks/                     # planning notes
├── Makefile, README*.md, CHANGELOG.md, CONTRIBUTING.md, LICENSE, package.json
└── .github/                   # issue/PR templates only (no workflows)
```

Problems this structure causes: the source of truth is duplicated (`.claude` and `templates/.claude`,
F-24); the repository's own working config doubles as the product payload (F-08); there is no module
boundary inside `bin/cli.js`.

## 3. Target structure (PLANNED)

File extensions (`.ts`) assume proposed ADR-011 (TypeScript), which is **not approved**. If it is
rejected, the structure stays the same with `.js` files.

```
ai-agent-setup/
├── bin/
│   └── cli.js                      # thin launcher → dist/cli (keeps V1 bin path)
├── src/
│   ├── cli/                        # argument parsing (V1-compatible), prompts, output, commands
│   ├── app/                        # use cases: create, setup, diff, update, rollback, doctor,
│   │                               #   plan, explain, verify, report, bench
│   ├── core/
│   │   ├── contracts/              # shared value types: ProjectProfile, Plan, GateResult, …
│   │   ├── project-detection/
│   │   ├── project-intelligence/
│   │   ├── context/
│   │   ├── planning/
│   │   ├── routing/
│   │   ├── orchestration/
│   │   ├── policy/
│   │   └── evaluation/             # also hosts usage-cost estimation/aggregation
│   ├── registry/
│   │   ├── loader/                 # read catalog/, resolve refs, build index
│   │   ├── validation/             # JSON Schema + semantic checks
│   │   ├── knowledge/              # Knowledge Registry: content bodies + project docs index
│   │   └── {domains,capabilities,agents,skills,rules,workflows}/  # typed accessors per kind
│   ├── adapters/
│   │   ├── adapter.ts              # Adapter interface (05 §10.1)
│   │   ├── claude-code/
│   │   └── codex/
│   ├── installer/                  # op planning, ownership classes, diff, backup, apply, manifest
│   ├── quality/                    # gate runner, evidence capture, reports
│   ├── integrations/               # MCP server definitions, CodeGraph, external tools
│   └── shared/                     # fs abstraction, hashing, logging, errors, platform utils
├── catalog/                        # SINGLE source of truth for content (shipped)
│   ├── schemas/                    # JSON Schemas (envelope + per kind + io + manifest)
│   ├── domains/                    # 12 files: product-business.yaml … integration-automation.yaml
│   ├── capabilities/
│   ├── agents/                     # 9 canonical agents (05 §6.6) + V1 alias entries
│   ├── skills/                     # <id>.yaml + <id>.md (+ resources/)
│   ├── rules/
│   ├── workflows/
│   ├── tools/
│   ├── profiles/                   # starter, standard, strict, stack profiles
│   └── policies/                   # mandatory safety (read-only) + default project policy
├── templates/                      # application templates ONLY (no AI config copies)
├── benchmarks/
│   ├── tasks/                      # ≥30 task definitions (09 §5)
│   ├── fixtures/                   # pinned repository snapshots
│   └── runners/
├── tests/
│   ├── unit/
│   ├── contract/                   # schema + adapter contract tests
│   ├── golden/                     # expected generated trees per option combination
│   ├── installer/                  # dry-run, idempotency, rollback, conflict fixtures
│   └── e2e/                        # CLI end-to-end in temp dirs
├── docs/
│   ├── v2/                         # this document set
│   └── catalog/                    # generated catalog reference (FR-17)
├── scripts/                        # dev-only scripts (catalog build, doc generation)
├── .claude/                        # repo's OWN dev config, generated by the toolkit (dogfooding),
│                                   #   no longer the product payload
└── .github/workflows/              # CI (09 §3.4)
```

## 4. Module responsibilities and dependency rules

| Module | Owns | May depend on | Must not depend on |
|---|---|---|---|
| `cli` | Flags, prompts, rendering, exit codes | `app` | `core` internals, `adapters` internals |
| `app` | Use-case orchestration, transactions | `core`, `registry`, `installer`, `adapters` (via the interface), `quality` | — |
| `core/*` | Provider-independent logic | `core/contracts`, `registry`, `shared` | `adapters`, `installer`, `cli`, host formats |
| `registry` | Catalog loading, validation, query | `shared` | `core` logic, `adapters` |
| `adapters/<host>` | Host-native generation, permission mapping, detection | `core/contracts`, `registry`, `shared` | other adapters, `installer` |
| `installer` | File-operation application, manifest, backup, rollback | `shared` | `adapters`, `core` |
| `quality` | Gate execution and evidence | `core/contracts`, `shared` | `adapters` |
| `integrations` | Definitions of external tools and MCP servers | `registry`, `shared` | `core` logic |

Checked in CI by a dependency rule test (tool choice is an implementation decision; see
[09 §3.1](09-testing-and-benchmark-strategy.md#31-test-layers)).

## 5. Mapping current paths to target (PLANNED moves)

| Current | Target | Notes |
|---|---|---|
| `bin/cli.js` (V1 logic) | `src/cli/*`, `src/app/create`, `templates/` handling in `src/app` | `bin/cli.js` becomes a launcher; V1 flags preserved ([07 §3](07-migration-strategy.md#3-cli-compatibility)) |
| `bin/cli.js` `createBackendProject`/`createViteProject`/`createNextjsProject`/`createVanillaProject` | removed | Dead or fallback code (F-12) |
| `.claude/agents/*.md` | `catalog/agents/` (canonical + V1 alias entries) | See the [07 §2](07-migration-strategy.md#2-v1-asset-mapping) mapping |
| `.claude/skills/*`, `.agents/skills/*` | `catalog/skills/` (deduplicated) | Resolves F-17 |
| `.claude/commands/*.md` | `catalog/workflows/` | Manual entry names unchanged (`spec`, `plan`, …) |
| `.claude/rules/*.md` | `catalog/rules/` (+ `profiles/` for `tech-stack`, `TIERS`) | `react-native.md` removed from the default catalog (TD-08) |
| `.claude/references/*.md` | `catalog/skills/<id>/resources/` or `catalog/rules/` references | T3 context |
| `.claude/hooks/*` | `src/adapters/*/hooks/` generators + `catalog/policies/` | Rewritten to read stdin JSON (TD-03) |
| `.claude/mcp-configs/*` | `src/integrations/mcp/` + `catalog/tools/` | Emitted as `.mcp.json` or `[mcp_servers]` (TD-14) |
| `.claude/settings.json` | Generated by the adapter from policy | No machine paths (TD-01) |
| `templates/.claude`, `templates/.agents` | removed | Generated from `catalog/` (TD-11) |
| `templates/<app>` | `templates/<app>` | Kept; `{{DATABASE}}` wired properly (F-06) |
| `scripts/compile-skills.js` | `src/adapters/codex` (AGENTS.md generation with a byte budget) | TD-13 |
| `scripts/create-project.js`, `scripts/init.sh`, `make init/copy` | deprecated, then removed | [07 §5](07-migration-strategy.md#5-deprecations) |
| `AGENTS.md` (root, generated) | Generated by the Codex adapter for this repo's own use | No longer a product artifact |
| `examples/` | `examples/` | Unchanged; may become benchmark fixtures |

## 6. Package contents (`package.json#files`, PLANNED)

`bin/`, `dist/` (compiled `src/`), `catalog/`, `templates/`, `README.md`, `LICENSE`. `benchmarks/`
and `tests/` are not shipped. Publishing remains manual and requires approval (safety.publish-approval).

## 7. Acceptance criteria

- [x] The target tree covers every module in EXECUTION-SPECIFICATION §12, plus `app/`, `catalog/policies` and `catalog/profiles`.
- [x] Every current top-level path has a destination or an explicit removal.
- [x] Dependency rules are stated in a form a CI test can check.
- [x] Clearly marked as a target, not executed.
