# 04 — Product Specification: Universal AI Engineering OS

| Field | Value |
|---|---|
| Status | Draft for review. Direction approved ([EXECUTION-SPECIFICATION §3](EXECUTION-SPECIFICATION.md)); details pending review. |
| Product | `create-ai-agent-setup` V2 (package name retained for V2.0, see OQ-02 in [10](10-architecture-decisions.md#5-open-questions)) |
| Date | 2026-11-23 |
| Related | [05 Architecture](05-architecture-specification.md) · [08 Roadmap](08-implementation-roadmap.md) · [10 ADRs](10-architecture-decisions.md) |

> **Status convention.** Everything in this document is `PLANNED` unless it is marked `EXISTING`.
> V1 behaviour is described in [01](01-current-state-audit.md) and [02](02-feature-inventory.md).

## 1. Positioning

**Universal AI Engineering OS** is a local-first, provider-independent toolkit. It equips AI coding
hosts (initially Claude Code and Codex) with a structured, versioned catalog of engineering
capabilities across the full software lifecycle. It plans and explains which capabilities a task
needs, installs them safely into new or existing repositories, and verifies outcomes with evidence.

It is **not** an agent runtime. Execution happens inside the user's host tool. The toolkit provides
the catalog, the planning, the policy, the installation and the verification around that execution
(ADR-003, ADR-006).

### 1.1 Problem statement

| Problem | V1 evidence |
|---|---|
| Configuration is tied to a single host | All artifacts are Claude Code files (F-07, F-15–F-22) |
| Guidance covers a narrow slice of the lifecycle | Strong only for Node/React/React Native ([02 §3](02-feature-inventory.md#3-12-domain-coverage-of-existing-assets)) |
| Context is static and large | About 125 KB loaded every session (F-18) |
| Installation is unsafe and unreproducible | Unpinned `degit`, no setup, diff or rollback (F-07, F-10) |
| Quality claims are unverified | Inert hooks, prose tiers, no tests (F-14, F-19, F-20) |

### 1.2 Goals

| ID | Goal | Measure (where) |
|---|---|---|
| G-1 | Cover all 12 domains in a canonical catalog | 12/12 domains validate (V2.0, [08](08-implementation-roadmap.md)) |
| G-2 | Work with Claude Code and Codex from one source | Both adapters pass golden tests (V2.0) |
| G-3 | Install into any repository without silent data loss | Rollback integrity 100% in the test matrix ([09](09-testing-and-benchmark-strategy.md)) |
| G-4 | Use the minimum relevant capabilities per task, with explanation | Routing evaluation (V2.1) |
| G-5 | Prove outcomes with evidence and measure cost per accepted outcome | Quality reports and benchmarks (V2.2) |

### 1.3 Non-goals (out of scope for V2)

Marketplace, web dashboard, standalone agent runtime, mandatory cloud backend, mandatory source-code
telemetry, hosting or proxying model calls, and IDE plugins. Hosts other than Claude Code and Codex are
future work ([08 §7](08-implementation-roadmap.md#7-future-phases-not-v2-commitments)).

## 2. Users

The audience is universal. These personas define the defaults and progressive disclosure.

| Persona | Needs | Default experience |
|---|---|---|
| Beginner / solo | One command; safe defaults; no catalog knowledge | `create` or `setup` with an auto-detected profile; hybrid mode with plans auto-accepted for low-risk tasks |
| Experienced developer | Control over agents, skills, tools and budgets | Manual and hybrid flags; `explain` output; per-project overrides |
| Team | Shared, versioned configuration; review of changes | Committed project catalog overrides; diff-based updates; manifest in the repository |
| Enterprise | Policy that cannot be bypassed; audit; offline | Organization policy layer (can only tighten); local-only operation; pinned versions |
| Non-engineering roles (PM, BA, designer, writer) | Domain workflows that need no code knowledge | Domain-scoped workflows (D01, D02, D11) |

## 3. Scope: the 12 capability domains

All 12 domains are first-class catalog entities from V2.0 (ADR-001). The canonical IDs, the
capability lists and the depth levels are defined once in
[05 §6](05-architecture-specification.md#6-capability-registry-and-catalog-contracts). Summary:

| # | Domain | Example outputs |
|---|---|---|
| D01 | Product & Business | PRD, BRD, user stories, acceptance criteria, roadmap, process models |
| D02 | Design & UX | User flows, wireframes, design and component specs, design-system docs, accessibility reports |
| D03 | Frontend Engineering | Components, state and routing, rendering strategy, performance fixes, frontend tests |
| D04 | Backend Engineering | APIs, domain models, auth, data access, messaging, reliability changes |
| D05 | Mobile Engineering | Native and cross-platform features, offline, push, deep links, release builds |
| D06 | Data Engineering & AI/ML | Pipelines, data quality checks, models, evaluations, LLM/RAG integrations |
| D07 | DevOps, Cloud & SRE | CI/CD, IaC, deployment strategy, observability, runbooks, cost reports |
| D08 | Quality Engineering | Test strategy and plans, automated tests, test data, quality reports |
| D09 | Security & Compliance | Threat models, vulnerability findings, dependency and secret checks, compliance maps |
| D10 | Architecture & Technical Leadership | Architecture designs and evaluations, ADRs, reviews, debt registers |
| D11 | Documentation & DevEx | Technical, API and architecture docs, onboarding, changelogs, release notes |
| D12 | Integration & Automation | API and MCP integrations, automation workflows, internal tools |

**Lifecycle coverage.** Discover (D01, D02) → Design (D02, D10) → Build (D03–D06, D12) → Verify (D08,
D09) → Release and Operate (D07) → Document and Improve (D11, D10). One Workflow may span several
domains (ADR-004).

## 4. Interaction modes

Hybrid orchestration is the default (ADR-002). The full contract is in
[05 §7](05-architecture-specification.md#7-hybrid-orchestration).

| Mode | User action | System action |
|---|---|---|
| Automatic | States a task | Classifies the task, selects domains, capabilities and the minimal agent set, loads context, plans, executes through the host, verifies, reports |
| Manual | Names a domain, agent, skill or workflow, order, exclusions, tool limits, budget or approval points | Validates the request against policy, then executes as specified |
| Hybrid (default) | Reviews a proposed plan; accepts, edits, or adds approval points | Proposes the plan with an explanation; applies edits within policy |

**Invariant:** no mode or override can bypass mandatory safety policy or a mandatory quality gate.
Conflicts are reported, never resolved silently.

## 5. Functional requirements

Priority: **M** = must for the phase, **S** = should. Phase is the earliest delivery
([08](08-implementation-roadmap.md)).

| ID | Requirement | Phase | Pri. | Acceptance criteria |
|---|---|---|---|---|
| FR-01 | **Project initialization (`create`)** from a template, with the selected adapters and profile | 2.0 | M | Every flag combination in the option matrix produces the expected file set (golden tests); `-f`, `--db` and `--tier` are honoured (fixes F-04–F-06) |
| FR-02 | **Existing-project setup (`setup`)** | 2.0 | M | Detects existing host configuration; never overwrites user-modified files without explicit consent; produces a manifest |
| FR-03 | **Project analysis**: languages, frameworks, package managers, test runners, CI, existing AI config | 2.0 (detection) / 2.1 (intelligence) | M | Detection fixtures for at least the V1 template stacks plus Python, Java, Go and .NET return the expected profile |
| FR-04 | **Framework and technology detection** feeding the profile selection | 2.0 | M | As FR-03; unknown stacks fall back to the generic profile with a warning |
| FR-05 | **Capability discovery**: `catalog list/show` by domain, capability, agent, skill, rule or workflow | 2.0 | M | Lists all 12 domains; filters by status and adapter support |
| FR-06 | **Automatic orchestration**: task → plan | 2.1 | M | Plan contains domains, capabilities, agents, skills, rules, workflow, tools, gates and a cost estimate; simple tasks yield ≤ 1 agent ([09 §4](09-testing-and-benchmark-strategy.md#4-routing-and-context-evaluation-v21)) |
| FR-07 | **Manual selection** of domain, agent, skill, workflow, order, exclusions, tools, budget and approvals | 2.1 | M | Every manual field is honoured or rejected with a policy reason |
| FR-08 | **Hybrid execution planning**: propose, edit, accept; approval checkpoints | 2.1 | M | Edits are validated; the effective plan and its diff from the proposal are recorded |
| FR-09 | **Context selection**: task-relevant loading under a budget | 2.1 (engine) / 2.0 (static tiers) | M | Always-loaded context per adapter stays within the configured budget; the budget is measured, not estimated |
| FR-10 | **Skill and rule loading** through native host mechanisms | 2.0 | M | Generated artifacts validate against each host's documented format |
| FR-11 | **Workflow execution** through the native adapter | 2.0 (generated workflows) / 2.1 (orchestrated) | M | V1 workflows `spec → plan → build → test → review` remain invocable in both hosts |
| FR-12 | **Quality verification**: gates return PASS, FAIL or NOT_VERIFIED with evidence | 2.2 (engine) / 2.0 (contract) | M | No PASS without an evidence record; a gate that cannot run returns NOT_VERIFIED |
| FR-13 | **Installation management**: dry-run, diff, backup, manifest, integrity check (`doctor`) | 2.0 | M | Dry-run changes zero bytes on disk (hash check); `doctor` detects tampered managed files |
| FR-14 | **Update and rollback** | 2.0 | M | `update` is idempotent; `rollback` restores byte-identical prior state for managed files |
| FR-15 | **Cost and usage reporting**: local, per task and per accepted outcome | 2.2 | S | Each figure is labelled `measured` or `estimated`; no data leaves the machine by default |
| FR-16 | **Benchmark execution** (`bench`) across baseline, V1 and V2 | 2.2 | S | Reproducible under the controls in [09 §5](09-testing-and-benchmark-strategy.md#5-benchmark-methodology-v22) |
| FR-17 | **Documentation generation**: catalog reference, adapter mapping, install report | 2.0 (catalog docs) / 2.2 (release readiness) | S | README counts generated from the catalog; no hand-maintained counts |
| FR-18 | **Explainability**: `explain <plan>` answers the 8 questions in [05 §7.6](05-architecture-specification.md#76-explainability-record) | 2.1 | M | Every plan has a stored explanation record |
| FR-19 | **V1 compatibility**: V1 flags and the positional project name keep working | 2.0 | M | V1 invocations in [07 §3](07-migration-strategy.md#3-cli-compatibility) produce equivalent output |

## 6. Non-functional requirements

| ID | Attribute | Requirement | Verification |
|---|---|---|---|
| NFR-01 | Local-first | All core functions work offline after install; no network call is required except an explicit `update` from a remote source | Test suite run with networking disabled |
| NFR-02 | Cross-platform | macOS, Linux and Windows (PowerShell and Git Bash); no reliance on GNU-only tools (see F-20 `grep -oP`) | CI matrix ([09 §3](09-testing-and-benchmark-strategy.md#3-toolkit-test-strategy)) |
| NFR-03 | Provider-independent core | Core imports no adapter module and no host file format | Static dependency check in CI |
| NFR-04 | Secure by default | Least-privilege host permissions; destructive commands require approval; secrets never written by the installer; no telemetry | Policy snapshot tests; secret-scan fixtures |
| NFR-05 | Extensible | New domain, capability, skill or adapter added without core changes, through catalog entries or the adapter interface | Contract tests |
| NFR-06 | Maintainable | One source of truth per asset; schemas validated in CI | `catalog validate` in CI |
| NFR-07 | Reproducible | Same toolkit version + same inputs ⇒ byte-identical generated files | Golden-file tests |
| NFR-08 | Cost-aware | Plans carry cost estimates; budgets are enforceable as approval thresholds | Routing evaluation |
| NFR-09 | Low context overhead | Always-loaded instruction bytes per adapter ≤ configured budget (default proposed: 24 KiB for Codex, under its 32 KiB limit; a Claude Code default is to be set from V2.2 measurements) | Measured by `doctor --context` |
| NFR-10 | Backward compatible | V1 projects keep working untouched; V1 CLI invocations keep working through V2.x | [07](07-migration-strategy.md) |
| NFR-11 | Reliable installation | ≥ 99% success in the defined test environment (target hypothesis); every failure leaves the pre-install state | Installer matrix ([09](09-testing-and-benchmark-strategy.md)) |
| NFR-12 | Transparent execution | Every write is listed in the dry-run and the manifest; every routing decision has an explanation record | Tests for FR-13 and FR-18 |

## 7. User experience requirements

1. **Zero-knowledge start.** `npx create-ai-agent-setup` (create) and `npx create-ai-agent-setup setup`
   work with no flags. The profile comes from detection and is confirmed in one prompt.
2. **Progressive disclosure.** Default output shows the plan summary; `--explain` shows full
   reasoning; `catalog` is never required.
3. **Sensible defaults.** Hybrid mode; adapters auto-detected from installed host CLIs and existing
   config; standard policy profile; minimal context tier.
4. **Safe by construction.** Destructive or overwriting actions always show a diff and require
   confirmation, or `--yes` combined with a backup.
5. **Team-ready.** All project-level choices live in a committed file
   (`.ai-agent-setup/project.yaml`, see [05 §11](05-architecture-specification.md#11-safe-installer)),
   so teams review changes in pull requests.
6. **Enterprise-ready.** An organization policy file can be supplied (path or environment variable).
   It may only tighten project and user settings.
7. **Honest output.** Reports separate measured values from estimates and say when something was not
   verified.

### 7.1 Proposed CLI surface

The surface below is PLANNED. Names are subject to OQ-02 ([10](10-architecture-decisions.md#5-open-questions)).

| Command | Phase | Purpose |
|---|---|---|
| `create-ai-agent-setup [name] [V1 flags]` | 2.0 | V1-compatible create |
| `… create <name>` | 2.0 | Explicit create |
| `… setup [dir] [--adapter claude-code,codex] [--profile] [--dry-run]` | 2.0 | Integrate into an existing repository |
| `… diff` / `… doctor` / `… update` / `… rollback [--to <txn>]` | 2.0 | Install lifecycle |
| `… catalog list/show/validate` | 2.0 | Discovery and validation |
| `… plan "<task>" [--domain] [--agent] [--skill] [--workflow] [--exclude-agent] [--allow-tools] [--budget] [--approve-at]` | 2.1 | Hybrid planning |
| `… explain <plan-id>` | 2.1 | Routing explanation |
| `… verify [--gates]` / `… report` | 2.2 | Evidence-based quality gates and reports |
| `… bench` | 2.2 | Benchmark runs |

## 8. Product boundaries

| Concern | Toolkit does | Host does |
|---|---|---|
| Catalog and policy | Defines, versions and validates | Consumes the generated native files |
| Planning and routing | Computes and explains the plan | Follows the plan through generated skills, agents or instructions |
| Execution | — | Runs models and tools |
| Permissions | Generates least-privilege native config and hooks | Enforces them |
| Verification | Runs gate commands locally and records evidence | May invoke gates through hooks or skills |
| Cost | Estimates; aggregates local usage data the host exposes | Produces the actual usage |

How the host obtains the plan at run time (CLI call, generated instructions, or a local MCP server) is
an open architectural choice: proposed ADR-009 and OQ-01 in [10](10-architecture-decisions.md).

## 9. Acceptance criteria for this specification

- [x] Positioning, audience, lifecycle coverage and boundaries are stated.
- [x] All 12 domains are included and referenced to the canonical catalog.
- [x] Every FR in EXECUTION-SPECIFICATION §8 has an ID, a phase and acceptance criteria.
- [x] Every NFR has a verification method.
- [x] Existing and planned behaviour are separated.
- [ ] Reviewed by technical leadership. **Pending.**
