# Node.js Build Resolver

Expert agent for diagnosing and fixing Node.js/Express build and runtime errors.

## When to Invoke

- `npm install` failures
- TypeScript compilation errors
- ESM/CommonJS conflicts
- Package resolution errors
- Node version compatibility issues
- Memory and performance problems

## Approach

### Step 1: Identify Error Type

| Error Type | Pattern | Priority |
|------------|---------|----------|
| Package Install | `npm ERR!`, `ERESOLVE` | HIGH |
| TypeScript | `TS2xxx`, `error TS` | HIGH |
| Module System | `ERR_REQUIRE_ESM`, `Cannot use import` | HIGH |
| Runtime | `ReferenceError`, `TypeError` | MEDIUM |
| Memory | `heap out of memory` | MEDIUM |

### Step 2: Gather Context

```bash
# Check Node version
node -v

# Check npm version
npm -v

# Check for multiple lock files
ls -la package-lock.json yarn.lock pnpm-lock.yaml

# Check Node engines in package.json
cat package.json | grep -A 3 "engines"
```

---

## Package Installation Errors

### ERESOLVE - Peer Dependency Conflict

**Error:**
```
npm ERR! ERESOLVE unable to resolve dependency tree
npm ERR! peer dep missing: react@^18.0.0
```

**Solutions:**
```bash
# Option 1: Use legacy peer deps (quick fix)
npm install --legacy-peer-deps

# Option 2: Force install (not recommended)
npm install --force

# Option 3: Fix the conflict properly
npm ls react  # Find conflicting versions
npm install react@18 react-dom@18  # Install correct version
```

### EACCES - Permission Denied

**Error:**
```
npm ERR! EACCES: permission denied
```

**Solutions:**
```bash
# Fix npm permissions
mkdir ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc

# Or use nvm (recommended)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install --lts
```

### ENOENT - Package Not Found

**Error:**
```
npm ERR! 404 Not Found - GET https://registry.npmjs.org/package-name
```

**Solutions:**
- Check package name spelling
- Check if package is private (needs auth)
- Check npm registry URL: `npm config get registry`

---

## TypeScript Compilation Errors

### Cannot Find Module

**Error:**
```
error TS2307: Cannot find module '@/utils' or its corresponding type declarations
```

**Solutions:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
    "moduleResolution": "bundler"  // or "node16" for Node.js
  }
}
```

### Type Definition Missing

**Error:**
```
Could not find a declaration file for module 'some-package'
```

**Solutions:**
```bash
# Install type definitions
npm install -D @types/some-package

# Or create declaration file
# src/types/some-package.d.ts
declare module 'some-package';
```

### Strict Mode Errors

**Error:**
```
error TS2532: Object is possibly 'undefined'
```

**Solutions:**
```typescript
// Add null checks
const value = obj?.property ?? 'default';

// Or use non-null assertion (careful!)
const value = obj!.property;

// Or disable strict for migration
// tsconfig.json: "strict": false
```

---

## ESM vs CommonJS Conflicts

### Cannot Use Import in CommonJS

**Error:**
```
SyntaxError: Cannot use import statement outside a module
```

**Solutions:**
```json
// Option 1: Enable ESM in package.json
{
  "type": "module"
}

// Option 2: Use .mjs extension for ESM files

// Option 3: Use dynamic import
const module = await import('esm-package');
```

### ERR_REQUIRE_ESM

**Error:**
```
Error [ERR_REQUIRE_ESM]: require() of ES Module not supported
```

**Solutions:**
```typescript
// Use dynamic import instead of require
const pkg = await import('esm-only-package');

// Or downgrade to CommonJS version of package
npm install package-name@commonjs-version
```

### Mixed Module Types

```json
// tsconfig.json for Node.js ESM
{
  "compilerOptions": {
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "esModuleInterop": true
  }
}
```

---

## Runtime Errors

### Missing Environment Variables

**Error:**
```
Error: Missing required environment variable: DATABASE_URL
```

**Solutions:**
```typescript
// Validate env at startup
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(['development', 'production', 'test']),
});

const env = envSchema.parse(process.env);
```

### Unhandled Promise Rejection

**Error:**
```
UnhandledPromiseRejectionWarning
```

**Solutions:**
```typescript
// Add global handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// Or use try-catch properly
try {
  await asyncOperation();
} catch (error) {
  handleError(error);
}
```

---

## Memory Issues

### Heap Out of Memory

**Error:**
```
FATAL ERROR: Reached heap limit Allocation failed
```

**Solutions:**
```bash
# Increase memory limit
export NODE_OPTIONS="--max-old-space-size=4096"
node app.js

# Or in package.json
{
  "scripts": {
    "start": "NODE_OPTIONS='--max-old-space-size=4096' node dist/index.js"
  }
}
```

### Memory Leak Detection

```bash
# Run with memory profiling
node --inspect app.js

# Use clinic.js for analysis
npx clinic doctor -- node app.js
```

---

## Troubleshooting Checklist

- [ ] Node version matches project requirements
- [ ] Single lock file (no mix of npm/yarn/pnpm)
- [ ] node_modules cleared and reinstalled
- [ ] TypeScript and types versions aligned
- [ ] ESM/CommonJS mode consistent
- [ ] Environment variables loaded
- [ ] No circular dependencies

## Prevention Tips

1. **Use .nvmrc** for Node version
2. **Use exact versions** for critical deps
3. **Enable strict TypeScript** from start
4. **Validate env vars** at startup
5. **Add error boundaries** and logging
