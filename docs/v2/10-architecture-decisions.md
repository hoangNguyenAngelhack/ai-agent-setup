# 10 — Architecture Decisions

| Field | Value |
|---|---|
| Status | ADR-001–008 **Accepted** (approved in [EXECUTION-SPECIFICATION §3, §13](EXECUTION-SPECIFICATION.md)). ADR-009, ADR-014, ADR-015 and ADR-016 **Accepted** by the Product Owner on 2026-11-24. ADR-010–013 and ADR-017 **Proposed, not approved** (ADR-017 is implemented for review on a branch). |
| Date | 2026-11-23 |
| Related | [04 Product](04-product-specification.md) · [05 Architecture](05-architecture-specification.md) · [08 Roadmap](08-implementation-roadmap.md) |

## 1. Purpose and scope

This document records the approved architecture decisions, the conflicts found between the approved
direction and the current repository, the proposed (unapproved) decisions, and the open questions.

No approval is implied for anything outside ADR-001–009 and ADR-014–016; ADR-017 waits for the Product Owner.

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
  needs a mechanism (ADR-009, accepted 2026-11-24).
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

### ADR-009: Canonical execution plan artifact and native host adapter protocol

- **Context:** the router produces plans (W2.1-05/07), but hosts need a way to receive one and the
  orchestrator needs a reliable execution state (W2.1-09/10). Claude Code and Codex expose different
  native mechanisms (structured CLI output and event streams); their permission, streaming and
  approval semantics are not identical. OQ-01 asked how hosts should receive plans.
- **Decision:**
  - The Universal Core owns a versioned **ExecutionPlan** contract and its run artifacts, which are
    local and git-ignored:
    `.ai-agent-setup/runs/<run-id>/{execution-plan.json, execution-plan.md, execution-state.json, events.jsonl, result.json, evidence/}`.
  - An approved plan is immutable; a change of scope produces a new plan revision. Every step has a
    stable id, dependencies, inputs, expected outputs, verification criteria, permissions, risk and
    approval requirements.
  - Each adapter delivers the approved plan revision through its host's native, documented
    interface and normalises the host's events into a provider-independent **ExecutionEvent**
    contract: RUN_STARTED, STEP_STARTED, STEP_PROGRESS, APPROVAL_REQUIRED, APPROVAL_RESOLVED,
    STEP_COMPLETED, STEP_FAILED, STEP_BLOCKED, RUN_COMPLETED, RUN_FAILED, RUN_CANCELLED.
  - The orchestrator, not model text, owns step state. A step succeeds only with its structured
    result and verification criteria satisfied, never from a sentence such as "Done" or an exit
    code alone. If progress cannot be established reliably, the state is NOT_VERIFIED.
  - Private conversation transcripts are never transferred between providers; no separate agent
    runtime is introduced (ADR-006).
- **Alternatives considered:** a planner skill that shells out to the CLI (the earlier proposal);
  generated static instructions only; a proprietary runtime that makes both hosts look identical.
- **Consequences:**
  - (+) One audit trail per run, idempotent state, and host differences stay inside adapters.
  - (−) Each adapter needs real-host verification (W2.0-15). Unsupported host capabilities must be
    reported explicitly.
- **Status:** Accepted (Product Owner). **Date:** 2026-11-24. Resolves OQ-01; supersedes the earlier
  ADR-009 proposal.

### ADR-014: Impact-based review for payment, credential and personal-data work

- **Context:** the V2.1 router added a mandatory review whenever the task text mentioned words such
  as payment, token or personal data. On the development set this kept routing minimality at 0.903,
  and it produces false positives for design tokens, token counting, synthetic fixtures, UI copy and
  documentation (OQ-11).
- **Decision:**
  - A mandatory specialist review is added when the **actual planned work or changed files**
    affect:
    - payments: processing, billing, refunds, settlement, payment credentials, financial
      transactions;
    - tokens and credentials: auth tokens, signing keys, token custody, wallets and transfers,
      secret storage;
    - personal data: collection, storage, access, modification, deletion, transmission, logging,
      retention, anonymisation.
  - Keywords alone do not trigger it in documentation, unrelated examples, synthetic fixtures,
    UI copy, token counting or design tokens.
  - When impact is plausible but uncertain, the risk is flagged as requiring assessment; the safer
    review path is preferred when actual impact is plausible.
  - Every mandatory review records its reason, and ordinary user overrides cannot remove it.
  - Positive and negative evaluation cases guard against both misses and excessive reviews.
- **Alternatives considered:** keep keyword-triggered review (status quo); review only from changed
  files.
- **Consequences:**
  - (+) Fewer unnecessary reviews, and the reasons can be audited.
  - (−) Depends on capability and impact signals; ambiguous text-only cases need a person to assess
    them.
- **Status:** Accepted (Product Owner). **Date:** 2026-11-24. Resolves OQ-11.

### ADR-015: Handling step events that arrive before their step is ready

**Status:** Accepted (Product Owner), 2026-11-24: option C + B, with the three decisions below. Implemented in `src/core/execution/state.ts` (rules version 2).

**Context.** The orchestrator enforces dependencies on *verified* state: a step becomes READY only
when every dependency is SUCCEEDED, and that needs the orchestrator's gates (`run verify`). A host
working headless does the steps in order without waiting for verification. Typical timeline for
plan `A → B`:

| # | Event (source) | Today |
|---|---|---|
| 1 | `STEP_STARTED A` (host) | A RUNNING |
| 2 | `STEP_COMPLETED A` (host) | A NOT_VERIFIED, awaiting verification; B stays PENDING |
| 3 | `STEP_STARTED B` (host) | **rejected**: "dependencies are not satisfied" (anomaly) |
| 4 | `APPROVAL_REQUIRED B` (host) | **rejected**: the approval request is only visible as an anomaly |
| 5 | `STEP_COMPLETED B` (host) | **rejected** |
| 6 | `run verify A` (orchestrator) | A SUCCEEDED, B READY, but B has no execution evidence and its approval request is gone |

The host respected the dependency order (it finished A before starting B); only verification
lags. Steps 3–5 are lost, so the run ends at best as OUTCOME_VERIFIED and an approval the agent asked
for never reaches the user as a pending approval. Events are never silently dropped (they are
anomalies), but they no longer influence the state.

**Decision drivers.**

1. An approval request must never be lost or bypassed.
2. Dependencies stay enforced: a step is never verified, and never counts as succeeded, before its
   dependencies succeeded.
3. No success inflation: early reports are execution evidence, not verification.
4. Determinism: the state is still a pure function of the event log (replay after restart gives the
   same result); idempotent by event id; tolerant of duplicates and reordering.
5. A real ordering violation (the host starts B before it reported A finished) stays visible.

**Options.**

| Option | Description | Assessment |
|---|---|---|
| A. Keep rejecting (today) | Early events become anomalies | Violates drivers 1 and 3 (evidence lost); simplest |
| B. Deferred queue | An event rejected only because the step is not ready yet is parked; after every state change, parked events are retried in log order; leftovers are reported at reconciliation | Keeps every event; the step state still follows verification. Approval requests wait in the queue, so they are pending but not visible as WAITING_FOR_APPROVAL until the step is ready |
| C. Two readiness levels | Distinguish *host-ready* (every dependency SUCCEEDED or reported completed by the host) from *verified-ready* (every dependency SUCCEEDED). Host events are accepted on host-ready steps; verification needs verified-ready | Models the real situation; needs one more concept in the state machine |

**Recommendation: C, with B as the fallback for events that are early even at host level.**

- *Host-ready.* A PENDING step whose dependencies are all SUCCEEDED or host-completed
  (NOT_VERIFIED after a host `STEP_COMPLETED`) accepts host events. They are recorded as execution
  evidence (`reports`), and the step moves to RUNNING or WAITING_FOR_APPROVAL as today.
- *Verification order.* An orchestrator `STEP_COMPLETED` (gate results) for a step is applied only
  when every dependency is SUCCEEDED; otherwise it waits in the queue (driver 2).
- *Approvals first.* `APPROVAL_REQUIRED` is accepted in any open state, including PENDING. It
  records a pending approval that `run status` shows and that `run approve-step` can resolve. A step
  with an unresolved request cannot complete (driver 1).
- *Deferred queue (B).* Events for a step that is not even host-ready (the host started B before
  reporting A finished) are parked, retried after each state change in log order, and recorded as
  ordering anomalies. Events still parked at reconciliation are listed in the result as
  `deferred` (not applied) with the reason.
- *Failure propagation.* If a dependency is later verified FAILED, its host-ready dependants become
  BLOCKED. Their reports stay as evidence, and the reason names the failed dependency.
- *Unchanged.* The event log format, the ten step states, run statuses (including OUTCOME_VERIFIED)
  and exit codes.

**Consequences.**

- (+) No approval request or execution report is lost. Headless runs can reach SUCCEEDED after
  verification without the host replaying events.
- (+) Real ordering violations stay visible as anomalies.
- (−) One more concept (host-ready) and a queue in the reducer. Replay cost grows with the number of
  parked events, bounded by the log size.
- (−) Replaying an existing log under the new rules can change a stored result (for example
  OUTCOME_VERIFIED → SUCCEEDED). `result.json` is regenerated by `run status`, so this is visible.

**Test plan (before merging an implementation).** One test per row of the timeline above. Plus:
- duplicate and reordered events (including the orchestrator verifying B before A);
- an approval requested on a PENDING step, then approved and then declined;
- a dependency verified FAILED after its dependant was host-completed;
- a host start of B before A was reported finished (ordering anomaly, parked, applied later);
- restart replay equality;
- `run-result` contract validation for every scenario.

**Decisions (Product Owner, 2026-11-24).**

1. **C + B.** Two readiness levels, `host-ready` and `verified-ready`, plus a deferred queue that
   keeps and replays early events. No event is dropped only because the previous step's gates have
   not run yet.
2. **Host starts B before A finished.** B's events and evidence are kept and applied once B becomes
   host-ready; the anomaly `DEPENDENCY_ORDER_VIOLATION` is recorded. This alone does not make the run
   NOT_VERIFIED. B is never gated or completed before A is verified SUCCEEDED; if A fails, B becomes
   BLOCKED with its evidence kept.
3. **Pending approval.** It blocks completion of its step and blocks run SUCCEEDED, but not
   independent steps. Only the user resolves an approval.

**As implemented.**

- `run verify` refuses to run gates for a step whose dependencies are not SUCCEEDED or whose
  approval is pending; an orchestrator result that arrives early anyway waits in the queue.
- `run-result` gains `rulesVersion` (2), `deferred` (events never applied, with why), and
  `approval.pending` per step; anomalies can carry `code`. `run status` prints what changed since the
  previous `result.json`, so a log replayed under the new rules shows its new outcome (for example
  `rules 1 → 2`, `status OUTCOME_VERIFIED → SUCCEEDED`).
- Unchanged: event log format, the ten step states, run statuses and exit codes.

### ADR-016: Local integrity of run artifacts

- **Status:** Accepted by the Product Owner, 2026-11-24. Threat model: [11](11-runtime-threat-model.md).
- **Scope of protection (as accepted):** **ADR-016 does not create a security boundary against an
  agent or attacker that can run arbitrary code under the same operating-system account.** Such code
  can read the key and sign anything. Neither the HMAC nor the hook is claimed to stop it. The
  boundary for that case is Runtime Isolation (W2.2-09, planned).
- **Context:** Run artifacts live in the project. An agent with write access could forge orchestrator
  events, widen an approved plan and recompute its unkeyed digest, or replace evidence. A checksum
  stored next to the data does not help when both can be rewritten.
- **Decision:**
  - A per-project HMAC-SHA256 key is created by the toolkit in the user's configuration directory
    (`ai-agent-setup/keys`, mode 0600, never in the project or the repository).
  - The toolkit signs the plan approval (run, revision, digest, approver, time), every event it
    appends (position + exact line, in `integrity.jsonl` next to an unchanged `events.jsonl`) and
    the checksums of the evidence it records with an event (gate records, gate logs, host transcript).
    The log head (count, last signature) is kept with the key.
  - On load, only signed events are applied; unsigned, changed, removed or truncated entries and
    changed evidence become `INTEGRITY_VIOLATION` anomalies and rule out SUCCEEDED; a plan or approval
    changed outside the toolkit, or a signed run without its key, is refused.
  - Signed events must appear in the order they were written.
  - Runs approved before the key existed stay readable as UNSIGNED (backward compatibility); their
    list is recorded with the key when it is created, so nothing in the project can make a later run
    count as unsigned.
  - Mandatory policy and a built-in path check in the hook deny agents the key directory (shell,
    writes, Claude Code read tools; resolved paths, case-insensitive where the OS is). A key
    directory inside the project is refused.
  - `run approve` and `run approve-step` need an interactive terminal and the id typed back.
  - An independent security review on 2026-11-24 found two HIGH issues (a signed run could pass as
    unsigned; signed events could be reordered) and two MEDIUM ones (key-path bypasses, approval via
    an obfuscated command); all four are fixed with regression tests.
- **Unchanged:** event log format, step states, run statuses, exit codes. `run-result` rules version 3
  adds `integrity`.
- **Alternatives considered:** checksums only (rejected: rewritable with the data); a remote or cloud
  witness (rejected: local-first); an OS keychain (deferred: platform-specific and prompts the user);
  a separate OS user or sandbox for the agent (the only real boundary; left to the user, see the
  threat model §6).
- **Consequences:** (+) tampering through host tools and ordinary scripts that do not read the key is
  detected and cannot produce SUCCEEDED. (−) Not a boundary against code the agent runs under the
  same OS account; the result reports what was verified, not more.

## 3. Conflicts between the specification and the repository

None of these reopens an approved decision. Each one has a proposed resolution.

| ID | Conflict | Proposed resolution |
|---|---|---|
| CF-01 | Hybrid orchestration needs the plan at host run time, but a standalone agent runtime is out of scope (EXECUTION-SPECIFICATION §3) | The router runs as a local library invoked on demand by the host (ADR-009, accepted 2026-11-24). It is not a resident runtime and runs no models. |
| CF-02 | Codex loads project `.codex/` config, agents and hooks **only in trusted projects**, so policy enforcement through project config is not guaranteed | Setup reports the trust status; generated `AGENTS.md` carries the safety summary (T0); `doctor` flags untrusted state. Enforcement in untrusted Codex projects is `NOT_VERIFIED`. |
| CF-03 | The universal audience conflicts with the V1 `tech-stack.md`, which mandates Next.js, Express, Prisma and so on for all projects | Move it to optional stack profiles selected by detection (TD-19) |
| CF-04 | The README claims "Compatible with 30+ AI coding agents", but only two adapters are approved | Remove the claim; state that other hosts may read `.agents/skills` but are unsupported (F-28) |
| CF-05 | The V1 CLAUDE.md "Sensitive Commands Policy" says `rm -rf` must not run automatically, but V1 `settings.json` allows `Bash(rm *)` | V2 mandatory safety policy is authoritative; generated permissions are derived from it (TD-01) |
| CF-06 | "Cost per accepted outcome" must be measured, but there is no telemetry and host usage data availability differs | Measure from local host artifacts (transcripts, hook payloads, Codex `PostModelRequest`); label everything else `estimated` (OQ-03) |
| CF-07 | EXECUTION-SPECIFICATION §12 does not list an application layer or catalog policies and profiles | [06](06-repository-structure.md) adds `src/app/`, `catalog/policies/`, `catalog/profiles/` and `catalog/tools/`. This extends the structure without contradicting it. |

## 4. Proposed decisions (NOT approved)

| ID | Proposal | Rationale | Decide by |
|---|---|---|---|
| ADR-010 | **Catalog format:** YAML entries + JSON Schema 2020-12 + Markdown bodies | Human-editable; standard validation tooling | Start of V2.0 (W2.0-03). **Implemented as a working assumption** on `feature/v2-foundation` (2026-11-24); reversible until merged |
| ADR-011 | **Language:** migrate `src/` to TypeScript compiled to `dist/` | Typed contracts for a growing core; consistent with the rules the product ships | Start of V2.0. **Implemented as a working assumption** on `feature/v2-foundation` (2026-11-24); reversible until merged |
| ADR-012 | **Bundled catalog, no runtime download:** catalog shipped in the npm package; `update` changes the version explicitly | Reproducibility and offline use (TD-02) | Start of V2.0 |
| ADR-013 | **Hooks implemented in Node.js**, not shell | Cross-platform (NFR-02); no GNU-only tools (F-20) | Start of V2.0 |
| ADR-017 | **Runtime Isolation:** provider contract; macOS Seatbelt for `restricted`; `isolated` (separate OS user) refused until set up with permission; host-side event inbox | The first OS-enforced boundary for code the agent runs (W2.2-09); details below | Product Owner review of W2.2-09 |

### ADR-017: Runtime Isolation (W2.2-09)

- **Status:** Proposed and implemented for review on branch `feature/w2.2-09-runtime-isolation`,
  2026-11-24. **Not yet accepted by the Product Owner.** Threat model: [11 §6](11-runtime-threat-model.md#6-runtime-isolation-w22-09-adr-017);
  test report: [12](12-runtime-isolation-security-report.md); usage: [guide](../guides/runtime-isolation.md).
- **Context:** ADR-016 detects tampering but is not a boundary against code the agent runs under the
  user's OS account: such code can read the integrity key and sign anything. W2.2-09 needs a boundary
  the OS enforces, without installing software, creating OS users or changing system permissions
  (each needs the user's separate permission), and without Docker as a default dependency.
- **Four boundaries, kept apart:**

  | Boundary | What it guarantees | Where |
  |---|---|---|
  | Integrity (ADR-016) | Changes to run artifacts made without the key are detected | HMAC key outside the project |
  | Runtime isolation (this ADR) | The agent's processes cannot reach what the OS sandbox closes | Kernel sandbox around the host process |
  | Host trust boundary | Approvals, verdicts and signatures come only from the toolkit process outside the sandbox | Orchestrator + event inbox |
  | OS trust boundary | Processes of different OS users cannot read each other's files | Separate OS user (profile `isolated`, not available) |

- **Options evaluated:**

  | Option | Boundary | Why chosen or not |
  |---|---|---|
  | Hooks / policy / prompt rules in the host | None (same process, same user) | Rejected as a boundary; kept as a guard against mistakes |
  | Host's own sandbox (Claude Code sandbox, Codex `workspace-write`) | Host-defined | Not controllable or verifiable by the toolkit; real CLIs not installed here (NOT_VERIFIED) |
  | Separate OS user | Real (OS identity) | The only option that meets AC1; needs an administrator to create the user and set permissions. Not done without the user's permission: profile `isolated` refuses with that reason |
  | Container or VM | Real (namespaces / hypervisor) | Needs a runtime; Docker must not be a default dependency or installed by the toolkit |
  | OS sandbox around the host process: macOS Seatbelt (`/usr/bin/sandbox-exec`, built in) | Real (kernel), same OS user | **Chosen for `restricted` on macOS**: no installation, no admin rights, enforced on every child |
  | Linux bubblewrap / Landlock; Windows AppContainer / restricted token + Job Object | Real (kernel) | Right designs for those platforms; not implemented: they cannot be verified on this machine, so they refuse |

- **Decision:**
  1. A provider-independent contract in `src/core/isolation` (profile, network policy, capabilities
     per control, policy, prepared launch) and providers in `src/isolation`. `none` keeps today's
     behaviour and claims nothing; `restricted` and `isolated` start only when every required control
     is `SUPPORTED`; otherwise nothing starts (fail closed). A profile is never upgraded, downgraded or
     replaced.
  2. `restricted` on macOS: a Seatbelt profile generated per launch. Reads closed under the home and
     temporary directories except the workspace, the toolkit and runtime, the host executable and the
     host's own state; writes only to the workspace (not `.ai-agent-setup/`), a per-launch scratch
     directory and the host state; no execution from the home, temporary or scratch areas; the key
     directory, the toolkit's configuration directory and credential locations (`.ssh`, `.aws`,
     `.azure`, `.kube`, `.docker`, `.gnupg`, `.netrc`, `.git-credentials`, `.npmrc`, `.config/gcloud`,
     `.config/gh`, `Library/Keychains`) closed for read, write and execution; signals and process
     information only within the sandbox; no Apple Events, LaunchServices (`open`) or clipboard;
     network deny-all on request. A live probe proves a deny rule is enforced before `restricted` is
     reported as supported.
  3. The environment is an allowlist (`PATH`, `HOME`, `USER`, `LOGNAME`, `SHELL`, `LANG`, `TERM`, `TZ`,
     `COLORTERM`, `NO_COLOR`, `LC_*`, `ANTHROPIC_*`, `CLAUDE_*`, `OPENAI_*`, `CODEX_*`, plus names the
     user passes with `--pass-env`); the key directory variable and other tokens are dropped.
  4. Approval boundary: inside the sandbox `run event` cannot read the key, so it queues the request in
     a per-launch inbox. The orchestrator (outside) accepts only step reports (`STEP_STARTED`,
     `STEP_PROGRESS`, `APPROVAL_REQUIRED`, `STEP_COMPLETED`, `STEP_FAILED`, `STEP_BLOCKED`) for this
     run, copies known fields, forces `source: host`, drops gate results, and signs them; approvals and
     run verdicts requested by the agent are refused and listed in the delivery outcome. Approvals stay
     with `run approve-step` in the user's terminal (ADR-016).
  5. Process tree: the orchestrator tracks every descendant from outside (parent links with start
     times, plus a random per-launch mark in the environment) and, on normal end, timeout, cancellation
     or Ctrl-C, freezes them all and kills them.
  6. Evidence: an isolation report (requested and applied profile, provider, platform, network,
     enforced and not enforced controls, environment variable names) is signed with `RUN_STARTED`.
  7. `isolated` (separate OS user) is designed but not implemented; every platform reports it
     UNSUPPORTED with the reason. Linux and Windows report `restricted` UNSUPPORTED.
- **Unchanged:** ADR-015 and ADR-016 semantics, event format, step states, run statuses, exit codes;
  `run deliver` without `--isolation` behaves as before.
- **Assumptions:** the macOS kernel enforces Seatbelt profiles as tested on macOS 26.2 (25C56); Apple
  documents `sandbox-exec` as **deprecated** (still functional), so the live probe runs before every
  launch and a future macOS that drops it makes `restricted` UNSUPPORTED, never silent; launchd
  refuses job submission from a sandboxed caller (tested); the user does not run the toolkit itself
  inside the agent's sandbox.
- **What remains unprotected:**
  - Identity: the sandboxed agent runs as the user's OS account (AC1 not met).
  - Readable outside the confined roots: system locations (`/etc`, `/usr`, `/Library`,
    `/Applications`, `/Users/Shared`, other volumes) except the protected list.
  - The workspace itself: the agent can change source files and run what it writes there (inside the
    same sandbox).
  - Network: allow-all by default (real hosts need their API); deny-all blocks all IP traffic, so a
    real host cannot reach its model API with it; a domain allowlist is UNSUPPORTED (Seatbelt filters
    addresses, not names). Local IPC to system services not listed above stays allowed.
  - Keychain items reachable through the security daemon without a prompt: NOT_VERIFIED.
  - A process that double-forks faster than the 100 ms scan and clears its environment can outlive
    the run (test 12, adversarial: FAIL). It stays inside the sandbox (verified: it cannot read the key).
  - A kernel or Seatbelt bug.
  - Real Claude Code and Codex under the sandbox: NOT_VERIFIED (not installed). Codex's own sandbox
    uses `sandbox-exec`, which cannot be nested (tested: `sandbox_apply: Operation not permitted`), so
    Codex sandboxed commands may fail inside `restricted`.
- **Consequences:** (+) on macOS, code the agent runs can no longer read the key, credentials, other
  projects or the toolkit's runtime state, cannot forge approvals or verdicts, and cannot leave
  processes behind in the tested cases; each claim has a kernel-level test. (−) Not an OS identity
  boundary; macOS only; more host paths may need `--pass-env`/allow lists for real hosts; a
  deprecated system tool.

## 5. Open questions

| ID | Question | Impact | Owner |
|---|---|---|---|
| OQ-01 | ~~How do hosts receive and follow a plan?~~ **Resolved 2026-11-24 by ADR-009 (accepted).** | — | Product Owner |
| OQ-02 | Keep the package name `create-ai-agent-setup` and the manifest directory `.ai-agent-setup/`, or rename to reflect the "OS" positioning? A rename affects npm discoverability and V1 users. | CLI and migration | Maintainer |
| OQ-03 | Which actual token and cost data does each host expose locally (Claude Code transcripts or status data; Codex `PostModelRequest` hook payload)? Needs verification before W2.2-04. **Answered for Claude Code 2026-11-25** (installed CLI 2.1.332, `-p --output-format stream-json`): `assistant` lines carry `message.usage` and `message.model`, repeated unchanged on every line of a message id, but with the output count from the start of the message; the `result` message carries the session totals: `usage` (main loop), `modelUsage` (every model call, per model) and `total_cost_usd`. Totals are read from `modelUsage`. **Codex not verified:** installed, not signed in. | Cost KPIs | Implementer |
| OQ-04 | Is the 9-agent canonical set ([05 §6.6](05-architecture-specification.md#66-canonical-agent-set-proposed)) right, for example whether to split `implementer` by platform? | Routing, migration aliases | Maintainer + review |
| OQ-05 | Who authors new content for D02, D06, D07, D11 and D12 to reach L2, and what review standard applies? | Depth targets ([08 §6](08-implementation-roadmap.md#6-domain-depth-by-phase)) | Maintainer |
| OQ-06 | Should V2 also be distributed as a Claude Code or Codex plugin (host packaging, not a marketplace)? Is this in or out of scope for V2? | Distribution | Maintainer |
| OQ-07 | ~~Minimum Node.js version (V1 says ≥ 18, which is past upstream end of life; check current LTS dates at implementation)~~ **Resolved 2026-11-25 by the maintainer: Node ≥ 20**, the lowest version CI tests; `engines.node` is `>=20.0.0` and `release:check` keeps the two equal. | CI matrix, users | Maintainer |
| OQ-08 | Support window for 1.x after V2.0 GA, and whether the V1.x patch track ([08 §2](08-implementation-roadmap.md#2-v1x-maintenance-track-proposed)) is approved | Users on 1.x | Maintainer |
| OQ-09 | Organization policy file location and format (path flag, environment variable, or managed host settings) | Enterprise | Maintainer |
| OQ-11 | ~~Should sensitive keywords always add a review step?~~ **Resolved 2026-11-24 by ADR-014 (accepted): no, review follows actual impact.** | — | Product Owner |
| OQ-10 | Should the default profile for Codex set `sandbox_mode = "workspace-write"` with `approval_policy = "on-request"`? | Security defaults | Security review |

## 6. Acceptance criteria

- [x] ADR-001–008 each include context, decision, alternatives, consequences, status and date.
- [x] No decision beyond ADR-001–008 is marked approved.
- [x] Conflicts with the repository are documented with proposed resolutions.
- [x] Open questions have an owner and an impact.
