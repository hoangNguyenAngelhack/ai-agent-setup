# TypeScript Patterns

> Best practices for type-safe TypeScript code.

## Type Safety

### Use Strict Mode

```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true
  }
}
```

### Avoid `any`

```typescript
// ❌ Bad
function process(data: any) {
  return data.value;
}

// ✅ Good
function process<T extends { value: unknown }>(data: T) {
  return data.value;
}

// ✅ Good - Use unknown for truly unknown types
function parse(json: string): unknown {
  return JSON.parse(json);
}
```

### Use Type Guards

```typescript
// ✅ Type guard function
function isUser(value: unknown): value is User {
  return (
    typeof value === 'object' &&
    value !== null &&
    'id' in value &&
    'email' in value
  );
}

// ✅ Use with narrowing
if (isUser(data)) {
  console.log(data.email); // TypeScript knows this is User
}
```

---

## Utility Types

### Pick & Omit

```typescript
interface User {
  id: string;
  email: string;
  password: string;
  createdAt: Date;
}

// Pick only needed fields
type PublicUser = Pick<User, 'id' | 'email'>;

// Omit sensitive fields
type SafeUser = Omit<User, 'password'>;
```

### Partial & Required

```typescript
// All fields optional (for updates)
type UpdateUserDto = Partial<User>;

// All fields required (from partial)
type CompleteUser = Required<Partial<User>>;
```

### Record

```typescript
// Type-safe object with known keys
type UserRoles = Record<'admin' | 'user' | 'guest', Permission[]>;

// Dynamic keys with typed values
type Cache = Record<string, CacheEntry>;
```

### Readonly

```typescript
// Immutable objects
type Config = Readonly<{
  apiUrl: string;
  timeout: number;
}>;

// Deep readonly
type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};
```

---

## Generics

### Constrained Generics

```typescript
// ✅ Constrain to objects with id
function findById<T extends { id: string }>(items: T[], id: string): T | undefined {
  return items.find(item => item.id === id);
}

// ✅ Multiple constraints
function merge<T extends object, U extends object>(a: T, b: U): T & U {
  return { ...a, ...b };
}
```

### Generic Defaults

```typescript
// ✅ Default generic type
interface ApiResponse<T = unknown> {
  data: T;
  status: number;
}

// Can use without specifying type
const response: ApiResponse = { data: {}, status: 200 };
```

### Generic Functions

```typescript
// ✅ Generic fetch wrapper
async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json() as T;
}

const user = await fetchJson<User>('/api/user');
```

---

## Discriminated Unions

```typescript
// ✅ Use literal types for discrimination
type Result<T> =
  | { success: true; data: T }
  | { success: false; error: string };

function handleResult<T>(result: Result<T>) {
  if (result.success) {
    console.log(result.data); // TypeScript knows data exists
  } else {
    console.error(result.error); // TypeScript knows error exists
  }
}

// ✅ Event types
type Event =
  | { type: 'click'; x: number; y: number }
  | { type: 'keydown'; key: string }
  | { type: 'scroll'; offset: number };

function handleEvent(event: Event) {
  switch (event.type) {
    case 'click':
      console.log(event.x, event.y);
      break;
    case 'keydown':
      console.log(event.key);
      break;
  }
}
```

---

## Type Assertions

### Prefer Type Guards Over Assertions

```typescript
// ❌ Dangerous assertion
const user = data as User;

// ✅ Safe type guard
if (isUser(data)) {
  const user = data; // Safely narrowed
}
```

### Use `satisfies` for Validation

```typescript
// ✅ Validate while keeping literal types
const config = {
  apiUrl: 'https://api.example.com',
  timeout: 5000,
} satisfies Config;

// config.apiUrl is still 'https://api.example.com' (literal), not string
```

### Const Assertions

```typescript
// ✅ Preserve literal types
const ROUTES = {
  home: '/',
  about: '/about',
  contact: '/contact',
} as const;

type Route = typeof ROUTES[keyof typeof ROUTES]; // '/' | '/about' | '/contact'
```

---

## Error Handling

### Typed Errors

```typescript
// ✅ Custom error classes
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500
  ) {
    super(message);
    this.name = 'AppError';
  }
}

class ValidationError extends AppError {
  constructor(message: string, public field: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}
```

### Result Types (Alternative to Exceptions)

```typescript
// ✅ Explicit error handling
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { ok: false, error: 'Cannot divide by zero' };
  }
  return { ok: true, value: a / b };
}
```

---

## Anti-Patterns to Avoid

### Don't Use `Object` or `{}`

```typescript
// ❌ Bad
function process(data: Object) {}
function process(data: {}) {}

// ✅ Good
function process(data: Record<string, unknown>) {}
function process<T extends object>(data: T) {}
```

### Don't Use `Function`

```typescript
// ❌ Bad
const callback: Function = () => {};

// ✅ Good
const callback: () => void = () => {};
const callback: (x: number) => string = (x) => x.toString();
```

### Don't Use Non-Null Assertion Excessively

```typescript
// ❌ Bad - hiding potential null issues
const name = user!.profile!.name!;

// ✅ Good - explicit handling
const name = user?.profile?.name ?? 'Unknown';
```

### Don't Use `@ts-ignore`

```typescript
// ❌ Bad
// @ts-ignore
const value = brokenCode();

// ✅ Better - if truly needed, explain why
// @ts-expect-error: Library types are incorrect, see issue #123
const value = libraryFunction();
```

---

## Module Patterns

### Barrel Exports

```typescript
// src/components/index.ts
export { Button } from './Button';
export { Input } from './Input';
export { Modal } from './Modal';

// Usage
import { Button, Input, Modal } from '@/components';
```

### Type-Only Imports

```typescript
// ✅ Use type-only imports when possible
import type { User, Post } from './types';
import { createUser } from './services';
```
