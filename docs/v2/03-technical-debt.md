# 03 — Technical Debt and Migration Risks

| Field | Value |
|---|---|
| Status | Draft for review |
| Baseline | `main` @ `51bfc3a` (1.6.1) |
| Date | 2026-11-23 |
| Related | [01 Audit](01-current-state-audit.md) · [07 Migration](07-migration-strategy.md) · [08 Roadmap](08-implementation-roadmap.md) |

## 1. Purpose and scope

This document ranks the technical debt and risks that V2 must resolve or carry, and the risks that the
migration itself introduces.

**In scope:** debt that is verified in [01](01-current-state-audit.md), and migration risks.

**Out of scope:** debt inside the generated application templates, beyond what affects installation.

### Severity scale

| Severity | Definition |
|---|---|
| Critical | Security exposure, or user data or configuration loss |
| High | A documented feature does not work, or the result is not reproducible |
| Medium | Maintainability or cost problem with a workaround |
| Low | Cosmetic or documentation drift |

## 2. Debt register

| ID | Debt | Sev. | Findings | Impact | V2 resolution |
|---|---|---|---|---|---|
| TD-01 | Maintainer machine paths and a broad allow-list (`rm *`, `curl *`, `kill *`, `Edit(*)`, `Write(*)`) ship in generated `settings.json` | Critical | F-08, F-21 | Leaks maintainer paths. The policy grants destructive commands, contradicting the CLAUDE.md "Sensitive Commands Policy". | Policy Engine generates least-privilege host permissions from canonical policy ([05 §9](05-architecture-specification.md#9-policy-engine)). Recommended V1.x patch: [08 §2](08-implementation-roadmap.md#2-v1x-maintenance-track-proposed). |
| TD-02 | Configuration fetched from GitHub HEAD at run time (`degit`), not from the package | High | F-07, F-24 | Not reproducible: the same CLI version produces different output over time, fails offline, and the integrity of the result is unknown. | Bundle the catalog in the package, pin by version, and record content hashes in the install manifest ([05 §11](05-architecture-specification.md#11-safe-installer); ADR-007). |
| TD-03 | Hooks read `$TOOL_INPUT` (undocumented) instead of stdin JSON; the secret scan never blocks; `Stop` used for session-end work | High | F-20 | "Security scan" and "quality hooks" give false assurance. Session hooks run after every turn. | Hooks become adapter-generated enforcement points that read stdin JSON and use documented blocking semantics, with tests ([05 §10](05-architecture-specification.md#10-native-adapters)). |
| TD-04 | `-f/--framework` and `--db` flags ignored; tier not written | High | F-04, F-05, F-06 | Documented CLI contract broken; generated projects do not match user choices. | Typed option model with validation, plus golden-file tests per option combination ([09 §3](09-testing-and-benchmark-strategy.md#3-toolkit-test-strategy)). Recommended V1.x patch. |
| TD-05 | No tests and no CI | High | F-14 | No regression protection for any change, including the V2 migration. | Test foundation is a V2.0 deliverable ([08](08-implementation-roadmap.md), [09](09-testing-and-benchmark-strategy.md)). |
| TD-06 | No existing-project setup; manual copy overwrites silently (`cp -r`, `degit --force`) | High | F-10 | Users with existing `.claude/` or `AGENTS.md` lose customizations. | Setup workflow with detection, diff, backup and rollback (ADR-007). |
| TD-07 | About 125 KB of always-loaded instructions regardless of project type | Medium | F-18 | Context and cost overhead on every session; irrelevant rules (for example the React Native rule in a backend project) compete for attention. Token cost not measured yet. | Context Engine with load tiers and path-scoped rules ([05 §8](05-architecture-specification.md#8-context-engine)); measured in V2.2 ([09](09-testing-and-benchmark-strategy.md)). |
| TD-08 | Project-specific rule `react-native.md` in the generic pack | Medium | F-18 | Wrong guidance (brand colours, `pages/delivery/`) applied to unrelated projects. | Remove from the default catalog; keep it only as an example of a project-local rule ([07](07-migration-strategy.md)). |
| TD-09 | Four agents without frontmatter; display names with spaces | Medium | F-15 | Resolver agents are unreachable; names are not stable identifiers. | Canonical IDs plus schema validation in CI ([05 §6](05-architecture-specification.md#6-capability-registry-and-catalog-contracts)). |
| TD-10 | Two skill trees with divergent conventions and duplicated topics | Medium | F-17 | Divergent content for the same skill (`code-review`, `tdd`); unclear source of truth. | One canonical skill source; adapters emit host layouts ([06](06-repository-structure.md)). |
| TD-11 | Manually synchronized duplicates (`.claude` ↔ `templates/.claude`, `.agents` ↔ `templates/.agents`) | Medium | F-24 | Drift already present. | Single `catalog/` source; generated outputs are never committed twice. |
| TD-12 | Three divergent initializers (`bin/cli.js`, `scripts/create-project.js`, `scripts/init.sh`) | Medium | F-13 | Conflicting behaviour and maintenance load. | One CLI entry point; the scripts are deprecated ([07 §5](07-migration-strategy.md#5-deprecations)). |
| TD-13 | `AGENTS.md` (35,465 B) exceeds Codex default `project_doc_max_bytes` (32 KiB) | Medium | F-23 | Codex users get truncated instructions. | Codex adapter enforces a byte budget and uses skills for depth ([05 §10.4](05-architecture-specification.md#104-codex-adapter)). |
| TD-14 | MCP configs in a location no host reads | Medium | F-22 | The integration feature is not functional. | Integration capability generates `.mcp.json` (Claude Code) or `[mcp_servers]` (Codex) with opt-in per server. |
| TD-15 | Non-standard `settings.json` keys and a hard-coded model | Low | F-21 | Dead configuration; implies the keys have an effect. | Adapter emits only documented keys; validated by a schema snapshot. |
| TD-16 | `VERSION` constant and CLI name drift | Low | F-02, F-03 | Wrong `--version` output; confusing help. | Version read from `package.json`; one command name. |
| TD-17 | README counts and unmeasured performance claims | Low | F-27, F-28 | Credibility. | Claims are generated from the catalog; performance claims require benchmark evidence ([09](09-testing-and-benchmark-strategy.md)). |
| TD-18 | Dead code (`createVanillaProject`) and fallback generators that duplicate templates | Low | F-12 | Maintenance load. | Removed during the V2.0 CLI rewrite. |
| TD-19 | Opinionated global tech stack (`tech-stack.md`) presented as mandatory | Medium | F-18 | Conflicts with the universal audience ([10 CF-03](10-architecture-decisions.md#3-conflicts-between-the-specification-and-the-repository)). | Becomes an optional "stack profile" rule set selected by project detection. |
| TD-20 | Code is CommonJS JavaScript, while the shipped rules mandate TypeScript | Low | F-01 | Inconsistency; no types for a growing core. | Proposed ADR-011 ([10](10-architecture-decisions.md)); not approved. |
| TD-21 | `engines.node >=18`, although Node 18 is past upstream end of life | Low | F-01 | Supporting an unmaintained runtime. Node release dates should be re-checked at implementation time. | **Resolved 2026-11-25:** `engines.node >=20`, the lowest version CI tests (OQ-07, [10](10-architecture-decisions.md#5-open-questions)). |

## 3. Migration risks

| ID | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| MR-01 | V1-generated projects carry user edits in `.claude/`; a V2 setup could overwrite them | High | Critical | V1 fingerprinting, adoption mode with no writes by default, hash-based ownership, mandatory backup ([07 §4](07-migration-strategy.md#4-migration-paths)) |
| MR-02 | Fixing F-04, F-05 and F-06 changes output for users who relied on the broken behaviour | Medium | Medium | Behaviour changes listed in release notes; `--yes` defaults unchanged |
| MR-03 | Host conventions change (both hosts released breaking config changes recently: Codex moved profiles out of `config.toml` in 0.134.0, and Claude Code merged commands into skills) | High | High | Adapter versioning plus a host compatibility matrix with re-verification each release ([05 §10.5](05-architecture-specification.md#105-compatibility-detection-and-adapter-versioning)) |
| MR-04 | Scope: 12 domains at once dilutes quality | High | High | V2.0 commits to L0 for all domains and depth only where V1 assets exist; depth grows by phase ([08 §6](08-implementation-roadmap.md#6-domain-depth-by-phase)) |
| MR-05 | Router quality cannot be judged without evaluation data | High | Medium | Routing evaluation set in V2.1; benchmarks in V2.2 ([09](09-testing-and-benchmark-strategy.md)) |
| MR-06 | Removing always-loaded rules reduces model compliance in cases that relied on them | Medium | Medium | A/B comparison of V1 and V2 in the benchmark; keep a "full context" compatibility profile |
| MR-07 | Codex project config loads only for trusted projects | Certain | Medium | Setup reports trust status and instructions; it never assumes the config is active |
| MR-08 | No tests exist to detect migration regressions | Certain | High | Golden-file snapshot of V1 output is captured **before** any refactor ([09 §3.2](09-testing-and-benchmark-strategy.md#32-v1-characterization-tests)) |

## 4. Acceptance criteria

- [x] Every debt item references at least one verified finding.
- [x] Every Critical or High item has a V2 resolution in a named document.
- [x] Migration risks have mitigations owned by a roadmap phase.
- [ ] Severity ranking reviewed by the maintainer. **Pending.**
