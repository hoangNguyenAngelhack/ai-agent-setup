# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
