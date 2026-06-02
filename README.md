<div align="center">

# 🤖 AI Agent Setup

### Production-Ready Claude Code Configuration in Seconds

<p>
  <strong>15 Agents</strong> · <strong>17 Rules</strong> · <strong>8 Commands</strong> · <strong>7 Hooks</strong> · <strong>6 Skills</strong>
</p>

[![npm version](https://img.shields.io/npm/v/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=cb3837)](https://www.npmjs.com/package/create-ai-agent-setup)
[![npm downloads](https://img.shields.io/npm/dm/create-ai-agent-setup?style=for-the-badge&logo=npm&logoColor=white&color=blue)](https://www.npmjs.com/package/create-ai-agent-setup)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=for-the-badge)](LICENSE)
[![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Compatible-green?style=for-the-badge)](https://agentskills.io)
[![Node](https://img.shields.io/badge/Node-18+-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)

<br />

```bash
npx create-ai-agent-setup my-app
```

<sub>Works with Express · NestJS · Next.js · Vite · Expo · React Native</sub>

</div>

<br />

---

## ✨ Why Use This?

| Without AI Agent Setup | With AI Agent Setup |
|------------------------|---------------------|
| ❌ AI makes inconsistent code | ✅ **17 mandatory rules** enforce standards |
| ❌ No structured workflow | ✅ **8 slash commands** (`/spec` → `/deploy`) |
| ❌ Generic AI responses | ✅ **15 specialized agents** for each domain |
| ❌ Manual code review | ✅ **Five-axis review** (correctness, security, perf...) |
| ❌ No quality gates | ✅ **7 hooks** auto-check before/after actions |
| ❌ Setup from scratch | ✅ **One command** to production-ready config |

---

## 🚀 Quick Start

```bash
# Interactive setup (recommended)
npx create-ai-agent-setup my-app
```

### One-Liner Examples

```bash
# Backend
npx create-ai-agent-setup my-api -t backend                    # Express
npx create-ai-agent-setup my-api -t backend -f nestjs          # NestJS

# Frontend
npx create-ai-agent-setup my-site -t frontend -f nextjs        # Next.js + shadcn
npx create-ai-agent-setup my-admin -t frontend -f vite -u antd # Vite + Ant Design

# Mobile
npx create-ai-agent-setup my-app -t mobile -f expo             # Expo

# With integrations
npx create-ai-agent-setup my-app --codegraph                   # 57% fewer tokens
npx create-ai-agent-setup my-app --honesty                     # Reduce hallucinations
```

<details>
<summary>📋 <strong>All CLI Options</strong></summary>

```
Options:
  -t, --type <type>      Project type: backend, frontend, fullstack, mobile
  -f, --framework <fw>   Framework: express, nestjs, nextjs, vite, expo, cli
  -u, --ui <library>     UI library: shadcn, antd, chakra, semantic
  -T, --tier <tier>      Rule tier: starter, standard, strict
  -d, --db <database>    Database: postgresql, mysql, sqlite, none
  -c, --codegraph        Setup CodeGraph MCP server
  -H, --honesty          Include honesty rule (reduce hallucinations)
  -y, --yes              Skip prompts, use defaults
```

</details>

---

## 📦 What's Included

<table>
<tr>
<td width="50%">

### 🎯 Slash Commands (8)

| Command | Purpose |
|---------|---------|
| `/spec` | Create PRD with scope |
| `/plan` | Break into vertical slices |
| `/build` | TDD implementation |
| `/test` | RED-GREEN-REFACTOR |
| `/review` | Five-axis code review |
| `/deploy` | Build & ship |
| `/debug` | Root cause analysis |
| `/simplify` | Reduce complexity |

</td>
<td width="50%">

### 🤖 Specialized Agents (15)

| Category | Agents |
|----------|--------|
| **Dev** | Frontend, Backend, Mobile, Architect |
| **Quality** | Reviewer, Tester, Security, QA |
| **Product** | PM, Designer, Copywriter |
| **Resolvers** | React, RN, Node, Prisma |

</td>
</tr>
<tr>
<td>

### 📏 Mandatory Rules (17)

- **Code**: clean-code, code-style, error-handling
- **Arch**: tech-stack, system-design, api-conventions
- **Data**: naming-conventions, database
- **Ops**: security, monitoring, testing, git-workflow
- **Lang**: typescript, python, sql patterns

</td>
<td>

### 🪝 Hooks System (7)

| Type | Hooks |
|------|-------|
| **Pre** | security-scan, lint-check |
| **Post** | auto-format, ts-check, console-warn |
| **Life** | session-summary, cost-tracker |

</td>
</tr>
</table>

---

## 🔄 Development Workflow

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   📝 /spec  →  📋 /plan  →  🔨 /build  →  🧪 /test  →  👀 /review  │
│                                                                     │
│    Define      Plan       Build       Test       Review    → Ship   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### Five-Axis Code Review

| Axis | Question |
|------|----------|
| ✅ **Correctness** | Does it work as intended? |
| 📖 **Readability** | Can others understand it? |
| 🏗️ **Architecture** | Follows patterns and principles? |
| 🔒 **Security** | Input validated? Auth checked? |
| ⚡ **Performance** | N+1 queries? Proper pagination? |

---

## 🛠️ Installation Methods

### Method 1: CLI (Recommended)

```bash
npx create-ai-agent-setup my-app
```

Interactive prompts guide you through project type, framework, UI library, and integrations.

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
cd my-project && ./scripts/init.sh
```

---

## 🔌 Integrations

### CodeGraph — 57% Fewer Tokens

[CodeGraph](https://github.com/colbymchenry/codegraph) builds a semantic knowledge graph for faster AI exploration.

| Metric | Improvement |
|--------|-------------|
| Tokens | **57% fewer** |
| Cost | **35% cheaper** |
| Speed | **46% faster** |
| Tool calls | **71% fewer** |

```bash
npx create-ai-agent-setup my-app --codegraph
```

### MCP Server Configs

Pre-configured servers for common services:

| Server | Purpose |
|--------|---------|
| **Supabase** | PostgreSQL, auth, storage |
| **Vercel** | Deploy & preview |
| **Playwright** | Browser automation |
| **GitHub** | Enhanced git operations |
| **Sentry** | Error tracking |

---

## 🎨 UI Library Support

| Library | Description | Best For |
|---------|-------------|----------|
| **shadcn/ui** | Radix + Tailwind | Modern apps, full control |
| **Ant Design** | Enterprise UI | Admin panels |
| **Chakra UI** | Simple, accessible | Quick prototypes |
| **Semantic UI** | Classic framework | Traditional apps |

```bash
npx create-ai-agent-setup my-app -t frontend -f nextjs -u chakra
```

---

## 📱 Agent Skills (Open Standard)

Compatible with **30+ AI coding agents** via [agentskills.io](https://agentskills.io):

| Skill | Stack |
|-------|-------|
| `nodejs-backend` | Express, Prisma, Redis, BullMQ |
| `nestjs-backend` | NestJS, TypeORM, Guards, DI |
| `react-frontend` | Next.js/Vite, Tailwind, Zustand |
| `react-native-mobile` | Expo/RN CLI, NativeWind |
| `code-review` | Five-axis review framework |
| `tdd` | RED-GREEN-REFACTOR workflow |

**Works with:** Claude Code, Cursor, VS Code Copilot, Windsurf, Cline, Aider, OpenHands...

---

## 💻 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 14 · React + Vite · Tailwind + shadcn |
| **Backend** | Express · NestJS · Prisma · Redis |
| **Mobile** | Expo · React Native · NativeWind |
| **Database** | PostgreSQL · Redis |
| **Testing** | Vitest · Playwright |
| **Auth** | NextAuth.js · JWT + bcrypt |

---

## 🔗 Related Projects

| Project | Description |
|---------|-------------|
| [CodeGraph](https://github.com/colbymchenry/codegraph) | Semantic code knowledge graph |
| [Agent Skills](https://agentskills.io) | Open standard for AI agents |
| [shadcn/ui](https://github.com/shadcn-ui/ui) | Official shadcn/ui skills |
| [Supabase](https://github.com/supabase/supabase) | Official Supabase skills |

---

## 🤝 Contributing

1. Follow the workflow (`/spec` → `/plan` → `/build`)
2. Ensure all tests pass
3. Run `/review` before submitting PR
4. Use conventional commit format

---

<div align="center">

**Made with ❤️ by [Hoang Nguyen](mailto:hoang.nguyen@angelhack.com)**

<sub>⭐ Star this repo if you find it helpful!</sub>

</div>
