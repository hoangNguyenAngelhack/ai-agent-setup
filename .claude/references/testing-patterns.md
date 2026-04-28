# Testing Patterns Reference

> Quick reference for test patterns. See `.claude/rules/testing.md` for full rules.

## Test Pyramid

```
         ┌─────────┐
         │   E2E   │  5%   Critical user flows
         ├─────────┤
         │  Integ  │  15%  API + DB interactions
         ├─────────┤
         │  Unit   │  80%  Pure logic, fast
         └─────────┘
```

## Test Structure (AAA)

```javascript
it('should [expected behavior] when [condition]', () => {
  // Arrange — Setup
  const user = createTestUser({ role: 'admin' });
  
  // Act — Execute
  const result = checkPermission(user, 'delete');
  
  // Assert — Verify
  expect(result).toBe(true);
});
```

## Unit Test Example

```javascript
describe('calculateDiscount', () => {
  it('should return 10% for orders over $100', () => {
    expect(calculateDiscount(150)).toBe(15);
  });

  it('should return 0 for orders under $100', () => {
    expect(calculateDiscount(50)).toBe(0);
  });

  it('should handle edge case at exactly $100', () => {
    expect(calculateDiscount(100)).toBe(0);
  });
});
```

## Integration Test Example

```javascript
describe('POST /api/users', () => {
  it('should create user and return 201', async () => {
    const response = await request(app)
      .post('/api/users')
      .send({ email: 'test@example.com', name: 'Test' })
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(201);
    expect(response.body.data.email).toBe('test@example.com');
    
    // Verify in database
    const user = await db.user.findUnique({ 
      where: { email: 'test@example.com' } 
    });
    expect(user).toBeDefined();
  });
});
```

## E2E Test Example (Playwright)

```javascript
test('user can complete checkout flow', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.fill('[name="email"]', 'user@example.com');
  await page.fill('[name="password"]', 'password');
  await page.click('button[type="submit"]');

  // Add to cart
  await page.goto('/products/1');
  await page.click('button:has-text("Add to Cart")');

  // Checkout
  await page.goto('/checkout');
  await page.fill('[name="card"]', '4242424242424242');
  await page.click('button:has-text("Pay")');

  // Verify
  await expect(page.locator('.success-message')).toBeVisible();
});
```

## React Component Test

```javascript
import { render, screen, fireEvent } from '@testing-library/react';

describe('Counter', () => {
  it('should increment count when button clicked', () => {
    render(<Counter initialCount={0} />);
    
    const button = screen.getByRole('button', { name: /increment/i });
    fireEvent.click(button);
    
    expect(screen.getByText('Count: 1')).toBeInTheDocument();
  });
});
```

## Test Doubles

```javascript
// 1. Real (preferred)
const db = createTestDatabase();

// 2. Fake (in-memory)
const fakeUserRepo = {
  users: [],
  create(user) { this.users.push(user); return user; },
  findById(id) { return this.users.find(u => u.id === id); }
};

// 3. Stub (canned response)
const stubbedApi = {
  getUser: () => Promise.resolve({ id: '1', name: 'Test' })
};

// 4. Mock (verify interactions — use sparingly)
const mockLogger = vi.fn();
```

## Naming Convention

```javascript
// Pattern: should [expected] when [condition]

// ✅ Good
'should return null when user not found'
'should throw ValidationError when email invalid'
'should emit event when order placed'

// ❌ Bad
'works'
'test user'
'error handling'
```

## Anti-Patterns

| Pattern | Problem | Fix |
|---------|---------|-----|
| Testing internals | Breaks on refactor | Test behavior |
| Shared state | Tests affect each other | Reset in beforeEach |
| Flaky tests | Random failures | Deterministic data |
| Over-mocking | False confidence | Real implementations |
| No assertions | Test always passes | Assert outcomes |
| Magic numbers | Hard to understand | Named constants |

## Coverage Thresholds

```javascript
// vitest.config.js
coverage: {
  thresholds: {
    lines: 80,
    branches: 80,
    functions: 80,
    statements: 80
  }
}
```

## Commands

```bash
npm test                  # Run all tests
npm test -- --watch       # Watch mode
npm test -- --coverage    # Coverage report
npm run test:e2e          # E2E tests
```
