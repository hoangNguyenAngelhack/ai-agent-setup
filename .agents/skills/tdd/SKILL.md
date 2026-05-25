---
name: tdd
description: Test-Driven Development workflow with RED-GREEN-REFACTOR cycle. Use when writing tests first, implementing features with TDD, or ensuring code correctness through testing.
license: MIT
metadata:
  author: angelhack
  version: "1.3.2"
---

# Test-Driven Development

Write tests before code using the RED-GREEN-REFACTOR cycle.

## The TDD Cycle

```
┌─────────────────────────────────────────┐
│                                         │
│   RED → GREEN → REFACTOR → (repeat)     │
│                                         │
│   Fail   Pass    Improve                │
│                                         │
└─────────────────────────────────────────┘
```

### RED: Write a Failing Test

Write a test for the behavior you want. The test should fail because the code doesn't exist yet.

```typescript
// Step 1: Write the test FIRST
describe('UserService', () => {
  it('should create a user with valid data', async () => {
    const service = new UserService(mockRepo);
    
    const user = await service.createUser({
      email: 'test@example.com',
      name: 'Test User',
    });
    
    expect(user.id).toBeDefined();
    expect(user.email).toBe('test@example.com');
  });
});
```

### GREEN: Make It Pass

Write the minimal code to make the test pass. Don't over-engineer.

```typescript
// Step 2: Write MINIMAL code to pass
class UserService {
  constructor(private repo: UserRepository) {}
  
  async createUser(data: CreateUserInput): Promise<User> {
    return this.repo.create({
      id: generateId(),
      email: data.email,
      name: data.name,
      createdAt: new Date(),
    });
  }
}
```

### REFACTOR: Improve the Code

Clean up while keeping tests green. Extract functions, rename variables, remove duplication.

```typescript
// Step 3: Improve while staying GREEN
class UserService {
  constructor(private repo: UserRepository) {}
  
  async createUser(data: CreateUserInput): Promise<User> {
    this.validateEmail(data.email);
    return this.repo.create(this.buildUser(data));
  }
  
  private validateEmail(email: string): void {
    if (!isValidEmail(email)) {
      throw new AppError('Invalid email', 422);
    }
  }
  
  private buildUser(data: CreateUserInput): User {
    return {
      id: generateId(),
      email: data.email,
      name: data.name,
      createdAt: new Date(),
    };
  }
}
```

## Test Structure

### AAA Pattern (Arrange-Act-Assert)

```typescript
it('should calculate order total with discount', () => {
  // Arrange - Set up test data
  const order = {
    items: [
      { price: 100, quantity: 2 },
      { price: 50, quantity: 1 },
    ],
    discountPercent: 10,
  };
  
  // Act - Execute the code under test
  const total = calculateOrderTotal(order);
  
  // Assert - Verify the result
  expect(total).toBe(225); // (200 + 50) * 0.9
});
```

### Test Naming

```typescript
// Pattern: should [expected behavior] when [condition]

it('should return user when found', async () => {});
it('should throw NotFoundError when user does not exist', async () => {});
it('should apply discount when coupon is valid', async () => {});
```

## What to Test

### Happy Path
```typescript
it('should create user successfully with valid data', async () => {
  const user = await service.createUser(validData);
  expect(user).toBeDefined();
});
```

### Error Cases
```typescript
it('should throw ValidationError for invalid email', async () => {
  await expect(service.createUser({ email: 'invalid' }))
    .rejects.toThrow('Invalid email');
});
```

### Edge Cases
```typescript
it('should handle empty array gracefully', async () => {
  const result = await service.processItems([]);
  expect(result).toEqual([]);
});

it('should handle null input', async () => {
  const result = service.formatName(null);
  expect(result).toBe('');
});
```

### Boundary Conditions
```typescript
it('should reject password shorter than 8 characters', () => {
  expect(() => validatePassword('1234567')).toThrow();
});

it('should accept password of exactly 8 characters', () => {
  expect(() => validatePassword('12345678')).not.toThrow();
});
```

## Mocking

### Mock Dependencies

```typescript
describe('UserService', () => {
  let service: UserService;
  let mockRepo: jest.Mocked<UserRepository>;
  
  beforeEach(() => {
    mockRepo = {
      create: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };
    service = new UserService(mockRepo);
  });
  
  it('should call repository with correct data', async () => {
    mockRepo.create.mockResolvedValue({ id: '1', ...validData });
    
    await service.createUser(validData);
    
    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({ email: validData.email })
    );
  });
});
```

### Mock External Services

```typescript
jest.mock('@/lib/email', () => ({
  sendEmail: jest.fn().mockResolvedValue({ success: true }),
}));

it('should send welcome email after registration', async () => {
  await service.registerUser(userData);
  
  expect(sendEmail).toHaveBeenCalledWith({
    to: userData.email,
    template: 'welcome',
  });
});
```

## Coverage Requirements

| Tier | Coverage |
|------|----------|
| Starter | 50% |
| Standard | 80% |
| Strict | 95% |

## Anti-Patterns to Avoid

```typescript
// DON'T: Test implementation details
it('should call private method', () => {
  // Testing internal implementation, not behavior
});

// DO: Test behavior/outcomes
it('should return formatted user name', () => {
  expect(formatUser(user)).toEqual(expectedOutput);
});

// DON'T: Multiple assertions testing different things
it('should work correctly', () => {
  expect(result.name).toBe('test');
  expect(result.email).toBe('test@test.com');
  expect(result.age).toBe(25);
  expect(service.callCount).toBe(1); // Different concern!
});

// DO: One concept per test
it('should return user with correct name', () => {});
it('should return user with correct email', () => {});
```
