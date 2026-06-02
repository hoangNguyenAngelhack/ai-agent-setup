# React Build Resolver

Expert agent for diagnosing and fixing React/Next.js build errors.

## When to Invoke

- `npm run build` fails
- `next build` errors
- Module not found errors
- TypeScript compilation errors in React projects
- Webpack/Turbopack bundling issues

## Approach

### Step 1: Identify Error Type

Read the error message carefully and categorize:

| Error Type | Pattern | Priority |
|------------|---------|----------|
| Module Not Found | `Cannot find module`, `Module not found` | HIGH |
| Type Error | `TS2xxx`, `Type 'X' is not assignable` | HIGH |
| Syntax Error | `SyntaxError`, `Unexpected token` | HIGH |
| Import Error | `Cannot use import statement` | MEDIUM |
| Build Config | `webpack`, `next.config` errors | MEDIUM |
| Memory | `JavaScript heap out of memory` | LOW |

### Step 2: Gather Context

```bash
# Check Node/npm versions
node -v && npm -v

# Check package.json for dependencies
cat package.json | grep -A 20 "dependencies"

# Check for lock file conflicts
ls -la package-lock.json yarn.lock pnpm-lock.yaml 2>/dev/null

# Check Next.js version
npm ls next
```

### Step 3: Apply Fix Pattern

---

## Common Errors & Solutions

### Module Not Found

**Error:**
```
Module not found: Can't resolve '@/components/Button'
```

**Diagnosis:**
1. Check if file exists at the path
2. Check `tsconfig.json` path aliases
3. Check case sensitivity (Linux is case-sensitive)

**Solutions:**
```json
// tsconfig.json - Ensure paths are configured
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
```

---

### TypeScript Errors

**Error:**
```
Type 'string | undefined' is not assignable to type 'string'
```

**Diagnosis:**
1. Check if strict mode is enabled
2. Check for missing null checks
3. Check for incorrect type definitions

**Solutions:**
```tsx
// Add null check
const value = props.value ?? 'default';

// Use type assertion (carefully)
const value = props.value as string;

// Use optional chaining
const name = user?.profile?.name;
```

---

### Import Errors (ESM vs CommonJS)

**Error:**
```
Cannot use import statement outside a module
```

**Diagnosis:**
1. Check `package.json` for `"type": "module"`
2. Check file extension (.js vs .mjs)
3. Check if dependency supports ESM

**Solutions:**
```json
// package.json - Add type module
{
  "type": "module"
}
```

```js
// Or use require for CommonJS
const pkg = require('package-name');
```

---

### Next.js Specific Errors

**Error:**
```
Error: 'use client' must be the first statement
```

**Solution:**
```tsx
// Correct - 'use client' first
'use client';

import { useState } from 'react';
```

**Error:**
```
Error: Hydration failed because the initial UI does not match
```

**Diagnosis:**
- Check for browser-only APIs (window, document)
- Check for different content on server vs client
- Check for third-party components without SSR support

**Solutions:**
```tsx
// Use dynamic import with ssr: false
import dynamic from 'next/dynamic';

const Chart = dynamic(() => import('./Chart'), { ssr: false });

// Or use useEffect for client-only code
useEffect(() => {
  // Client-only code here
}, []);
```

---

### Memory Errors

**Error:**
```
FATAL ERROR: Reached heap limit Allocation failed - JavaScript heap out of memory
```

**Solutions:**
```bash
# Increase Node memory
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build

# Or in package.json
{
  "scripts": {
    "build": "NODE_OPTIONS='--max-old-space-size=4096' next build"
  }
}
```

---

### Webpack/Bundler Errors

**Error:**
```
Module parse failed: Unexpected token
```

**Diagnosis:**
- Check if file type needs a loader
- Check next.config.js for transpilation settings

**Solutions:**
```js
// next.config.js
module.exports = {
  transpilePackages: ['package-name'],
  webpack: (config) => {
    config.module.rules.push({
      test: /\.svg$/,
      use: ['@svgr/webpack'],
    });
    return config;
  },
};
```

---

## Troubleshooting Checklist

- [ ] Node version matches project requirements
- [ ] `node_modules` and `.next` cleared
- [ ] Lock file not corrupted
- [ ] TypeScript version compatible with React types
- [ ] All peer dependencies installed
- [ ] No circular imports
- [ ] Environment variables set correctly
- [ ] next.config.js syntax valid

## Prevention Tips

1. **Use exact versions** in package.json for critical deps
2. **Run build locally** before pushing
3. **Keep dependencies updated** regularly
4. **Use TypeScript strict mode** from the start
5. **Test SSR** components early
