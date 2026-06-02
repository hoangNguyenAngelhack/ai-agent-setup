# Feature: ECC Features Integration

## Objective

Bổ sung các tính năng hay từ ECC (Enhanced Claude Configuration) vào `ai-agent-setup`, bao gồm: Hooks system nâng cao, MCP server configs, Build error resolvers, và Language-specific reviewers.

## Target Users

- Developers sử dụng Claude Code với `ai-agent-setup`
- Teams muốn tự động hóa quality checks và workflow
- Projects cần tích hợp nhiều external services (Supabase, Vercel, etc.)

## Core Features

### 1. Advanced Hooks System

**Acceptance Criteria:**
- [ ] PreToolUse hooks: chạy checks trước khi edit/write/bash
- [ ] PostToolUse hooks: auto-format, type-check sau khi edit
- [ ] Lifecycle hooks: session-start, session-end với summary
- [ ] Hooks có thể enable/disable từng cái
- [ ] Documentation rõ ràng cách tạo custom hooks

**Hooks cần implement:**

| Hook | Type | Trigger | Action |
|------|------|---------|--------|
| `security-scan` | PreToolUse | Write/Edit | Scan secrets trước khi write |
| `lint-check` | PreToolUse | Bash(git commit) | Run linter trước commit |
| `auto-format` | PostToolUse | Edit | Run Prettier sau edit |
| `typescript-check` | PostToolUse | Edit(*.ts,*.tsx) | Type check sau edit TS |
| `console-log-warn` | PostToolUse | Edit | Warn nếu có console.log |
| `session-summary` | Lifecycle | Stop | Tóm tắt session đã làm gì |
| `cost-tracker` | Lifecycle | Stop | Log token usage |

### 2. MCP Server Configs Collection

**Acceptance Criteria:**
- [ ] File `mcp-servers.json` với các servers phổ biến
- [ ] Hướng dẫn cách enable/disable từng server
- [ ] Environment variables template cho mỗi server
- [ ] Giới hạn khuyến nghị: dưới 10 MCPs để tối ưu context

**MCP Servers cần include:**

| Server | Mục đích | Priority |
|--------|----------|----------|
| Supabase | Database operations | HIGH |
| Vercel | Deploy & preview | HIGH |
| Playwright | Browser automation, E2E | HIGH |
| GitHub | Enhanced git operations | MEDIUM |
| Memory | Persistent context | MEDIUM |
| Sentry | Error tracking | MEDIUM |
| Stripe | Payment operations | LOW |
| Resend | Email operations | LOW |

### 3. Build Error Resolver Agents

**Acceptance Criteria:**
- [ ] Agent chuyên fix lỗi build theo từng stack
- [ ] Pattern: phân tích error → tìm root cause → suggest fix
- [ ] Tích hợp với existing agents (Frontend, Backend, Mobile)

**Resolvers cần implement:**

| Resolver | Stack | Common Errors |
|----------|-------|---------------|
| `react-build-resolver` | React/Next.js | Module not found, type errors, build failures |
| `react-native-resolver` | RN/Expo | Metro bundler, native build, pod install |
| `node-build-resolver` | Node.js/Express | Package conflicts, TypeScript compilation |
| `prisma-resolver` | Prisma | Migration errors, schema validation |

### 4. Language-Specific Reviewers

**Acceptance Criteria:**
- [ ] Rules bổ sung cho từng ngôn ngữ
- [ ] Patterns và anti-patterns cụ thể
- [ ] Tích hợp với Code Reviewer agent

**Rules cần implement:**

| Rule | Language | Focus |
|------|----------|-------|
| `typescript-patterns.md` | TypeScript | Type safety, generics, utility types |
| `python-patterns.md` | Python | PEP8, type hints, async patterns |
| `sql-patterns.md` | SQL/Prisma | Query optimization, N+1, indexes |

## Out of Scope

- Cross-harness support (Cursor, Codex, etc.) — giữ focus Claude Code
- Continuous learning system — phức tạp, để phase sau
- Desktop dashboard GUI — không cần
- Plugin marketplace — không cần

## Technical Approach

### Folder Structure

```
.claude/
├── hooks/                      # NEW
│   ├── README.md               # Documentation
│   ├── PreToolUse/
│   │   ├── security-scan.sh
│   │   ├── lint-check.sh
│   │   └── doc-file-warning.sh
│   ├── PostToolUse/
│   │   ├── auto-format.sh
│   │   ├── typescript-check.sh
│   │   └── console-log-warn.sh
│   └── Lifecycle/
│       ├── session-summary.sh
│       └── cost-tracker.sh
│
├── mcp-configs/                # NEW
│   ├── README.md
│   ├── mcp-servers.json        # Full collection
│   ├── mcp-servers.minimal.json
│   └── env.example             # Required env vars
│
├── agents/
│   ├── ... (existing)
│   ├── react-build-resolver.md    # NEW
│   ├── react-native-resolver.md   # NEW
│   ├── node-build-resolver.md     # NEW
│   └── prisma-resolver.md         # NEW
│
└── rules/
    ├── ... (existing)
    ├── typescript-patterns.md     # NEW
    ├── python-patterns.md         # NEW
    └── sql-patterns.md            # NEW
```

### Settings.json Updates

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/PreToolUse/security-scan.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit",
        "hooks": [
          {
            "type": "command", 
            "command": ".claude/hooks/PostToolUse/auto-format.sh"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/Lifecycle/session-summary.sh"
          }
        ]
      }
    ]
  }
}
```

## Code Style

- Follow rules in `.claude/rules/`
- Shell scripts: POSIX-compatible, executable
- Hooks phải exit 0 (success) hoặc non-zero (block action)
- Documentation bằng tiếng Anh

## Testing Strategy

- **Unit tests:** Mỗi hook script chạy độc lập
- **Integration tests:** Hooks trigger đúng với matcher
- **Manual tests:** 
  - Edit file → auto-format chạy
  - Write secrets → security-scan block
  - Session end → summary được log

## Boundaries

### Always Do
- Hooks phải idempotent (chạy nhiều lần = kết quả như nhau)
- Log output rõ ràng để debug
- Graceful failure (hook lỗi không block workflow)

### Ask First
- Thêm MCP server mới ngoài danh sách
- Thay đổi existing agents behavior

### Never Do
- Hooks không được modify source code
- Hooks không được call external APIs (trừ khi explicitly enabled)
- Không commit secrets vào mcp-servers.json

## Implementation Order

| Phase | Items | Effort |
|-------|-------|--------|
| **Phase 1** | Hooks system + documentation | 2-3 hours |
| **Phase 2** | MCP configs collection | 1-2 hours |
| **Phase 3** | Build resolver agents | 2-3 hours |
| **Phase 4** | Language-specific rules | 1-2 hours |
| **Phase 5** | Update all related docs | 1-2 hours |

**Total estimated effort:** 7-12 hours

## Documentation Updates Required

### Files to Update

| File | Changes |
|------|---------|
| `.claude/CLAUDE.md` | Add Hooks section, MCP section, new agents, new rules |
| `README.md` | Add Hooks feature, MCP configs, update feature list |
| `CHANGELOG.md` | Document new features in next version |
| `templates/.claude/CLAUDE.md` | Mirror changes for new projects |
| `templates/.claude/settings.json` | Add hooks configuration template |

### New Documentation Files

| File | Purpose |
|------|---------|
| `.claude/hooks/README.md` | How to use and create hooks |
| `.claude/mcp-configs/README.md` | MCP servers guide |
| `docs/hooks-guide.md` | Detailed hooks documentation |
| `docs/mcp-setup.md` | MCP setup instructions |

### CLAUDE.md Updates

Add new sections:

```markdown
## Hooks System

Automated checks that run before/after tool operations:

| Hook | Type | Purpose |
|------|------|---------|
| `security-scan` | PreToolUse | Block secrets in code |
| `auto-format` | PostToolUse | Auto-format after edit |
| `typescript-check` | PostToolUse | Type check TS files |
| `session-summary` | Lifecycle | Summarize session |

See `.claude/hooks/README.md` for details.

---

## MCP Server Configs

Pre-configured MCP servers for common services:

| Server | Purpose |
|--------|---------|
| Supabase | Database operations |
| Vercel | Deploy & preview |
| Playwright | Browser automation |

See `.claude/mcp-configs/README.md` for setup.
```

### README.md Updates

Add to Features section:

```markdown
### Hooks System
- **PreToolUse hooks** — Security scan, lint checks before operations
- **PostToolUse hooks** — Auto-format, type-check after edits
- **Lifecycle hooks** — Session summary, cost tracking

### MCP Configs
- Pre-configured servers for Supabase, Vercel, Playwright, etc.
- Environment variables templates
- Best practices for MCP management
```

### Templates Updates

Ensure `templates/` folder mirrors all changes for `npx ai-agent-setup` to work correctly:

```
templates/
├── .claude/
│   ├── hooks/           # NEW - copy from .claude/hooks/
│   ├── mcp-configs/     # NEW - copy from .claude/mcp-configs/
│   ├── agents/          # UPDATE - add new resolvers
│   ├── rules/           # UPDATE - add new rules
│   ├── CLAUDE.md        # UPDATE - add new sections
│   └── settings.json    # UPDATE - add hooks config
```

## Success Metrics

- [ ] Hooks hoạt động với settings.json hiện tại
- [ ] MCP configs có thể copy-paste sử dụng ngay
- [ ] Build resolvers giúp fix lỗi nhanh hơn 50%
- [ ] Rules patterns giảm bugs trong code review

## Next Step

Sau khi spec được approve, chạy `/plan` để decompose thành tasks cụ thể.
