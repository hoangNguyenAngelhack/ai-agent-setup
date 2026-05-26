# Feature: Honesty Rule Integration

## Objective

Allow users to optionally add the honesty rule when running `npx ai-agent-setup`, reducing AI hallucinations in their projects.

## Target Users

- Developers using Claude Code who want more accurate, less hallucinatory responses
- Teams doing research, documentation, or fact-based work with AI

## Core Features

1. **Add honesty rule as CLI option**
   - Display "honesty" as a selectable rule in the rules list
   - Unchecked by default (optional)
   - Acceptance: User sees honesty in rule selection, can toggle on/off

2. **Copy honesty.md to user's project**
   - When selected, copy `.claude/rules/honesty.md` to user's project
   - English only
   - Acceptance: File exists at `.claude/rules/honesty.md` after setup

3. **Update rule metadata**
   - Add honesty rule to rules index/registry
   - Include description: "Reduce AI hallucinations by enforcing accuracy over confidence"
   - Acceptance: Rule appears in CLI with correct description

## Out of Scope

- Vietnamese version of rule file (docs only)
- Copying guide files to user's project
- Global installation (`~/.claude/CLAUDE.md`)
- Automatic inclusion without user consent

## Technical Approach

### Files to Modify

| File | Change |
|------|--------|
| `src/templates/rules/honesty.md` | Add rule template (copy from `.claude/rules/honesty.md`) |
| `src/config/rules.ts` (or equivalent) | Add honesty to rules registry |
| CLI prompts | Add honesty to rules selection list |

### Rule Registry Entry

```ts
{
  id: 'honesty',
  name: 'Honesty & Epistemic Humility',
  description: 'Reduce AI hallucinations by enforcing accuracy over confidence',
  file: 'honesty.md',
  default: false  // unchecked by default
}
```

## Code Style

- Follow rules in `.claude/rules/`
- Match existing CLI prompt patterns
- Keep rule file as-is (already written)

## Testing Strategy

- **Unit tests**: Rule is correctly added to registry
- **Integration tests**: CLI shows honesty option, copies file when selected
- **Manual test**: Run `npx ai-agent-setup` and verify flow

## Boundaries

### Always Do
- Keep honesty rule optional (not forced)
- Use English for rule file
- Match existing CLI UX patterns

### Ask First
- Changing default selection (currently: unchecked)
- Adding more honesty-related rules

### Never Do
- Auto-include without user selection
- Copy Vietnamese version to user's project
- Modify user's global Claude config

## Next Step

Run `/plan` to decompose into implementation tasks.
