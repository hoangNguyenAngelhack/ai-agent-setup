# Plan: Frontend UI Library Selection

## Analysis

### Codebase Survey
- **CLI**: `bin/cli.js` - main entry, parseArgs, prompts, copyTemplate
- **Templates**: `templates/frontend-nextjs/`, `templates/frontend-vite/`
- **Current flow**: type → framework → tier → db → author → codegraph

### Integration Points
- `parseArgs()` - add `ui` option
- `config` object - add `ui` field
- `copyTemplate()` - merge UI configs
- Summary display - show UI choice

### Dependencies
- UI configs depend on base templates
- Components depend on config.json structure
- CLI merge logic depends on all configs being ready

---

## Vertical Slices

### Phase 1: Foundation (Config Structure)

#### Task 1.1: Create UI config structure
**Objective**: Setup folder structure và config.json format

**Files to create**:
- `templates/ui-configs/shadcn/config.json`
- `templates/ui-configs/antd/config.json`
- `templates/ui-configs/chakra/config.json`
- `templates/ui-configs/tailwind/config.json`
- `templates/ui-configs/semantic/config.json`

**Acceptance Criteria**:
- [ ] 5 folders created
- [ ] Each has config.json with dependencies, files array
- [ ] JSON valid và parseable

**Dependencies**: None

---

### Phase 2: UI Components (Per Library)

#### Task 2.1: shadcn/ui components
**Objective**: Button, Input, Card cho shadcn

**Files to create**:
- `templates/ui-configs/shadcn/components/button.tsx`
- `templates/ui-configs/shadcn/components/input.tsx`
- `templates/ui-configs/shadcn/components/card.tsx`
- `templates/ui-configs/shadcn/lib/utils.ts`
- `templates/ui-configs/shadcn/tailwind.config.ts`

**Acceptance Criteria**:
- [ ] 3 components TypeScript
- [ ] Uses class-variance-authority
- [ ] Tailwind config với shadcn preset

**Dependencies**: Task 1.1

---

#### Task 2.2: Ant Design components
**Objective**: Button, Input, Card wrapper cho antd

**Files to create**:
- `templates/ui-configs/antd/components/Button.tsx`
- `templates/ui-configs/antd/components/Input.tsx`
- `templates/ui-configs/antd/components/Card.tsx`
- `templates/ui-configs/antd/theme.ts`

**Acceptance Criteria**:
- [ ] 3 components wrap antd components
- [ ] Theme config với customization example
- [ ] ConfigProvider setup

**Dependencies**: Task 1.1

---

#### Task 2.3: Chakra UI components
**Objective**: Button, Input, Card cho Chakra

**Files to create**:
- `templates/ui-configs/chakra/components/Button.tsx`
- `templates/ui-configs/chakra/components/Input.tsx`
- `templates/ui-configs/chakra/components/Card.tsx`
- `templates/ui-configs/chakra/theme.ts`
- `templates/ui-configs/chakra/providers.tsx`

**Acceptance Criteria**:
- [ ] 3 components use Chakra
- [ ] ChakraProvider setup
- [ ] Custom theme example

**Dependencies**: Task 1.1

---

#### Task 2.4: Pure Tailwind components
**Objective**: Button, Input, Card với Tailwind only

**Files to create**:
- `templates/ui-configs/tailwind/components/Button.tsx`
- `templates/ui-configs/tailwind/components/Input.tsx`
- `templates/ui-configs/tailwind/components/Card.tsx`

**Acceptance Criteria**:
- [ ] 3 components pure Tailwind classes
- [ ] No external UI library
- [ ] Variants via props

**Dependencies**: Task 1.1

---

#### Task 2.5: Semantic UI components
**Objective**: Button, Input, Card cho Semantic

**Files to create**:
- `templates/ui-configs/semantic/components/Button.tsx`
- `templates/ui-configs/semantic/components/Input.tsx`
- `templates/ui-configs/semantic/components/Card.tsx`
- `templates/ui-configs/semantic/setup.ts`

**Acceptance Criteria**:
- [ ] 3 components wrap semantic-ui-react
- [ ] CSS import setup
- [ ] TypeScript types

**Dependencies**: Task 1.1

---

### Checkpoint: All UI Configs Complete
**Verify before proceeding**:
- [ ] 5 UI libraries have config.json
- [ ] Each has 3 sample components
- [ ] All files TypeScript valid

---

### Phase 3: CLI Integration

#### Task 3.1: Add --ui flag to CLI
**Objective**: Parse --ui argument

**Files to modify**:
- `bin/cli.js` - parseArgs(), result object, HELP text

**Acceptance Criteria**:
- [ ] `-u, --ui <library>` flag works
- [ ] Values: shadcn, antd, chakra, tailwind, semantic
- [ ] Help text updated

**Dependencies**: None

---

#### Task 3.2: Add UI selection prompt
**Objective**: Interactive UI library selection

**Files to modify**:
- `bin/cli.js` - add step 2e after frontend framework

**Acceptance Criteria**:
- [ ] Prompt shows 5 options
- [ ] Only appears for frontend type
- [ ] Default is shadcn
- [ ] Skipped if --ui flag provided

**Dependencies**: Task 3.1

---

#### Task 3.3: Implement UI config merge
**Objective**: Copy UI configs vào project

**Files to modify**:
- `bin/cli.js` - copyTemplate() or new mergeUIConfig()

**Acceptance Criteria**:
- [ ] Read config.json từ ui-configs/{choice}/
- [ ] Merge dependencies vào package.json
- [ ] Copy components vào src/components/ui/
- [ ] Copy config files (tailwind, theme)

**Dependencies**: Task 3.2, Phase 2 complete

---

#### Task 3.4: Update summary display
**Objective**: Show UI library in summary

**Files to modify**:
- `bin/cli.js` - summary section

**Acceptance Criteria**:
- [ ] UI library shown for frontend projects
- [ ] Commit label includes UI choice

**Dependencies**: Task 3.3

---

### Checkpoint: CLI Complete
**Verify before proceeding**:
- [ ] `npx create-ai-agent-setup test -t frontend -f nextjs -u antd` works
- [ ] Interactive mode shows UI prompt
- [ ] Dependencies merged correctly
- [ ] Components copied correctly

---

### Phase 4: Documentation & Release

#### Task 4.1: Update README
**Objective**: Document UI library options

**Files to modify**:
- `README.md` - CLI options, examples, UI comparison table

**Acceptance Criteria**:
- [ ] --ui flag documented
- [ ] Examples for each UI library
- [ ] Comparison table

**Dependencies**: Phase 3 complete

---

#### Task 4.2: Update CHANGELOG
**Objective**: Document v1.5.0 changes

**Files to modify**:
- `CHANGELOG.md`

**Acceptance Criteria**:
- [ ] v1.5.0 entry with UI library feature

**Dependencies**: Task 4.1

---

#### Task 4.3: Bump version & publish
**Objective**: Release v1.5.0

**Files to modify**:
- `package.json` - version
- `bin/cli.js` - VERSION constant

**Acceptance Criteria**:
- [ ] Version 1.5.0
- [ ] npm publish successful
- [ ] Git tag created

**Dependencies**: Task 4.2

---

## Summary

| Phase | Tasks | Estimated |
|-------|-------|-----------|
| 1. Foundation | 1 task | 5 min |
| 2. UI Components | 5 tasks | 30 min |
| 3. CLI Integration | 4 tasks | 20 min |
| 4. Documentation | 3 tasks | 10 min |
| **Total** | **13 tasks** | **~65 min** |

## Next Step
Run `/build` to implement Phase 1.
