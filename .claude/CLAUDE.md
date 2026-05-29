# Claude AI Agent Configuration

**Maintainer:** Hoang Nguyen (hoang.nguyen@angelhack.com)  
**Tier:** Standard

> See [TIERS.md](rules/TIERS.md) for tier options: Starter | Standard | Strict

## Overview

This project uses Claude AI as an intelligent development agent with structured workflows, specialized sub-agents, and mandatory coding standards.

---

## Development Workflow

Follow this workflow for all feature development:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   /spec  →  /plan  →  /build  →  /test  →  /review  →  Ship│
│                                                             │
│   Define    Plan     Build     Verify    Review     Deploy  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

| Phase | Command | Purpose |
|-------|---------|---------|
| **Define** | `/spec` | Create PRD with objectives, scope, boundaries |
| **Plan** | `/plan` | Decompose into vertical slices with acceptance criteria |
| **Build** | `/build` | Implement incrementally using TDD (RED-GREEN-REFACTOR) |
| **Verify** | `/test` | Write and verify tests; use Prove-It for bug fixes |
| **Review** | `/review` | Five-axis code review before merge |
| **Ship** | `/deploy` | Build, test, deploy with staged rollout |

### Supporting Commands

| Command | Purpose |
|---------|---------|
| `/debug` | Systematic error diagnosis and root cause analysis |
| `/simplify` | Reduce complexity without changing behavior |
| `/fix-issue` | Analyze and fix reported issues |

---

## Core Principles

### Code Quality
- **Test-Driven Development** — Write failing tests first, then implement
- **Incremental Implementation** — Small vertical slices, always buildable
- **Five-Axis Review** — Correctness, Readability, Architecture, Security, Performance

### Philosophy
- Progress over perfection
- Fix root causes, not symptoms
- The simplest thing that could work
- Tests are proof, not afterthought

---

## Mandatory Rules

All rules in `.claude/rules/` are **mandatory** and must be followed:

### Code Quality
| Rule | Description |
|------|-------------|
| `clean-code.md` | Variables, functions, SOLID, async/await |
| `code-style.md` | Formatting, naming conventions |
| `error-handling.md` | AppError class, global handler patterns |

### Architecture & Design
| Rule | Description |
|------|-------------|
| `tech-stack.md` | Approved technologies (Next.js, React Native, PG, Redis, Prisma) |
| `system-design.md` | CAP theorem, caching, scaling, queues |
| `project-structure.md` | Layered architecture, folder organization |
| `api-conventions.md` | REST standards, response envelopes |

### Data & Naming
| Rule | Description |
|------|-------------|
| `naming-conventions.md` | Cache keys, DB, queues, env vars |
| `database.md` | Prisma patterns, transactions, N+1 prevention |

### Operations
| Rule | Description |
|------|-------------|
| `security.md` | **CRITICAL** — Never violate security rules |
| `monitoring.md` | Prometheus, Grafana, logging, alerting |
| `testing.md` | Coverage thresholds, test patterns |
| `git-workflow.md` | Branching strategy, conventional commits |

---

## Available Agents

Invoke the right agent for each task type:

### Development Agents
| Agent | When to Invoke |
|-------|---------------|
| 🖥️ **Frontend Developer** | Components, pages, routing, state, UI performance |
| 📱 **Mobile Developer** | React Native, Expo, navigation, native modules |
| 🔧 **Backend Developer** | APIs, services, DB queries, background jobs |
| 🏗️ **Systems Architect** | Architecture decisions, ADRs, system design |

### Quality Agents
| Agent | When to Invoke |
|-------|---------------|
| 👀 **Code Reviewer** | Five-axis PR review, code quality assessment |
| 🧪 **Test Engineer** | Test strategy, TDD, coverage, bug reproduction |
| 🔒 **Security Auditor** | Vulnerability assessment, threat modeling |
| ✅ **QA Engineer** | Test plans, E2E tests, bug reports |

### Product Agents
| Agent | When to Invoke |
|-------|---------------|
| 📋 **Project Manager** | User stories, sprint planning, status reports |
| 🎨 **UI/UX Designer** | Design system, wireframes, accessibility |
| ✍️ **Copywriter/SEO** | Page copy, meta tags, SEO optimization |

---

## Available Skills

### Agent Skills (`.agents/skills/`)

Open standard skills compatible with 30+ AI agents:

| Skill | Description | Impact Levels |
|-------|-------------|---------------|
| `nodejs-backend` | Express, Prisma, Redis, BullMQ | CRITICAL/HIGH/MEDIUM |
| `nestjs-backend` | NestJS, TypeORM, Guards, DI | CRITICAL/HIGH/MEDIUM |
| `react-frontend` | Next.js/Vite, TailwindCSS, Zustand | CRITICAL/HIGH/MEDIUM |
| `react-native-mobile` | Expo/RN CLI, NativeWind | CRITICAL/HIGH/MEDIUM |
| `code-review` | Five-axis review framework | CRITICAL/MAJOR/MINOR |
| `tdd` | RED-GREEN-REFACTOR workflow | CRITICAL/HIGH/MEDIUM |

**Compile all skills:** `node scripts/compile-skills.js` → generates `AGENTS.md`

### Claude Skills (`.claude/skills/`)

Specialized skills for complex operations:

| Skill | Description |
|-------|-------------|
| `incremental-implementation` | Vertical slice development |
| `deploy` | Full deployment pipeline |
| `security-review` | Security audit checklist |

---

## Reference Checklists

Quick references in `.claude/references/`:

| Reference | Use For |
|-----------|---------|
| `security-checklist.md` | Pre-deploy security verification |
| `testing-patterns.md` | Test structure and anti-patterns |
| `performance-checklist.md` | Core Web Vitals, optimization |
| `accessibility-checklist.md` | WCAG 2.1 AA compliance |
| `mobile-performance-checklist.md` | React Native performance, 60 FPS |
| `mobile-release-checklist.md` | App Store / Play Store submission |
| `external-skills.md` | Third-party AI skills (GSAP, etc.) |

---

## Recommended Tools

### CodeGraph (Optional)

[CodeGraph](https://github.com/colbymchenry/codegraph) builds a semantic knowledge graph of codebases, enabling faster and cheaper code exploration.

**Benefits:**
| Metric | Improvement |
|--------|-------------|
| Tokens processed | **57% fewer** |
| Cost | **35% cheaper** |
| Response time | **46% faster** |
| Tool calls | **71% fewer** |

**Setup:**
```bash
npx @colbymchenry/codegraph init -i
```

**MCP Tools provided:**
| Tool | Purpose |
|------|---------|
| `codegraph_search` | Symbol lookup |
| `codegraph_context` | Multi-symbol context in one call |
| `codegraph_trace` | Call path tracing with bodies |
| `codegraph_callers` | Find all callers of a symbol |
| `codegraph_callees` | Find all callees of a symbol |
| `codegraph_impact` | Change impact analysis |
| `codegraph_explore` | Grouped source for related symbols |

**When to use:**
- Large codebases (>10k LOC)
- Architecture exploration ("How does X reach Y?")
- Impact analysis before refactoring
- Understanding call flows

---

## Sensitive Commands Policy

**CRITICAL:** The following commands must NOT be executed automatically. Instead:
1. Log the command that would run
2. Suggest a safer alternative (if available)
3. Continue workflow — DO NOT block, DO NOT wait for confirmation

| Command | Risk Level | Safe Alternative |
|---------|------------|------------------|
| `git push --force` | 🔴 HIGH | `git push --force-with-lease` |
| `git reset --hard` | 🔴 HIGH | `git stash` before reset |
| `rm -rf` | 🔴 HIGH | `mv` to `.trash/` folder |
| `DROP TABLE/DATABASE` | 🔴 HIGH | Backup first, confirm DB name |
| `DELETE FROM` (no WHERE) | 🔴 HIGH | Add WHERE clause or LIMIT |
| `TRUNCATE TABLE` | 🟠 MEDIUM | Backup first |
| `git checkout -- .` | 🟠 MEDIUM | `git stash` for recovery |
| `npm/pnpm publish` | 🟠 MEDIUM | Confirm version and registry |
| `docker system prune` | 🟠 MEDIUM | List items before prune |
| Deploy to production | 🟠 MEDIUM | Deploy to staging first |

### Handling Flow

```
┌─────────────────────────────────────────────────────────────┐
│  Detect sensitive command                                   │
│       ↓                                                     │
│  Log: "⚠️ Sensitive: [command] — using safe alternative"   │
│       ↓                                                     │
│  Execute safe alternative (if available)                    │
│       ↓                                                     │
│  Continue workflow — DO NOT BLOCK                           │
└─────────────────────────────────────────────────────────────┘
```

### Examples

```bash
# User requests: "push changes to remote"
# ❌ DON'T: git push --force origin main
# ✅ DO: git push --force-with-lease origin main

# User requests: "clean up old files"
# ❌ DON'T: rm -rf ./tmp/*
# ✅ DO: mkdir -p .trash && mv ./tmp/* .trash/

# User requests: "reset to clean state"
# ❌ DON'T: git reset --hard HEAD
# ✅ DO: git stash -u && git reset --hard HEAD
```

---

## Agent Behavior Guidelines

1. **Follow the workflow** — Use `/spec` → `/plan` → `/build` → `/review`
2. **Apply mandatory rules** — All rules in `.claude/rules/` are non-negotiable
3. **Test first** — Write failing tests before implementing
4. **Incremental changes** — Small commits, always buildable
5. **Explain before acting** — Describe changes before making them
6. **Fix root causes** — Don't patch symptoms
7. **Use the right agent** — Invoke specialized agents for their domains
8. **Handle sensitive commands safely** — Use alternatives, never block workflow
