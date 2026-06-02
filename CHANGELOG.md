# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2026-06-02

### Added
- **Hooks System** — Automated checks before/after tool operations
  - PreToolUse hooks: `security-scan.sh` (block secrets), `lint-check.sh`
  - PostToolUse hooks: `auto-format.sh`, `typescript-check.sh`, `console-log-warn.sh`
  - Lifecycle hooks: `session-summary.sh`, `cost-tracker.sh`
  - `.claude/hooks/README.md` with documentation
- **MCP Server Configs** — Pre-configured MCP servers collection
  - `mcp-servers.json` — Full collection (16 servers)
  - `mcp-servers.minimal.json` — Minimal set (3 servers)
  - `.env.example` — Environment variables template
  - Servers: Supabase, Vercel, Playwright, GitHub, Sentry, and more
- **Build Resolver Agents** — Specialized agents for fixing build errors
  - `react-build-resolver.md` — React/Next.js build errors
  - `react-native-resolver.md` — Metro, iOS, Android build errors
  - `node-build-resolver.md` — npm, TypeScript, ESM/CJS issues
  - `prisma-resolver.md` — Migration, schema, query errors
- **Language-Specific Rules** — Best practices for specific languages
  - `typescript-patterns.md` — Type safety, generics, utility types
  - `python-patterns.md` — PEP8, type hints, async patterns
  - `sql-patterns.md` — Query optimization, N+1 prevention, indexes

### Changed
- Updated CLAUDE.md with Hooks System and MCP Configs sections
- Updated README.md with new features documentation
- Agent count increased from 11 to 15
- Rule count increased from 14 to 17

---

## [1.5.1] - 2026-05-26

### Added
- **Honesty Rule** — Optional rule to reduce AI hallucinations
  - New CLI flag `--honesty` / `-H` to include honesty rule
  - Interactive prompt (Step 8) asking user to include rule
  - Rule instructs Claude to:
    - Acknowledge uncertainty instead of fabricating answers
    - Never invent sources, statistics, or quotes
    - Flag information that may be outdated
- **Honesty Guide** — Documentation for setting up honesty prompt
  - `docs/guides/claude-honesty-prompt.md` (English)
  - `docs/guides/claude-honesty-prompt-vi.md` (Vietnamese)

### Changed
- CLI now has 9 steps (added honesty rule step after CodeGraph)
- Updated rules count from 13 to 14

---

## [1.5.0] - 2026-05-25

### Added
- **UI Library Selection** for frontend projects
  - New CLI flag `--ui` / `-u` to specify UI library
  - Interactive prompt for UI library selection
  - 4 UI library options: `shadcn`, `antd`, `chakra`, `semantic`
- **UI Config Templates** (`templates/ui-configs/`)
  - `shadcn/` — Radix UI + Tailwind CSS components (Button, Input, Card)
  - `antd/` — Ant Design components with Tailwind integration
  - `chakra/` — Chakra UI components with theme provider
  - `semantic/` — Semantic UI React components
- **Tailwind + Ant Design Compatibility**
  - Automatic `important: true` in tailwind.config for antd
  - Automatic `preflight: false` to prevent Tailwind resetting antd styles
- **Component Files**: Each UI library includes Button, Input, Card components

### Changed
- CLI now shows UI library in configuration summary
- Commit label includes UI (e.g., `frontend/nextjs/antd`, `frontend/vite/shadcn`)
- Updated README with UI library examples

### Technical Details
- New `mergeUIConfig()` function handles:
  - Dependency merging into package.json
  - File copying from ui-configs to project
  - Tailwind config modifications for antd compatibility

---

## [1.4.0] - 2026-05-25

### Added
- **NestJS Backend Template** (`templates/backend-nestjs/`)
  - Full NestJS setup with TypeScript
  - Prisma ORM with User model and Role enum
  - JWT authentication with Passport
  - Role-based access control (RBAC) with `@Roles()` decorator
  - Redis caching via `@nestjs/cache-manager`
  - Swagger/OpenAPI documentation at `/api-docs`
  - Global HTTP exception filter
  - Custom decorators (`@CurrentUser`, `@Roles`)
  - Repository pattern for data access
  - Modular structure (auth, users modules)
- **Backend Framework Selection** in CLI
  - New prompt: "Backend framework: Express or NestJS?"
  - Express remains the default for quick setup
  - NestJS option for enterprise/DI patterns

### Changed
- CLI now shows framework in summary for backend projects
- Commit label includes framework (e.g., `backend/nestjs`, `backend/express`)
- Updated README with NestJS documentation

---

## [1.3.5] - 2026-05-25

### Added
- **NestJS Skill**: New `nestjs-backend` skill for enterprise NestJS development
  - Dependency Injection patterns
  - Guards, Interceptors, Pipes
  - TypeORM/Prisma integration
  - Microservices patterns
- **Impact Levels**: All skills now include severity levels (CRITICAL, HIGH, MEDIUM)
- **Compile Script**: `scripts/compile-skills.js` generates `AGENTS.md` from all skills
- **AGENTS.md**: Auto-generated compiled output of all skills

### Changed
- **Skills Updated**: All 6 skills now have impact level annotations
- **Better Organization**: Skills follow agent-nestjs-skills patterns

---

## [1.3.3] - 2026-05-25

### Added
- **Agent Skills (Open Standard)**: Added 5 skills following [agentskills.io](https://agentskills.io) standard
  - `nodejs-backend` — Express, Prisma, Redis, BullMQ patterns
  - `react-frontend` — Next.js/Vite, TailwindCSS, Zustand, TanStack Query
  - `react-native-mobile` — Expo/RN CLI, NativeWind, React Navigation
  - `code-review` — Five-axis code review framework
  - `tdd` — Test-Driven Development workflow
- **`.agents/skills/` Directory**: Skills compatible with 30+ AI agents
- **Agent Skills Badge**: Added compatibility badge to README

### Changed
- **README Reorganization**: Complete restructure for better readability
  - Added Table of Contents
  - Grouped installation methods together
  - Created dedicated Integrations section
  - Added compatible agents table with install commands
  - Added Related Projects section

### Compatible Agents
Claude Code, Cursor, VS Code Copilot, OpenAI Codex, Gemini CLI, Junie, OpenCode, OpenHands, and 20+ more

---

## [1.3.2] - 2026-05-25

### Added
- **CodeGraph Integration**: Optional MCP server for semantic code exploration
  - New CLI flag `--codegraph` / `-c` to setup during project creation
  - Interactive prompt (step 7) asking about CodeGraph setup
  - Auto-runs `npx @colbymchenry/codegraph init -i` when enabled
- **Documentation**: Added "Recommended Tools" section to CLAUDE.md with CodeGraph benefits and usage

### CodeGraph Benefits
- 57% fewer tokens processed
- 35% cost reduction on average
- 46% faster responses
- 71% fewer tool calls

---

## [1.3.1] - 2026-05-21

### Changed
- Version bump for npm publish fix

---

## [1.3.0] - 2026-05-21

### Added
- **Pre-built Templates**: All project types now use pre-built templates instead of generating code inline
- **Template Directory**: `templates/` folder with ready-to-use project structures

### Changed
- CLI now copies from `templates/` directory for faster project creation
- Improved placeholder replacement for project configuration

---

## [1.2.0] - 2026-05-20

### Added
- **Project Templates**: Added `templates/` folder with pre-configured project structures
- **Improved Permissions**: Better default permissions in settings.json

---

## [1.1.0] - 2026-04-29

### Added
- **Mobile Support**: Full React Native development support with both Expo and React Native CLI
- **Mobile Developer Agent**: New agent (`agents/mobile.md`) for React Native development
- **Mobile References**: 
  - `mobile-performance-checklist.md` — FPS, memory, bundle size optimization
  - `mobile-release-checklist.md` — App Store & Play Store submission requirements
- **Mobile Examples**: 
  - `examples/mobile-expo/` — 10 example files for Expo projects
  - `examples/mobile-cli/` — 8 example files for React Native CLI projects
- **Mobile Templates**:
  - `templates/mobile-expo/` — Ready-to-use Expo project template
  - `templates/mobile-cli/` — Ready-to-use React Native CLI project template
- **Create Project Script**: Added `mobile-expo` and `mobile-cli` options to `scripts/create-project.js`

### Changed
- **tech-stack.md**: Added 15 new entries for mobile development (React Native, Expo, NativeWind, React Navigation, MMKV, Reanimated, etc.)
- **CLAUDE.md**: Added Mobile Developer agent and mobile references to documentation

### Tech Stack (Mobile)
- Framework: React Native 0.74+ / Expo SDK 51+
- Navigation: React Navigation 6 / Expo Router
- Styling: NativeWind (Tailwind CSS)
- State: Zustand + MMKV
- Server State: TanStack Query
- Forms: React Hook Form + Zod
- Animations: react-native-reanimated
- Images: expo-image / FastImage
- Storage: expo-secure-store / react-native-keychain

---

## [1.0.0] - 2026-04-28

### Added
- Initial release with production-ready Claude Code configuration
- **Workflow**: `/spec` → `/plan` → `/build` → `/test` → `/review` → `/deploy`
- **10 Agents**: Frontend, Backend, Systems Architect, Code Reviewer, Test Engineer, Security Auditor, QA, Project Manager, UI/UX Designer, Copywriter/SEO
- **13 Rules**: clean-code, code-style, error-handling, tech-stack, system-design, project-structure, api-conventions, naming-conventions, database, security, monitoring, testing, git-workflow
- **5 Skills**: TDD, code-review, incremental-implementation, deploy, security-review
- **4 References**: security-checklist, testing-patterns, performance-checklist, accessibility-checklist
- **Examples**: Backend (11 files) and Frontend (4 files) sample implementations

### Tech Stack
- Frontend: Next.js 14, React, Vite, Tailwind CSS, shadcn/ui, Zustand, TanStack Query
- Backend: Express.js, TypeScript, Prisma, PostgreSQL, Redis, BullMQ
- Testing: Vitest, Playwright
- Monitoring: Prometheus, Grafana, Pino

---

## Version Guidelines

### When to bump versions

| Change Type | Version Bump | Example |
|-------------|--------------|---------|
| Breaking rule changes | Major (X.0.0) | Changing required test coverage from 80% to 90% |
| New rules/agents/commands | Minor (0.X.0) | Adding a new `/audit` command |
| Bug fixes, typos, clarifications | Patch (0.0.X) | Fixing a typo in documentation |

### How to document changes

```markdown
## [X.Y.Z] - YYYY-MM-DD

### Added
- New features or rules

### Changed
- Updates to existing rules (document old → new)

### Deprecated
- Rules that will be removed in future versions

### Removed
- Rules or features that were removed

### Fixed
- Bug fixes or corrections
```
