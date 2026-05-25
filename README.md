# AI Agent Project — Production-Grade Configuration

<div align="center">

  <h3>Production-ready AI Agent configuration for Claude Code</h3>
  <p>Structured workflows, specialized agents, mandatory rules, and best practices</p>

  [![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/create-ai-agent-setup)
  ![Version](https://img.shields.io/badge/version-1.3.3-blue?style=flat-square)
  [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)
  [![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Compatible-green?style=flat-square)](https://agentskills.io)

</div>

---

## Table of Contents

- [Quick Start](#quick-start)
- [Installation Methods](#installation-methods)
- [Integrations](#integrations)
  - [CodeGraph](#codegraph-integration)
  - [Agent Skills](#agent-skills-open-standard)
- [What's Included](#whats-included)
- [Development Workflow](#development-workflow)
- [Tech Stack](#approved-tech-stack)
- [Related Projects](#related-projects)

---

## Quick Start

```bash
# Create a new project (interactive)
npx create-ai-agent-setup my-app

# With specific options
npx create-ai-agent-setup my-api -t backend --db postgresql
npx create-ai-agent-setup my-landing -t frontend -f nextjs
npx create-ai-agent-setup my-mobile -t mobile -f expo

# With all integrations
npx create-ai-agent-setup my-app --codegraph
```

---

## Installation Methods

### Method 1: CLI (Recommended)

```bash
npx create-ai-agent-setup my-app
```

The CLI will guide you through:
1. Project name
2. Project type (backend / frontend / fullstack / mobile)
3. Framework (for frontend: nextjs/vite, for mobile: expo/cli)
4. Rule tier (Starter / Standard / Strict)
5. Database (for backend/fullstack only)
6. Author info
7. CodeGraph setup (optional)

### Method 2: Copy to Existing Project

```bash
# Copy .claude config only
npx degit hoangNguyenAngelhack/ai-agent-setup/.claude .claude

# Copy Agent Skills only
npx degit hoangNguyenAngelhack/ai-agent-setup/.agents .agents
```

### Method 3: Clone Full Repository

```bash
npx degit hoangNguyenAngelhack/ai-agent-setup my-project
cd my-project
./scripts/init.sh
```

### CLI Options

```
Options:
  -t, --type <type>      Project type: backend, frontend, fullstack, mobile
  -f, --framework <fw>   Framework: nextjs, vite, expo, cli
  -T, --tier <tier>      Rule tier: starter, standard, strict
  -d, --db <database>    Database: postgresql, mysql, sqlite, none
  -c, --codegraph        Setup CodeGraph MCP server
  -y, --yes              Skip prompts, use defaults
  -h, --help             Show help
  -v, --version          Show version
```

---

## Integrations

### CodeGraph Integration

[CodeGraph](https://github.com/colbymchenry/codegraph) builds a semantic knowledge graph of your codebase for faster AI code exploration.

#### Benefits

| Metric | Improvement |
|--------|-------------|
| Tokens processed | **57% fewer** |
| Cost | **35% cheaper** |
| Response time | **46% faster** |
| Tool calls | **71% fewer** |

#### Setup

```bash
# During project creation
npx create-ai-agent-setup my-app --codegraph

# Or add to existing project
npx @colbymchenry/codegraph init -i
```

#### Available MCP Tools

| Tool | Purpose |
|------|---------|
| `codegraph_search` | Symbol lookup across codebase |
| `codegraph_context` | Multi-symbol context in one call |
| `codegraph_trace` | Call path tracing with bodies |
| `codegraph_impact` | Change impact analysis |
| `codegraph_callers` | Find all callers of a symbol |
| `codegraph_callees` | Find all callees of a symbol |

#### Supported Agents

Claude Code, Cursor, Codex CLI, opencode, Hermes Agent

---

### Agent Skills (Open Standard)

This project follows the [Agent Skills](https://agentskills.io) open standard, compatible with **30+ AI coding agents**.

#### Available Skills

| Skill | Description | Use When |
|-------|-------------|----------|
| [`nodejs-backend`](.agents/skills/nodejs-backend/SKILL.md) | Express, Prisma, Redis, BullMQ | Building APIs, services, jobs |
| [`react-frontend`](.agents/skills/react-frontend/SKILL.md) | Next.js/Vite, TailwindCSS, Zustand | Creating web UI, pages, forms |
| [`react-native-mobile`](.agents/skills/react-native-mobile/SKILL.md) | Expo/RN CLI, NativeWind | Building iOS/Android apps |
| [`code-review`](.agents/skills/code-review/SKILL.md) | Five-axis review framework | Reviewing PRs, code quality |
| [`tdd`](.agents/skills/tdd/SKILL.md) | RED-GREEN-REFACTOR workflow | Writing tests first |

#### Install Skills

**Option 1: Plugin Marketplace** (Claude Code, VS Code, Cursor)
```bash
/plugin marketplace add hoangNguyenAngelhack/ai-agent-setup
```

**Option 2: Direct Copy**
```bash
npx degit hoangNguyenAngelhack/ai-agent-setup/.agents/skills .agents/skills
```

**Option 3: Include in CLI**
```bash
npx create-ai-agent-setup my-app  # Skills included automatically
```

#### Compatible Agents

| Agent | Install Command |
|-------|-----------------|
| **Claude Code** | `/plugin marketplace add hoangNguyenAngelhack/ai-agent-setup` |
| **VS Code Copilot** | Settings → Enable plugin marketplaces |
| **Cursor** | Direct plugin installation |
| **OpenAI Codex** | `codex skill install github:hoangNguyenAngelhack/ai-agent-setup` |
| **Gemini CLI** | See [geminicli.com/docs](https://geminicli.com/docs/cli/skills/) |
| **Others** | Copy `.agents/skills/` directory |

---

## What's Included

### Project Structure

```
.claude/                         # Claude Code configuration
├── CLAUDE.md                    # Main AI instructions
├── commands/                    # 8 slash commands
├── agents/                      # 11 specialized agents
├── rules/                       # 13 mandatory rules
├── skills/                      # Advanced skills
└── references/                  # 6 checklists

.agents/                         # Agent Skills (open standard)
└── skills/
    ├── nodejs-backend/
    ├── react-frontend/
    ├── react-native-mobile/
    ├── code-review/
    └── tdd/

templates/                       # Project templates
├── backend/                     # Express + Prisma + Redis
├── frontend-nextjs/             # Next.js 14 (App Router)
├── frontend-vite/               # React + Vite SPA
├── fullstack/                   # Next.js + tRPC + Prisma
├── mobile-expo/                 # Expo + Expo Router
└── mobile-cli/                  # React Native CLI
```

### Specialized Agents (11 total)

| Category | Agents |
|----------|--------|
| **Development** | Frontend, Backend, Mobile, Systems Architect |
| **Quality** | Code Reviewer, Test Engineer, Security Auditor, QA |
| **Product** | Project Manager, UI/UX Designer, Copywriter/SEO |

### Slash Commands (8 total)

| Command | Purpose |
|---------|---------|
| `/spec` | Create PRD with objectives and scope |
| `/plan` | Decompose into vertical slices |
| `/build` | Implement incrementally using TDD |
| `/test` | Write tests with RED-GREEN-REFACTOR |
| `/review` | Five-axis code review |
| `/deploy` | Build, test, and deploy |
| `/debug` | Systematic error diagnosis |
| `/simplify` | Reduce code complexity |

### Mandatory Rules (13 total)

| Category | Rules |
|----------|-------|
| **Code Quality** | clean-code, code-style, error-handling |
| **Architecture** | tech-stack, system-design, project-structure, api-conventions |
| **Data** | naming-conventions, database |
| **Operations** | security, monitoring, testing, git-workflow |

---

## Development Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   /spec  →  /plan  →  /build  →  /test  →  /review  →  /deploy  │
│                                                                  │
│   Define    Plan     Build     Verify    Review      Ship        │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Key Concepts

**Five-Axis Code Review:**
1. Correctness — Does it work?
2. Readability — Can others understand it?
3. Architecture — Follows patterns?
4. Security — Input validation? Auth?
5. Performance — N+1? Pagination?

**Test-Driven Development:**
```
RED → GREEN → REFACTOR
```

**Vertical Slicing:**
```
✅ Task 1: User can create task (DB + API + UI)
❌ Task 1: Create all DB models (layer-by-layer)
```

---

## Approved Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend (SEO)** | Next.js 14 (App Router) |
| **Frontend (Admin)** | React + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State** | Zustand + TanStack Query |
| **Backend** | Express.js + TypeScript |
| **ORM** | Prisma |
| **Database** | PostgreSQL |
| **Cache** | Redis (ioredis) |
| **Queue** | BullMQ / RabbitMQ |
| **Auth** | NextAuth.js / JWT + bcrypt |
| **Testing** | Vitest + Playwright |
| **Mobile** | React Native / Expo |
| **Mobile UI** | NativeWind (Tailwind CSS) |

---

## Related Projects

### Official Agent Skills

| Project | Description |
|---------|-------------|
| [dotnet/skills](https://github.com/dotnet/skills) | Official .NET Agent Skills from Microsoft |
| [laravel/boost](https://github.com/laravel/boost) | Laravel Agent Skills |

### Tools & Integrations

| Tool | Description |
|------|-------------|
| [CodeGraph](https://github.com/colbymchenry/codegraph) | Semantic code knowledge graph |
| [Semble](https://github.com/MinishLab/semble) | Code search for AI agents (Python) |

### Learn More

- [Agent Skills Standard](https://agentskills.io) — Open format specification
- [Claude Code Documentation](https://docs.anthropic.com/claude-code) — Official docs

---

## Contributing

1. Follow the workflow (`/spec` → `/plan` → `/build`)
2. Ensure all tests pass
3. Run `/review` before submitting PR
4. Use conventional commit format

---

## Author

**Hoang Nguyen** — [hoang.nguyen@angelhack.com](mailto:hoang.nguyen@angelhack.com)

---

<div align="center">
  <sub>Made with ❤️ by Hoang Nguyen</sub>
</div>
