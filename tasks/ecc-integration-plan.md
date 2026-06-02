# Plan: ECC Features Integration

> Based on [SPEC](../docs/specs/ecc-features-integration.md)

## Overview

Tích hợp 4 tính năng chính từ ECC vào `ai-agent-setup`:
1. Advanced Hooks System
2. MCP Server Configs
3. Build Error Resolver Agents
4. Language-Specific Rules

---

## Phase 1: Hooks System

### Task 1.1: Create hooks folder structure

**Objective**: Tạo folder structure cho hooks

**Files to create**:
- `.claude/hooks/README.md`
- `.claude/hooks/PreToolUse/.gitkeep`
- `.claude/hooks/PostToolUse/.gitkeep`
- `.claude/hooks/Lifecycle/.gitkeep`

**Acceptance Criteria**:
- [ ] Folder structure đúng theo spec
- [ ] README có hướng dẫn cơ bản

**Dependencies**: None

---

### Task 1.2: Create PreToolUse hooks

**Objective**: Tạo hooks chạy TRƯỚC tool operations

**Files to create**:
- `.claude/hooks/PreToolUse/security-scan.sh` — Scan secrets
- `.claude/hooks/PreToolUse/lint-check.sh` — Run linter trước commit

**Acceptance Criteria**:
- [ ] Scripts executable (`chmod +x`)
- [ ] Exit 0 = pass, non-zero = block
- [ ] POSIX-compatible

**Dependencies**: Task 1.1

---

### Task 1.3: Create PostToolUse hooks

**Objective**: Tạo hooks chạy SAU tool operations

**Files to create**:
- `.claude/hooks/PostToolUse/auto-format.sh` — Run Prettier
- `.claude/hooks/PostToolUse/typescript-check.sh` — Type check
- `.claude/hooks/PostToolUse/console-log-warn.sh` — Warn console.log

**Acceptance Criteria**:
- [ ] Scripts executable
- [ ] Graceful failure (warn, không block)
- [ ] Only run on relevant file types

**Dependencies**: Task 1.1

---

### Task 1.4: Create Lifecycle hooks

**Objective**: Tạo hooks cho session events

**Files to create**:
- `.claude/hooks/Lifecycle/session-summary.sh` — Log session summary
- `.claude/hooks/Lifecycle/cost-tracker.sh` — Track token usage

**Acceptance Criteria**:
- [ ] Scripts log to `/tmp/claude-session.log`
- [ ] Graceful handling khi không có data

**Dependencies**: Task 1.1

---

### Task 1.5: Update settings.json với hooks config

**Objective**: Wire hooks vào settings.json

**Files to modify**:
- `.claude/settings.json`

**Acceptance Criteria**:
- [ ] PreToolUse hooks trigger on Write/Edit
- [ ] PostToolUse hooks trigger on Edit
- [ ] Lifecycle hooks trigger on Stop

**Dependencies**: Tasks 1.2, 1.3, 1.4

---

## Checkpoint: Hooks System Complete

**Verify before proceeding**:
- [ ] All hook scripts executable
- [ ] settings.json valid JSON
- [ ] README documentation complete
- [ ] Manual test: edit file → hooks run

---

## Phase 2: MCP Server Configs

### Task 2.1: Create MCP configs folder

**Objective**: Tạo folder và files cho MCP configs

**Files to create**:
- `.claude/mcp-configs/README.md`
- `.claude/mcp-configs/mcp-servers.json` — Full collection
- `.claude/mcp-configs/mcp-servers.minimal.json` — Minimal set
- `.claude/mcp-configs/.env.example` — Required env vars

**Acceptance Criteria**:
- [ ] JSON files valid
- [ ] Servers: Supabase, Vercel, Playwright, GitHub, Memory, Sentry, Stripe, Resend
- [ ] Comments in JSON explaining each server
- [ ] .env.example có tất cả required vars

**Dependencies**: None

---

## Checkpoint: MCP Configs Complete

**Verify before proceeding**:
- [ ] JSON files parse correctly
- [ ] README có setup instructions
- [ ] .env.example đầy đủ

---

## Phase 3: Build Resolver Agents

### Task 3.1: Create React Build Resolver

**Objective**: Agent chuyên fix React/Next.js build errors

**Files to create**:
- `.claude/agents/react-build-resolver.md`

**Acceptance Criteria**:
- [ ] Covers: Module not found, type errors, build failures
- [ ] Pattern: analyze → diagnose → fix
- [ ] Examples của common errors

**Dependencies**: None

---

### Task 3.2: Create React Native Resolver

**Objective**: Agent chuyên fix RN/Expo build errors

**Files to create**:
- `.claude/agents/react-native-resolver.md`

**Acceptance Criteria**:
- [ ] Covers: Metro bundler, native build, pod install
- [ ] iOS và Android specific errors
- [ ] Expo vs bare workflow

**Dependencies**: None

---

### Task 3.3: Create Node.js Build Resolver

**Objective**: Agent chuyên fix Node.js build errors

**Files to create**:
- `.claude/agents/node-build-resolver.md`

**Acceptance Criteria**:
- [ ] Covers: Package conflicts, TS compilation, module resolution
- [ ] ESM vs CommonJS issues
- [ ] Node version compatibility

**Dependencies**: None

---

### Task 3.4: Create Prisma Resolver

**Objective**: Agent chuyên fix Prisma errors

**Files to create**:
- `.claude/agents/prisma-resolver.md`

**Acceptance Criteria**:
- [ ] Covers: Migration errors, schema validation, client generation
- [ ] Database connection issues
- [ ] Type generation problems

**Dependencies**: None

---

## Checkpoint: Build Resolvers Complete

**Verify before proceeding**:
- [ ] All 4 resolver agents created
- [ ] Consistent format across agents
- [ ] Cover common error patterns

---

## Phase 4: Language-Specific Rules

### Task 4.1: Create TypeScript Patterns Rule

**Objective**: Best practices cho TypeScript

**Files to create**:
- `.claude/rules/typescript-patterns.md`

**Acceptance Criteria**:
- [ ] Type safety patterns
- [ ] Generics best practices
- [ ] Utility types usage
- [ ] Anti-patterns to avoid

**Dependencies**: None

---

### Task 4.2: Create Python Patterns Rule

**Objective**: Best practices cho Python

**Files to create**:
- `.claude/rules/python-patterns.md`

**Acceptance Criteria**:
- [ ] PEP8 compliance
- [ ] Type hints usage
- [ ] Async patterns
- [ ] Common pitfalls

**Dependencies**: None

---

### Task 4.3: Create SQL Patterns Rule

**Objective**: Best practices cho SQL/Prisma

**Files to create**:
- `.claude/rules/sql-patterns.md`

**Acceptance Criteria**:
- [ ] Query optimization
- [ ] N+1 prevention
- [ ] Index strategies
- [ ] Transaction patterns

**Dependencies**: None

---

## Checkpoint: Language Rules Complete

**Verify before proceeding**:
- [ ] All 3 rules created
- [ ] Consistent with existing rules format
- [ ] Actionable examples

---

## Phase 5: Documentation Updates

### Task 5.1: Update .claude/CLAUDE.md

**Objective**: Add new sections cho Hooks và MCP

**Files to modify**:
- `.claude/CLAUDE.md`

**Changes**:
- Add Hooks System section
- Add MCP Server Configs section
- Add new agents to Available Agents table
- Add new rules to Mandatory Rules table

**Dependencies**: Phases 1-4

---

### Task 5.2: Update README.md

**Objective**: Document new features

**Files to modify**:
- `README.md`

**Changes**:
- Add Hooks System to Features
- Add MCP Configs to Features
- Update installation instructions if needed

**Dependencies**: Phases 1-4

---

### Task 5.3: Update CHANGELOG.md

**Objective**: Document version bump

**Files to modify**:
- `CHANGELOG.md`

**Changes**:
- Add version 1.6.0 entry
- List all new features
- Breaking changes (if any)

**Dependencies**: Phases 1-4

---

### Task 5.4: Mirror changes to templates/

**Objective**: Ensure npx ai-agent-setup works

**Files to create/modify**:
- `templates/.claude/hooks/` — Copy all hooks
- `templates/.claude/mcp-configs/` — Copy all configs
- `templates/.claude/agents/` — Add new resolvers
- `templates/.claude/rules/` — Add new rules
- `templates/.claude/CLAUDE.md` — Update
- `templates/.claude/settings.json` — Update

**Dependencies**: Phases 1-4, Tasks 5.1-5.3

---

### Task 5.5: Create detailed docs

**Objective**: Tạo documentation files mới

**Files to create**:
- `docs/hooks-guide.md` — Detailed hooks documentation
- `docs/mcp-setup.md` — MCP setup guide

**Dependencies**: Phases 1-2

---

## Final Checkpoint: All Complete

**Verify before shipping**:
- [ ] All hooks work
- [ ] MCP configs valid
- [ ] All agents created
- [ ] All rules created
- [ ] CLAUDE.md updated
- [ ] README.md updated
- [ ] CHANGELOG.md updated
- [ ] templates/ mirrored
- [ ] `npm run build` passes (if applicable)
- [ ] Manual test: `npx ai-agent-setup` in fresh folder

---

## Summary

| Phase | Tasks | Files | Effort |
|-------|-------|-------|--------|
| 1. Hooks | 5 | ~10 | 2-3h |
| 2. MCP | 1 | 4 | 1h |
| 3. Resolvers | 4 | 4 | 2h |
| 4. Rules | 3 | 3 | 1h |
| 5. Docs | 5 | ~15 | 2h |
| **Total** | **18** | **~36** | **8-10h** |
