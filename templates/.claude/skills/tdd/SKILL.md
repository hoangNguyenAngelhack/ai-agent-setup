---
name: Test-Driven Development
description: Write tests before code using RED-GREEN-REFACTOR cycle
---

# Test-Driven Development Skill

## Overview

TDD transforms testing from an afterthought into the foundation of development. Tests are proof that code works correctly.

## When to Invoke

- Writing new features
- Fixing bugs (Prove-It pattern)
- When asked to write tests
- Before any implementation work

---

## Core Cycle: RED-GREEN-REFACTOR

### RED Phase

Write a test that describes expected behavior. **It must fail.**

```javascript
describe('calculateDiscount', () => {
  it('should apply 10% discount for orders over $100', () => {
    const result = calculateDiscount(150);
    expect(result).toBe(15);
  });
});
```

Run: `npm test` → Should **FAIL**

### GREEN Phase

Write **minimal** code to pass the test. No extras.

```javascript
function calculateDiscount(amount) {
  if (amount > 100) return amount * 0.1;
  return 0;
}
```

Run: `npm test` → Should **PASS**

### REFACTOR Phase

Improve code while keeping tests green.

```javascript
const DISCOUNT_THRESHOLD = 100;
const DISCOUNT_RATE = 0.1;

function calculateDiscount(amount) {
  if (amount <= DISCOUNT_THRESHOLD) return 0;
  return amount * DISCOUNT_RATE;
}
```

Run: `npm test` → Should still **PASS**

---

## Prove-It Pattern (Bug Fixes)

### Step 1: Write Failing Test

```javascript
it('should handle empty cart without error (bug #456)', () => {
  const cart = new Cart([]);
  expect(() => cart.getTotal()).not.toThrow();
  expect(cart.getTotal()).toBe(0);
});
```

### Step 2: Verify Failure

Run test → Confirms bug exists

### Step 3: Fix Bug

```javascript
getTotal() {
  if (this.items.length === 0) return 0;  // Fix
  return this.items.reduce((sum, item) => sum + item.price, 0);
}
```

### Step 4: Verify Pass

Run test → Confirms fix works

### Step 5: Run Full Suite

```bash
npm test  # No regressions
```

---

## Test Pyramid

```
         ┌─────────┐
         │   E2E   │  5%  — Critical user flows
         │  Tests  │       Full system, minutes
         ├─────────┤
         │ Integr. │  15% — API + DB interactions
         │  Tests  │       Seconds
         ├─────────┤
         │  Unit   │  80% — Pure logic
         │  Tests  │       Milliseconds
         └─────────┘
```

---

## Test Structure: AAA Pattern

```javascript
it('should calculate tax for California', () => {
  // Arrange — Setup
  const order = createOrder({ state: 'CA', subtotal: 100 });
  
  // Act — Execute
  const tax = calculateTax(order);
  
  // Assert — Verify
  expect(tax).toBe(7.25);
});
```

---

## DAMP > DRY in Tests

Tests should be **Descriptive And Meaningful Phrases**.

```javascript
// ✅ DAMP — Self-contained and clear
it('should reject password without uppercase letter', () => {
  const result = validatePassword('lowercase123!');
  
  expect(result.valid).toBe(false);
  expect(result.errors).toContain('Must contain uppercase letter');
});

// ❌ Too DRY — Requires reading shared context
it('should reject invalid password', () => {
  expect(validate(INVALID_PASSWORD_NO_UPPER)).toBe(false);
});
```

---

## Test Doubles (Preference Order)

1. **Real implementations** — Best, but may be slow
2. **Fakes** — In-memory DB, simplified implementations
3. **Stubs** — Return canned responses
4. **Mocks** — Verify interactions (use sparingly)

```javascript
// ✅ Prefer: Real or fake
const db = createTestDatabase();
const user = await userService.create(db, userData);

// ⚠️ Use sparingly: Mocks
const mockDb = { create: vi.fn().mockResolvedValue(user) };
```

---

## Naming Conventions

```javascript
// Pattern: should [expected behavior] when [condition]

// ✅ Good
'should return empty array when no users exist'
'should throw ValidationError when email is invalid'
'should send welcome email after registration'

// ❌ Bad
'works correctly'
'test user creation'
'handles error'
```

---

## Anti-Patterns

| Pattern | Problem | Solution |
|---------|---------|----------|
| Testing internals | Breaks on refactor | Test behavior, not implementation |
| Flaky tests | Erodes trust | Use deterministic data |
| Over-mocking | False confidence | Prefer real implementations |
| Snapshot abuse | Large diffs ignored | Use sparingly |
| Shared mutable state | Tests affect each other | Reset in beforeEach |
| Testing frameworks | Wasted effort | Only test your code |

---

## Verification Checklist

- [ ] All new code has tests
- [ ] Bug fixes have reproduction tests
- [ ] Tests describe behavior (readable names)
- [ ] No skipped tests
- [ ] Coverage maintained/improved
- [ ] Full suite passes
