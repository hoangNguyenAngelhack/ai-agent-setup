# AI Agent Project — Production-Grade Configuration

<div align="center">

  <h3>Production-ready AI Agent configuration for Claude Code</h3>
  <p>Structured workflows, specialized agents, mandatory rules, and best practices</p>

  [![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=flat-square&color=cb3837&logo=npm)](https://www.npmjs.com/package/create-ai-agent-setup)
  ![Version](https://img.shields.io/badge/version-1.5.1-blue?style=flat-square)
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
npx create-ai-agent-setup my-api -t backend --db postgresql            # Express (default)
npx create-ai-agent-setup my-api -t backend -f nestjs --db postgresql  # NestJS
npx create-ai-agent-setup my-landing -t frontend -f nextjs             # Next.js + shadcn (default)
npx create-ai-agent-setup my-admin -t frontend -f vite -u antd         # Vite + Ant Design
npx create-ai-agent-setup my-dashboard -t frontend -f nextjs -u chakra # Next.js + Chakra UI
npx create-ai-agent-setup my-mobile -t mobile -f expo

# With integrations
npx create-ai-agent-setup my-app --codegraph    # AI code exploration
npx create-ai-agent-setup my-app --honesty      # Reduce AI hallucinations
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
3. Framework:
   - **backend**: express (default), nestjs
   - **frontend**: nextjs, vite
   - **mobile**: expo, cli
4. UI library (frontend only):
   - **shadcn** — Radix UI + Tailwind (recommended)
   - **antd** — Ant Design + Tailwind (enterprise)
   - **chakra** — Chakra UI (simple, accessible)
   - **semantic** — Semantic UI React
5. Rule tier (Starter / Standard / Strict)
6. Database (for backend/fullstack only)
7. Author info
8. CodeGraph setup (optional)
9. Honesty rule (optional) — reduce AI hallucinations

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
  -f, --framework <fw>   Framework: express, nestjs, nextjs, vite, expo, cli
  -u, --ui <library>     UI library (frontend): shadcn, antd, chakra, semantic
  -T, --tier <tier>      Rule tier: starter, standard, strict
  -d, --db <database>    Database: postgresql, mysql, sqlite, none
  -c, --codegraph        Setup CodeGraph MCP server
  -H, --honesty          Include honesty rule (reduce AI hallucinations)
  -y, --yes              Skip prompts, use defaults
  -h, --help             Show help
  -v, --version          Show version
```

### UI Library Support

When creating frontend projects, you can choose from 4 UI libraries:

| Library | Description | Best For |
|---------|-------------|----------|
| **shadcn/ui** | Radix UI + Tailwind CSS | Modern apps, full control |
| **Ant Design** | Enterprise UI + Tailwind | Admin panels, enterprise |
| **Chakra UI** | Simple, accessible | Quick prototypes, accessibility |
| **Semantic UI** | Classic UI framework | Traditional web apps |

**Note:** Tailwind CSS comes bundled with all UI libraries. For Ant Design, the CLI automatically configures `important: true` and `preflight: false` in tailwind.config to prevent style conflicts.

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

#### Available Skills (6 total)

| Skill | Description | Impact Levels |
|-------|-------------|---------------|
| [`nodejs-backend`](.agents/skills/nodejs-backend/SKILL.md) | Express, Prisma, Redis, BullMQ | CRITICAL / HIGH / MEDIUM |
| [`nestjs-backend`](.agents/skills/nestjs-backend/SKILL.md) | NestJS, TypeORM, Guards, DI | CRITICAL / HIGH / MEDIUM |
| [`react-frontend`](.agents/skills/react-frontend/SKILL.md) | Next.js/Vite, TailwindCSS, Zustand | CRITICAL / HIGH / MEDIUM |
| [`react-native-mobile`](.agents/skills/react-native-mobile/SKILL.md) | Expo/RN CLI, NativeWind | CRITICAL / HIGH / MEDIUM |
| [`code-review`](.agents/skills/code-review/SKILL.md) | Five-axis review framework | CRITICAL / MAJOR / MINOR |
| [`tdd`](.agents/skills/tdd/SKILL.md) | RED-GREEN-REFACTOR workflow | CRITICAL / HIGH / MEDIUM |

**Impact Levels:** CRITICAL (must follow) → HIGH (should follow) → MEDIUM (recommended)

#### Install Skills

**Option 1: CLI (Recommended)**
```bash
npx create-ai-agent-setup my-app  # Skills included automatically
```

**Option 2: Copy to Existing Project**
```bash
npx degit hoangNguyenAngelhack/ai-agent-setup/.agents/skills .agents/skills
```

**Option 3: Clone Full Repo**
```bash
git clone https://github.com/hoangNguyenAngelhack/ai-agent-setup.git
cp -r ai-agent-setup/.agents/skills your-project/.agents/skills
```

**Compile Skills to AGENTS.md:**
```bash
node scripts/compile-skills.js  # Generates AGENTS.md with all skills
```

#### Compatible Agents

Skills follow the [agentskills.io](https://agentskills.io) open standard and work with:

- Claude Code
- Cursor
- VS Code Copilot
- Windsurf
- Cline
- Aider
- OpenHands
- And 20+ more AI coding agents

---

## What's Included

### Project Structure

```
.claude/                         # Claude Code configuration
├── CLAUDE.md                    # Main AI instructions
├── commands/                    # 8 slash commands
├── agents/                      # 11 specialized agents
├── rules/                       # 14 mandatory rules
├── skills/                      # Advanced skills
└── references/                  # 6 checklists

.agents/                         # Agent Skills (open standard)
└── skills/
    ├── nodejs-backend/
    ├── nestjs-backend/          # NEW
    ├── react-frontend/
    ├── react-native-mobile/
    ├── code-review/
    └── tdd/

scripts/
└── compile-skills.js            # Generate AGENTS.md from skills

templates/                       # Project templates
├── backend/                     # Express + Prisma + Redis
├── backend-nestjs/              # NestJS + Prisma + JWT + Swagger
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

### Mandatory Rules (14 total)

| Category | Rules |
|----------|-------|
| **Code Quality** | clean-code, code-style, error-handling |
| **Architecture** | tech-stack, system-design, project-structure, api-conventions |
| **Data** | naming-conventions, database |
| **Operations** | security, monitoring, testing, git-workflow |
| **AI Behavior** | honesty (optional) — reduce hallucinations |

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

## Backend Templates

### Express (Default)
Lightweight and flexible, best for simple APIs and microservices.

```bash
npx create-ai-agent-setup my-api -t backend
```

**Includes:** Express, Prisma, Redis, Pino logger, JWT auth middleware

### NestJS (Enterprise)
Full-featured framework with dependency injection, decorators, and enterprise patterns.

```bash
npx create-ai-agent-setup my-api -t backend -f nestjs
```

**Includes:**
- **Auth**: JWT + Passport, refresh tokens
- **RBAC**: `@Roles()` decorator, RolesGuard
- **Database**: Prisma ORM with User model
- **Cache**: Redis via `@nestjs/cache-manager`
- **Docs**: Swagger/OpenAPI at `/api-docs`
- **Patterns**: Repository pattern, global exception filter
- **Decorators**: `@CurrentUser()`, `@Roles()`

---

## Approved Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend (SEO)** | Next.js 14 (App Router) |
| **Frontend (Admin)** | React + Vite |
| **Styling** | Tailwind CSS + shadcn/ui |
| **State** | Zustand + TanStack Query |
| **Backend (Express)** | Express.js + TypeScript |
| **Backend (NestJS)** | NestJS + Prisma + Swagger |
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

### External AI Skills

Skills you can add to enhance your AI agent:

| Project | Description |
|---------|-------------|
| [shadcn-ui/ui](https://github.com/shadcn-ui/ui) | Official shadcn/ui skills — CLI, components, theming |
| [supabase/supabase](https://github.com/supabase/supabase) | Official Supabase skills — Studio, queries, testing |
| [vercel-labs/agent-skills](https://github.com/vercel-labs/agent-skills) | Official Vercel skills — deploy, React best practices |
| [greensock/gsap-skills](https://github.com/greensock/gsap-skills) | Official GSAP skills — animations, ScrollTrigger |

```bash
# Install external skills
npx skills add https://github.com/shadcn-ui/ui
npx skills add https://github.com/supabase/supabase
npx skills add https://github.com/vercel-labs/agent-skills
npx skills add https://github.com/greensock/gsap-skills
```

> See [.claude/references/external-skills.md](.claude/references/external-skills.md) for full list.

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
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | Skills CLI — install skills to any agent |

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
