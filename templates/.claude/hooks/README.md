# Hooks System

Hooks are automated scripts that run before/after Claude Code tool operations. They help enforce quality standards, automate formatting, and track session activity.

## Hook Types

| Type | When | Use Case |
|------|------|----------|
| **PreToolUse** | Before tool executes | Block dangerous operations, validate input |
| **PostToolUse** | After tool executes | Auto-format, type-check, lint |
| **Lifecycle** | Session events | Summary, cost tracking, cleanup |

## Available Hooks

### PreToolUse

| Hook | Trigger | Purpose |
|------|---------|---------|
| `security-scan.sh` | Write/Edit | Scan for secrets/credentials |
| `lint-check.sh` | Bash(git commit) | Run linter before commit |

### PostToolUse

| Hook | Trigger | Purpose |
|------|---------|---------|
| `auto-format.sh` | Edit | Run Prettier on edited files |
| `typescript-check.sh` | Edit(*.ts,*.tsx) | Type-check TypeScript files |
| `console-log-warn.sh` | Edit | Warn about console.log statements |

### Lifecycle

| Hook | Event | Purpose |
|------|-------|---------|
| `session-summary.sh` | Stop | Log session summary |
| `cost-tracker.sh` | Stop | Track token usage |

## Configuration

Hooks are configured in `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": ".claude/hooks/PreToolUse/security-scan.sh $TOOL_INPUT"
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
            "command": ".claude/hooks/PostToolUse/auto-format.sh $TOOL_INPUT"
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

## Environment Variables

Hooks receive these environment variables:

| Variable | Description |
|----------|-------------|
| `TOOL_NAME` | Name of the tool (Edit, Write, Bash, etc.) |
| `TOOL_INPUT` | JSON input to the tool |
| `TOOL_OUTPUT` | Tool output (PostToolUse only) |
| `TOOL_EXIT_CODE` | Exit code (PostToolUse only) |

## Creating Custom Hooks

1. Create a shell script in the appropriate folder
2. Make it executable: `chmod +x your-hook.sh`
3. Add configuration to `settings.json`

### Hook Script Template

```bash
#!/bin/bash
# Hook: your-hook-name
# Type: PreToolUse | PostToolUse | Lifecycle
# Purpose: Describe what this hook does

set -e

# Parse input
INPUT="$TOOL_INPUT"

# Your logic here
# ...

# Exit codes:
# 0 = success (continue)
# non-zero = failure (block action for PreToolUse, warn for PostToolUse)
exit 0
```

## Best Practices

1. **Keep hooks fast** — Long-running hooks slow down the workflow
2. **Graceful failure** — PostToolUse hooks should warn, not block
3. **Idempotent** — Running multiple times should produce same result
4. **Log clearly** — Output should be actionable
5. **Test independently** — Each hook should work standalone

## Disabling Hooks

To disable all hooks temporarily:

```json
{
  "hooks": {}
}
```

To disable a specific hook, remove its entry from `settings.json`.

## Troubleshooting

**Hook not running?**
- Check `matcher` pattern matches the tool
- Verify script is executable (`chmod +x`)
- Check script path is correct

**Hook blocking unexpectedly?**
- Check exit code (0 = pass, non-zero = block)
- Review script logic for false positives

**Debug output:**
- Add `echo` statements to your hook
- Check `/tmp/claude-hooks.log` for logs
