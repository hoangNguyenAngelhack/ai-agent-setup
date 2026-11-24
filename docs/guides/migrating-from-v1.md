# Migrating from V1 (create-ai-agent-setup 1.x)

This guide is for people who created a project with `create-ai-agent-setup` 1.x, or copied the V1
`.claude/` folder into a project, and want to move to V2. V2 is a preview on the
`feature/v2-foundation` branch; npm still serves 1.6.1. Until V2 is published, build it from source
(see the [README](../../README.md#quick-start-v2-from-source)) and replace `create-ai-agent-setup` in
the commands below with `node <path-to-ai-agent-setup>/bin/cli.js`.

**Short version:** V2 never changes your V1 files silently. Run `diff`, then `setup --yes`; review the
`*.ai-agent-setup.new` files it writes next to yours; remove the broad V1 `allow` rules; run `doctor`.
`rollback` undoes everything.

## 1. What changes when you create a new project

| Area | V1 (1.6.1) | V2 |
|---|---|---|
| `-f nestjs`, `-f nextjs`, … | ignored (always the default framework) | honoured |
| `--db mysql` / `sqlite` | ignored (always PostgreSQL) | switches the Prisma provider and `DATABASE_URL` |
| `-T strict` | not written anywhere | selects `profile.strict` (stricter required gates) |
| `--version` | printed `1.5.1` | prints the package version |
| AI configuration | downloaded from GitHub `main` at create time | generated offline from the catalog bundled with the package |
| `.claude/settings.json` | broad `allow` list (`Bash(rm *)`, `Bash(curl *)`, `Edit(*)`, …) plus the maintainer's machine paths | no `allow` list; destructive commands are `ask`; a policy hook checks every command and write |
| Hooks | 7 shell scripts that never received their input (inert) | one policy hook that reads the host's JSON input and asks or blocks |
| `.claude/CLAUDE.md` | V1 document | managed section (workflows, agents, quality gates, safety) |
| Install record | none | `.ai-agent-setup/manifest.json`; `doctor` and `rollback` work |
| Unknown options | silently ignored | error |
| Project named `setup`, `doctor`, … | allowed | use `create setup` (these names are commands now) |
| Git commit failure | aborted with a half-created project | warns; the project is complete |
| Codex | not supported | `--adapter codex` (or both) |

## 2. Add V2 to a project created with V1

Start from a clean git working tree so every change is easy to review.

1. **Preview.** Nothing is written:

   ```bash
   create-ai-agent-setup diff .
   ```

   Lines marked `create` are new files, `merge` adds managed content to a file you keep, and
   `create … ← conflict` means your file differs from the V2 version.

2. **Apply.**

   ```bash
   create-ai-agent-setup setup . --yes
   ```

   What happens to V1 files:
   - Every V1 file stays byte-identical except two shared files: `.claude/CLAUDE.md` gets a managed
     section appended, and `.claude/settings.json` gets V2 `ask` rules and the policy hook merged in.
     Your existing keys stay.
   - V1 rules whose content is unchanged in V2 (for example `.claude/rules/security.md`) are adopted
     as managed files without changes.
   - Where the V2 version differs (agents and skills gain frontmatter, path-scoped rules gain
     `paths:`), V2 writes `<file>.ai-agent-setup.new` next to yours. Claude Code does not load these
     `.new` files.

3. **Review the `.new` files.**

   ```bash
   find . -name '*.ai-agent-setup.new'
   diff -u .claude/agents/backend.md .claude/agents/backend.md.ai-agent-setup.new
   ```

   To let V2 manage those files (recommended if you never edited them), re-run with backups:

   ```bash
   create-ai-agent-setup setup . --yes --strategy backup-overwrite
   ```

   Your versions are saved in `.ai-agent-setup/backups/<transaction>/`, and `rollback` restores
   them. Then delete the leftover `*.ai-agent-setup.new` files.

4. **Remove the broad V1 permissions.** `setup` warns with `W_V1_PERMISSIONS` but does not delete
   your configuration. In `.claude/settings.json`, review `permissions.allow` and remove entries you
   do not need, especially `Bash(rm *)`, `Bash(curl *)`, `Bash(kill *)`, `Edit(*)`, `Write(*)`,
   `WebFetch(*)`, `mcp__*`, and any entry or `additionalDirectories` path that points to another
   person's machine (`/Users/...`).

5. **Remove the inert V1 hooks (optional).** V1 registered `.claude/hooks/PreToolUse/*.sh`,
   `PostToolUse/*.sh` and `Lifecycle/*.sh` in `settings.json`. They read a `$TOOL_INPUT` variable
   that Claude Code does not provide, so they never did anything. The V2 policy hook
   (`.claude/hooks/ai-agent-setup/policy-check.cjs`) replaces the secret scan. Remove the old entries
   and scripts if you do not use them for something else.

6. **Check and commit.**

   ```bash
   create-ai-agent-setup doctor .
   git add -A && git commit -m "chore: adopt ai-agent-setup V2 configuration"
   ```

   Commit `.ai-agent-setup/manifest.json`; `backups/` and `transactions/` are git-ignored.

**Undo at any step:** `create-ai-agent-setup rollback .` restores the previous state byte for byte.
Run it again to step further back. It refuses when a file changed after the install; `--force`
discards those later changes.

## 3. Add Codex

```bash
create-ai-agent-setup setup . --yes --adapter claude-code,codex
```

Codex gets a managed section in `AGENTS.md`, skills in `.agents/skills/`, agents in
`.codex/agents/`, and `.codex/config.toml` / `.codex/hooks.json`. Codex reads project `.codex/`
files only after you trust the project, and runs the hook only after you approve it with `/hooks`.

## 4. Where V1 content went

| V1 | V2 |
|---|---|
| Agents `backend`, `frontend`, `mobile`, `code-reviewer`, `qa`, `test-engineer`, `project-manager`, `ui-ux-designer`, `systems-architect`, `copywriter-seo` | Same names, generated from V1 compatibility aliases of 9 canonical agents; bodies unchanged |
| Agent `security-auditor` | Canonical agent, now read-only (`disallowedTools: Edit, Write`) |
| Build resolver agents (`react-build-resolver`, …) | Skills `build-resolve-*` (the V1 files had no frontmatter, so Claude Code never loaded them as agents) |
| Commands `/spec`, `/plan`, `/build`, `/test`, `/review`, `/deploy`, `/debug`, `/simplify`, `/fix-issue` | Same commands. `/deploy` still runs the `deploy` skill, as in V1 |
| Rules | Same text. `security`, `clean-code`, `code-style`, `git-workflow`, `error-handling` are always loaded; language, testing, API, database and monitoring rules load for matching files; `naming-conventions`, `project-structure`, `system-design`, `tech-stack` became on-demand skills |
| `honesty` rule | Opt-in with `-H`, as in V1 |
| `react-native.md` rule | Not included: it was written for one specific app (brand colours, `pages/delivery/`) |
| References (checklists) | Copied into the skills that use them, under `references/` |
| MCP server collection | Opt-in per server with `--enable-tool tool.mcp-<name>`; written to `.mcp.json` / `.codex/config.toml`, which the hosts actually read |
| `scripts/init.sh`, `scripts/create-project.js`, `make init`, `make copy` | Deprecated; use `create` and `setup` (removal planned for 2.1) |

## 5. Known limitations

See [Known limitations in the README](../../README.md#known-limitations). The design behind this
migration is in [docs/v2/07](../v2/07-migration-strategy.md).
