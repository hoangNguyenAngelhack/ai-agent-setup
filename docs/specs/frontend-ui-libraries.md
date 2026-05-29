# Feature: Frontend UI Library Selection

## Objective
Cho phép user chọn UI library khi tạo frontend project, sử dụng hybrid approach với base templates + UI configs.

## Target Users
- Developers tạo frontend projects với Next.js hoặc Vite
- Cần UI components sẵn sàng để bắt đầu nhanh

## Core Features

### 1. CLI UI Selection Prompt
- Thêm step chọn UI library sau khi chọn framework
- Options: shadcn/ui, Ant Design, Chakra UI, Semantic UI
- Default: shadcn/ui
- Flag: `-u, --ui <library>`

**Acceptance Criteria:**
- [ ] Prompt hiển thị 4 options
- [ ] Default là shadcn nếu skip
- [ ] `--ui antd` flag hoạt động
- [ ] Chỉ hiện khi type = frontend

### 2. UI Libraries & Tailwind Strategy

| Library | Tailwind | Config |
|---------|----------|--------|
| **shadcn/ui** | ✅ Built-in | Standard Tailwind |
| **Ant Design** | ✅ With `important: true` | Prevent antd style conflicts |
| **Chakra UI** | ✅ Optional | Can coexist with Chakra |
| **Semantic UI** | ❌ None | Uses own CSS |

**Ant Design + Tailwind Config:**
```js
// tailwind.config.js
module.exports = {
  important: true, // Override antd styles
  corePlugins: {
    preflight: false, // Disable Tailwind reset to avoid antd conflicts
  },
}
```

### 3. UI Config Structure
- Mỗi UI library có folder riêng trong `templates/ui-configs/`
- Chứa: dependencies, sample components, config files, tailwind config

**Acceptance Criteria:**
- [ ] 4 folders: shadcn, antd, chakra, semantic
- [ ] Mỗi folder có `config.json` với dependencies
- [ ] Antd có tailwind.config với `important: true`
- [ ] Sample components cho mỗi library

### 4. Template Merge Logic
- Copy base template (nextjs/vite)
- Merge UI config vào project
- Update package.json với dependencies
- **Merge tailwind.config** (không overwrite, merge settings)

**Acceptance Criteria:**
- [ ] Dependencies được merge đúng
- [ ] Components được copy vào `src/components/ui/`
- [ ] Tailwind config được MERGE (không replace)
- [ ] Antd: `important: true` và `preflight: false` được thêm vào

### 5. Sample Components (mỗi UI library)
- Button
- Input  
- Card

**Acceptance Criteria:**
- [ ] 3 components cho mỗi UI library
- [ ] TypeScript
- [ ] Consistent API across libraries

## Out of Scope
- Form components phức tạp (DatePicker, Select, Table)
- Dark mode toggle (user tự implement)
- Storybook setup
- Full design system
- Pure Tailwind option (đã có trong base templates)

## Technical Approach

### File Structure
```
templates/
├── frontend-nextjs/          # Base (có Tailwind sẵn)
├── frontend-vite/            # Base (có Tailwind sẵn)
└── ui-configs/
    ├── shadcn/
    │   ├── config.json
    │   ├── lib/utils.ts
    │   └── components/
    │       ├── button.tsx
    │       ├── input.tsx
    │       └── card.tsx
    ├── antd/
    │   ├── config.json
    │   ├── tailwind.config.js    # important: true, preflight: false
    │   ├── provider.tsx
    │   ├── theme.ts
    │   └── components/
    │       ├── Button.tsx
    │       ├── Input.tsx
    │       └── Card.tsx
    ├── chakra/
    │   ├── config.json
    │   ├── provider.tsx
    │   ├── theme.ts
    │   └── components/
    └── semantic/
        ├── config.json
        ├── setup.ts              # CSS import
        └── components/
```

### config.json Format
```json
{
  "name": "antd",
  "displayName": "Ant Design",
  "dependencies": {
    "antd": "^5.13.0",
    "@ant-design/icons": "^5.2.6"
  },
  "devDependencies": {},
  "files": [
    { "src": "components/", "dest": "src/components/ui/" },
    { "src": "provider.tsx", "dest": "src/components/AntdProvider.tsx" },
    { "src": "theme.ts", "dest": "src/lib/antd-theme.ts" }
  ],
  "tailwindMerge": {
    "important": true,
    "corePlugins": {
      "preflight": false
    }
  }
}
```

### Tailwind Merge Strategy

```javascript
// In CLI: mergeUIConfig()
function mergeTailwindConfig(baseConfig, uiConfig) {
  if (uiConfig.tailwindMerge) {
    // Add important: true for antd
    if (uiConfig.tailwindMerge.important) {
      baseConfig.important = true;
    }
    // Disable preflight for antd
    if (uiConfig.tailwindMerge.corePlugins) {
      baseConfig.corePlugins = {
        ...baseConfig.corePlugins,
        ...uiConfig.tailwindMerge.corePlugins
      };
    }
  }
  return baseConfig;
}
```

### CLI Changes
1. Add `--ui` flag to parseArgs
2. Add UI selection prompt (step 2e) - 4 options
3. Update `copyTemplate()` to merge UI configs
4. **Merge tailwind.config** instead of replace
5. Show UI choice in summary

### Dependencies by Library

| Library | Key Dependencies | Tailwind Config |
|---------|-----------------|-----------------|
| shadcn | @radix-ui/*, cva, tailwind-merge | Standard |
| antd | antd, @ant-design/icons | `important: true`, `preflight: false` |
| chakra | @chakra-ui/react, @emotion/*, framer-motion | Standard |
| semantic | semantic-ui-react, semantic-ui-css | N/A (no Tailwind) |

## Code Style
- Follow `.claude/rules/code-style.md`
- Components use TypeScript
- Consistent naming: PascalCase for components

## Testing Strategy
- Manual testing: Create project với mỗi UI option
- Verify: dependencies đúng, components work, no CSS conflicts
- **Antd test**: Verify Tailwind classes override antd with `!important`

## Boundaries

### Always Do
- Merge dependencies không overwrite existing
- Keep base templates untouched
- TypeScript cho tất cả components
- **Merge tailwind config, không replace**

### Ask First
- Thêm UI library mới ngoài 4 options
- Thay đổi default từ shadcn

### Never Do
- Duplicate entire templates cho mỗi UI
- Include full component library (chỉ samples)
- Break existing nextjs/vite templates
- **Replace tailwind.config (phải merge)**

## Implementation Tasks

1. [x] Create `templates/ui-configs/` structure
2. [x] Create shadcn config + components (partial)
3. [ ] Create antd config + components + tailwind merge
4. [ ] Create chakra config + components
5. [ ] Create semantic config + components
6. [ ] Update CLI: add `--ui` flag (4 options, remove tailwind)
7. [ ] Update CLI: add UI selection prompt
8. [ ] Update CLI: merge UI configs with tailwind merge
9. [ ] Update CLI: show UI in summary
10. [ ] Update README with UI options
11. [ ] Test all combinations (especially antd + tailwind)
12. [ ] Publish new version

## Next Step
Continue `/build` with updated spec.
