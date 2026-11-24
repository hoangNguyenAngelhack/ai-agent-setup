# 10 — Architecture Decisions

| Field | Value |
|---|---|
| Status | ADR-001–008 **Accepted** (approved in [EXECUTION-SPECIFICATION §3, §13](EXECUTION-SPECIFICATION.md)). ADR-009–013 **Proposed, not approved.** |
| Date | 2026-11-23 |
| Related | [04 Product](04-product-specification.md) · [05 Architecture](05-architecture-specification.md) · [08 Roadmap](08-implementation-roadmap.md) |

## 1. Purpose and scope

This document records the approved architecture decisions, the conflicts found between the approved
direction and the current repository, the proposed (unapproved) decisions, and the open questions.

No approval is implied for anything outside ADR-001–008.

## 2. Accepted decisions

### ADR-001: Universal AI Engineering OS

- **Context:** V1 is a Claude Code config generator focused on Node/React/React Native
  ([01](01-current-state-audit.md), [02 §3](02-feature-inventory.md#3-12-domain-coverage-of-existing-assets)).
  The goal is coverage of the full software lifecycle and a cross-functional audience.
- **Decision:** The product is a Universal AI Engineering OS. All 12 capability domains are
  first-class catalog entities from V2.0 ([05 §6.7](05-architecture-specification.md#67-initial-domain-catalog-v20-foundation)).
- **Alternatives considered:** (a) stay a Claude Code configuration pack and add stacks over time;
  (b) cover only engineering domains (D03–D10) and leave product, design and docs out; (c) cover all
  12 domains but deliver them as README categories without catalog entities.
- **Consequences:** + one model for every role and phase; + roles map to capabilities, not to agents.
  − Large content surface; quality risk is mitigated by depth levels L0–L3 ([08 §6](08-implementation-roadmap.md#6-domain-depth-by-phase)).
  − The V1 global stack opinion must become optional (CF-03).
- **Status:** Accepted. **Date:** 2026-11-23.

### ADR-002: Hybrid orchestration

- **Context:** Beginners need automation; experts and enterprises need control. V1 relies on the host
  model picking agents implicitly, with no plan or explanation.
- **Decision:** Hybrid is the default: the router proposes a plan, the user may accept or edit it,
  and automatic and manual modes are also available. Overrides follow a strict precedence; mandatory
  safety and gates are never bypassable ([05 §7](05-architecture-specification.md#7-hybrid-orchestration)).
- **Alternatives considered:** fully automatic routing only; manual selection only; host-native
  implicit selection (V1 status quo).
- **Consequences:** + transparency through explanation records; + team and enterprise fit.
  − Requires an evaluation suite to keep automatic proposals good (V2.1). − Plan delivery to hosts
  needs a mechanism (ADR-009, proposed).
- **Status:** Accepted. **Date:** 2026-11-23.

### ADR-003: Provider-independent Core

- **Context:** All V1 artifacts are Claude Code-specific. Hosts change formats often (Codex profile
  move in 0.134.0; Claude Code commands merged into skills).
- **Decision:** The Core has no dependency on any host format. Claude Code and Codex are adapters that
  translate canonical contracts ([05 §10](05-architecture-specification.md#10-native-adapters)).
  Enforced by a CI dependency rule.
- **Alternatives considered:** Claude-first core with a Codex exporter; per-host forks of the catalog.
- **Consequences:** + new hosts can be added without touching the Core; + host churn is isolated.
  − Some host features are only `emulated` or `unsupported` on the other host. That status must be
  reported, never hidden.
- **Status:** Accepted. **Date:** 2026-11-23.

### ADR-004: Capability-driven agent architecture

- **Context:** V1 has one agent per job title (15 agents). Extending that to 12 domains and about 90
  roles does not scale and inflates context.
- **Decision:** Separate Domain, Capability, Agent, Skill, Rule, Workflow, Tool and Adapter
  ([05 §2](05-architecture-specification.md#2-terminology-canonical)). Use a small reusable agent set
  ([05 §6.6](05-architecture-specification.md#66-canonical-agent-set-proposed)) specialized through
  skills. Roles are descriptive metadata only.
- **Alternatives considered:** one agent per role; one agent per domain; a single generalist agent
  with no specialization.
- **Consequences:** + reuse; + smaller context; + V1 agents survive as aliases ([07 §2.1](07-migration-strategy.md#21-agents--canonical-agents--skills)).
  − The routing quality burden moves to capability and skill selection.
- **Status:** Accepted. **Date:** 2026-11-23. (The concrete agent list is OQ-04.)

### ADR-005: Local-first execution

- **Context:** The product handles source code; enterprise users need offline and private operation.
  V1 already has no backend, but it does need the network at install (F-07).
- **Decision:** No mandatory cloud backend and no mandatory source-code telemetry. All functions work
  offline after install. Usage data stays in local run logs.
- **Alternatives considered:** a hosted planning service; opt-out telemetry.
- **Consequences:** + privacy and enterprise fit; + reproducibility. − No aggregate usage insight
  unless users share reports voluntarily. − Cost tracking depends on what hosts expose locally (OQ-03).
- **Status:** Accepted. **Date:** 2026-11-23.

### ADR-006: Modular monolith

- **Context:** A single CLI package distributed through npm.
- **Decision:** One package with explicit internal modules and dependency rules
  ([05 §4](05-architecture-specification.md#4-layered-architecture-modular-monolith), [06](06-repository-structure.md)).
  No microservices and no standalone agent runtime. Execution stays in the host.
- **Alternatives considered:** separate packages per adapter (monorepo); a long-running daemon or
  runtime.
- **Consequences:** + simple install and release; + atomic versioning of catalog and adapters.
  − Module discipline must be enforced by tests, not by package boundaries. Splitting packages later
  stays possible.
- **Status:** Accepted. **Date:** 2026-11-23.

### ADR-007: Safe installation

- **Context:** V1 overwrites with `cp -r` or `degit --force`, has no setup for existing projects, and is
  not pinned (F-07, F-10).
- **Decision:** Separate `create` and `setup` workflows with project analysis, detection of existing
  configuration, dry-run, conflict detection, diff, backup, atomic apply, rollback, idempotency,
  version pinning, a manifest and integrity validation ([05 §11](05-architecture-specification.md#11-safe-installer)).
- **Alternatives considered:** overwrite with a warning; git-based safety only (require a clean tree
  and rely on `git checkout`).
- **Consequences:** + no silent data loss; + reviewable team changes. − More implementation and test
  effort (installer matrix, [09 §3.3](09-testing-and-benchmark-strategy.md#33-installer-test-matrix)).
- **Status:** Accepted. **Date:** 2026-11-23.

### ADR-008: Evidence-based quality

- **Context:** V1 quality mechanisms are prose or inert (F-19, F-20). README performance claims are
  unmeasured (F-28).
- **Decision:** Every gate returns PASS, FAIL or NOT_VERIFIED. PASS requires executed evidence; a gate
  that cannot run is NOT_VERIFIED. Reports separate measured values from estimates
  ([05 §12](05-architecture-specification.md#12-quality-system)).
- **Alternatives considered:** model self-assessment; binary pass/fail with a "skipped means pass"
  convention.
- **Consequences:** + trustworthy reports; + benchmark comparability. − More NOT_VERIFIED results in
  environments without the required tools. This is intended.
- **Status:** Accepted. **Date:** 2026-11-23.

## 3. Conflicts between the specification and the repository

None of these reopens an approved decision. Each one has a proposed resolution.

| ID | Conflict | Proposed resolution |
|---|---|---|
| CF-01 | Hybrid orchestration needs the plan at host run time, but a standalone agent runtime is out of scope (EXECUTION-SPECIFICATION §3) | The router runs as a local library invoked on demand by the host (ADR-009 proposed). It is not a resident runtime and runs no models. |
| CF-02 | Codex loads project `.codex/` config, agents and hooks **only in trusted projects**, so policy enforcement through project config is not guaranteed | Setup reports the trust status; generated `AGENTS.md` carries the safety summary (T0); `doctor` flags untrusted state. Enforcement in untrusted Codex projects is `NOT_VERIFIED`. |
| CF-03 | The universal audience conflicts with the V1 `tech-stack.md`, which mandates Next.js, Express, Prisma and so on for all projects | Move it to optional stack profiles selected by detection (TD-19) |
| CF-04 | The README claims "Compatible with 30+ AI coding agents", but only two adapters are approved | Remove the claim; state that other hosts may read `.agents/skills` but are unsupported (F-28) |
| CF-05 | The V1 CLAUDE.md "Sensitive Commands Policy" says `rm -rf` must not run automatically, but V1 `settings.json` allows `Bash(rm *)` | V2 mandatory safety policy is authoritative; generated permissions are derived from it (TD-01) |
| CF-06 | "Cost per accepted outcome" must be measured, but there is no telemetry and host usage data availability differs | Measure from local host artifacts (transcripts, hook payloads, Codex `PostModelRequest`); label everything else `estimated` (OQ-03) |
| CF-07 | EXECUTION-SPECIFICATION §12 does not list an application layer or catalog policies and profiles | [06](06-repository-structure.md) adds `src/app/`, `catalog/policies/`, `catalog/profiles/` and `catalog/tools/`. This extends the structure without contradicting it. |

## 4. Proposed decisions (NOT approved)

| ID | Proposal | Rationale | Decide by |
|---|---|---|---|
| ADR-009 | **Router delivery:** the host obtains plans by calling the local CLI (`plan --json`) from a generated "planner" skill. An optional local stdio MCP server exposing `plan`, `explain` and `verify` is a later option. | Works in both hosts with documented mechanisms (skills); no resident process | Start of V2.1 |
| ADR-010 | **Catalog format:** YAML entries + JSON Schema 2020-12 + Markdown bodies | Human-editable; standard validation tooling | Start of V2.0 (W2.0-03). **Implemented as a working assumption** on `feature/v2-foundation` (2026-11-24); reversible until merged |
| ADR-011 | **Language:** migrate `src/` to TypeScript compiled to `dist/` | Typed contracts for a growing core; consistent with the rules the product ships | Start of V2.0. **Implemented as a working assumption** on `feature/v2-foundation` (2026-11-24); reversible until merged |
| ADR-012 | **Bundled catalog, no runtime download:** catalog shipped in the npm package; `update` changes the version explicitly | Reproducibility and offline use (TD-02) | Start of V2.0 |
| ADR-013 | **Hooks implemented in Node.js**, not shell | Cross-platform (NFR-02); no GNU-only tools (F-20) | Start of V2.0 |

## 5. Open questions

| ID | Question | Impact | Owner |
|---|---|---|---|
| OQ-01 | How do hosts receive and follow a plan (ADR-009 options: skill calling the CLI, MCP server, generated static instructions only)? | V2.1 design | Maintainer |
| OQ-02 | Keep the package name `create-ai-agent-setup` and the manifest directory `.ai-agent-setup/`, or rename to reflect the "OS" positioning? A rename affects npm discoverability and V1 users. | CLI and migration | Maintainer |
| OQ-03 | Which actual token and cost data does each host expose locally (Claude Code transcripts or status data; Codex `PostModelRequest` hook payload)? Needs verification before W2.2-04. | Cost KPIs | Implementer |
| OQ-04 | Is the 9-agent canonical set ([05 §6.6](05-architecture-specification.md#66-canonical-agent-set-proposed)) right, for example whether to split `implementer` by platform? | Routing, migration aliases | Maintainer + review |
| OQ-05 | Who authors new content for D02, D06, D07, D11 and D12 to reach L2, and what review standard applies? | Depth targets ([08 §6](08-implementation-roadmap.md#6-domain-depth-by-phase)) | Maintainer |
| OQ-06 | Should V2 also be distributed as a Claude Code or Codex plugin (host packaging, not a marketplace)? Is this in or out of scope for V2? | Distribution | Maintainer |
| OQ-07 | Minimum Node.js version (V1 says ≥ 18, which is past upstream end of life; check current LTS dates at implementation) | CI matrix, users | Maintainer |
| OQ-08 | Support window for 1.x after V2.0 GA, and whether the V1.x patch track ([08 §2](08-implementation-roadmap.md#2-v1x-maintenance-track-proposed)) is approved | Users on 1.x | Maintainer |
| OQ-09 | Organization policy file location and format (path flag, environment variable, or managed host settings) | Enterprise | Maintainer |
| OQ-11 | Should mentions of payments, tokens, passwords or personal data, and capabilities rated high risk (such as app store release), always add an independent review step? They currently do, which keeps routing minimality at 0.903 against the ≥ 0.95 hypothesis (benchmarks/eval/README.md). | Routing, review cost | Maintainer |
| OQ-10 | Should the default profile for Codex set `sandbox_mode = "workspace-write"` with `approval_policy = "on-request"`? | Security defaults | Security review |

## 6. Acceptance criteria

- [x] ADR-001–008 each include context, decision, alternatives, consequences, status and date.
- [x] No decision beyond ADR-001–008 is marked approved.
- [x] Conflicts with the repository are documented with proposed resolutions.
- [x] Open questions have an owner and an impact.
