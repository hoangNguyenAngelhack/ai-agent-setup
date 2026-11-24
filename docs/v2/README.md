# V2 Documentation: Universal AI Engineering OS

| Field | Value |
|---|---|
| Status | Draft for review. Documentation only; **no implementation is authorized.** |
| Baseline | `main` @ `51bfc3a` (`create-ai-agent-setup` 1.6.1) |
| Date | 2026-11-23 |
| Governing instruction | [EXECUTION-SPECIFICATION.md](EXECUTION-SPECIFICATION.md) |

## Reading order

| # | Document | Answers |
|---|---|---|
| 01 | [Current State Audit](01-current-state-audit.md) | What does V1 actually do? (30 evidenced findings, `F-xx`) |
| 02 | [Feature Inventory](02-feature-inventory.md) | Which V1 assets exist, and how do they map to the 12 domains? |
| 03 | [Technical Debt](03-technical-debt.md) | What must V2 fix, and what can go wrong in migration? (`TD-xx`, `MR-xx`) |
| 04 | [Product Specification](04-product-specification.md) | What is V2, for whom, and with which requirements? (`FR-xx`, `NFR-xx`) |
| 05 | [Architecture Specification](05-architecture-specification.md) | Core, catalog contracts, hybrid routing, context, policy, adapters, installer, quality |
| 06 | [Repository Structure](06-repository-structure.md) | Target layout and where each current path goes |
| 07 | [Migration Strategy](07-migration-strategy.md) | How V1 assets, CLI flags and V1 projects move to V2 |
| 08 | [Implementation Roadmap](08-implementation-roadmap.md) | V2.0, V2.1 and V2.2 work items, dependencies and exit criteria (`W*`) |
| 09 | [Testing & Benchmark Strategy](09-testing-and-benchmark-strategy.md) | How the toolkit is tested and how baseline, V1 and V2 are compared |
| 10 | [Architecture Decisions](10-architecture-decisions.md) | ADR-001–008 (accepted), conflicts, proposed ADRs, open questions |

## Conventions

- **Status labels:** `EXISTING`, `PARTIAL`, `MISSING`, `PLANNED`, `UNVERIFIED` ([01 §1.1](01-current-state-audit.md#11-status-vocabulary)).
  Everything in 04–10 is `PLANNED` unless it is marked otherwise.
- **Terminology:** canonical definitions are in [05 §2](05-architecture-specification.md#2-terminology-canonical).
- **Domain IDs:** D01–D12, defined in [05 §6.7](05-architecture-specification.md#67-initial-domain-catalog-v20-foundation).
- **Host facts** (Claude Code, Codex) were verified against official docs on 2026-11-23 and must be
  re-verified before implementation ([09 §3.5](09-testing-and-benchmark-strategy.md#35-host-compatibility-checks)).
- **Targets and percentages** in these documents are hypotheses unless a benchmark report is cited.
  None has been measured yet.
