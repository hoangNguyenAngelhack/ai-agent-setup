# TODO: ECC Features Integration

## Phase 1: Hooks System
- [ ] 1.1 Create hooks folder structure + README
- [ ] 1.2 Create PreToolUse hooks (security-scan, lint-check)
- [ ] 1.3 Create PostToolUse hooks (auto-format, typescript-check, console-log-warn)
- [ ] 1.4 Create Lifecycle hooks (session-summary, cost-tracker)
- [ ] 1.5 Update settings.json with hooks config

## Checkpoint: Hooks Complete
- [ ] All scripts executable
- [ ] settings.json valid
- [ ] README complete

---

## Phase 2: MCP Configs
- [ ] 2.1 Create mcp-configs folder (README, servers.json, minimal.json, .env.example)

## Checkpoint: MCP Complete
- [ ] JSON valid
- [ ] .env.example complete

---

## Phase 3: Build Resolvers
- [ ] 3.1 Create react-build-resolver.md
- [ ] 3.2 Create react-native-resolver.md
- [ ] 3.3 Create node-build-resolver.md
- [ ] 3.4 Create prisma-resolver.md

## Checkpoint: Resolvers Complete
- [ ] All 4 agents created

---

## Phase 4: Language Rules
- [ ] 4.1 Create typescript-patterns.md
- [ ] 4.2 Create python-patterns.md
- [ ] 4.3 Create sql-patterns.md

## Checkpoint: Rules Complete
- [ ] All 3 rules created

---

## Phase 5: Documentation
- [ ] 5.1 Update .claude/CLAUDE.md
- [ ] 5.2 Update README.md
- [ ] 5.3 Update CHANGELOG.md
- [ ] 5.4 Mirror all changes to templates/
- [ ] 5.5 Create docs/hooks-guide.md and docs/mcp-setup.md

## Final Checkpoint
- [ ] Manual test all features
- [ ] `npx ai-agent-setup` works
