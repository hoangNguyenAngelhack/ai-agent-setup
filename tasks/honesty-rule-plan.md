# Plan: Honesty Rule Integration

## Analysis

### Current Flow
1. CLI downloads entire `.claude/` folder via `degit`
2. No rule selection — all rules are included automatically
3. No interactive step for optional rules

### Key Files
| File | Purpose |
|------|---------|
| `bin/cli.js` | Main CLI logic |
| `templates/.claude/rules/` | Template rules (copied to user project) |
| `.claude/rules/honesty.md` | Source honesty rule (already exists) |

### Integration Approach
Since CLI already downloads all `.claude/` files via degit, we need to:
1. Add `honesty.md` to `templates/.claude/rules/`
2. Add optional step in CLI to ask about honesty rule
3. If user declines, delete the file after download

---

## Tasks

### Phase 1: Add Template File

#### Task 1.1: Copy honesty.md to templates
**Objective**: Add honesty rule to template folder

**Files to modify**:
- `templates/.claude/rules/honesty.md` (create)

**Acceptance Criteria**:
- [ ] File exists at `templates/.claude/rules/honesty.md`
- [ ] Content matches `.claude/rules/honesty.md`

**Verification**:
- [ ] `cat templates/.claude/rules/honesty.md` shows correct content

---

### Phase 2: Add CLI Option

#### Task 2.1: Add honesty prompt to CLI
**Objective**: Ask user if they want honesty rule (after CodeGraph step)

**Files to modify**:
- `bin/cli.js`

**Changes**:
1. Add `config.honesty` flag (default: false)
2. Add Step 8: "Include honesty rule?" (y/N)
3. Show in configuration summary

**Acceptance Criteria**:
- [ ] User sees "Include honesty rule?" prompt
- [ ] Default is "N" (unchecked)
- [ ] Choice is saved to `config.honesty`
- [ ] Summary shows honesty selection

---

#### Task 2.2: Remove honesty.md if not selected
**Objective**: Delete honesty rule file if user declined

**Files to modify**:
- `bin/cli.js`

**Changes**:
1. After `degit` downloads `.claude/`, check `config.honesty`
2. If false, delete `.claude/rules/honesty.md`

**Acceptance Criteria**:
- [ ] If user selects N → file is deleted
- [ ] If user selects Y → file remains
- [ ] No error if file doesn't exist

---

### Phase 3: CLI Flag Support

#### Task 3.1: Add --honesty flag
**Objective**: Allow non-interactive honesty selection

**Files to modify**:
- `bin/cli.js`

**Changes**:
1. Add `-H, --honesty` to argument parser
2. Add to HELP text
3. Skip prompt if flag provided

**Acceptance Criteria**:
- [ ] `npx create-ai-agent my-app --honesty` includes rule
- [ ] `npx create-ai-agent my-app -y` does NOT include (default off)
- [ ] Help shows `--honesty` option

---

## Checkpoint: Integration Complete

**Verify before marking done**:
- [ ] `npx create-ai-agent test-app` → shows honesty prompt
- [ ] Selecting Y → `.claude/rules/honesty.md` exists
- [ ] Selecting N → `.claude/rules/honesty.md` deleted
- [ ] `--honesty` flag works
- [ ] `-y` flag skips and excludes honesty

---

## TODO Summary

```
## Phase 1: Template
- [ ] Task 1.1: Copy honesty.md to templates/.claude/rules/

## Phase 2: CLI Prompt
- [ ] Task 2.1: Add honesty prompt to CLI
- [ ] Task 2.2: Remove honesty.md if not selected

## Phase 3: Flag Support
- [ ] Task 3.1: Add --honesty CLI flag

## Checkpoint: Test full flow
```

---

## Next Step

Run `/build` to implement tasks incrementally.
