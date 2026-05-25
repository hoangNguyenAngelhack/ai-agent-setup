---
name: nodejs-backend
description: Build production-ready Node.js backend APIs with Express, Prisma, Redis, and BullMQ. Use when creating REST APIs, database models, services, middleware, background jobs, or server-side logic.
license: MIT
metadata:
  author: angelhack
  version: "1.3.5"
compatibility: Requires Node.js 18+, TypeScript, and optionally PostgreSQL/Redis
---

# Node.js Backend Development

Build production-ready backend APIs following industry best practices.

## Impact Levels

| Level | Description |
|-------|-------------|
| **CRITICAL** | Must follow - security, data integrity |
| **HIGH** | Should follow - maintainability, performance |
| **MEDIUM** | Recommended - code quality |

## Tech Stack

- **Framework**: Express.js + TypeScript
- **ORM**: Prisma
- **Database**: PostgreSQL
- **Cache**: Redis (ioredis)
- **Queue**: BullMQ
- **Validation**: Zod
- **Logging**: Pino

## Project Structure

```
src/
├── config/          # Configuration (db, redis, env)
├── controllers/     # Route handlers (thin layer)
├── middleware/      # Auth, error handler, logging
├── repositories/    # Data access layer
├── routes/          # Route definitions
├── services/        # Business logic
├── utils/           # Helpers (AppError, logger)
└── index.ts         # Entry point
```

## Patterns

### Layered Architecture (HIGH)

```
Request → Routes → Middleware → Controllers → Services → Repositories → Database
```

### Error Handling (CRITICAL)

```typescript
// Use AppError for operational errors
class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 500,
    public code: string = 'INTERNAL_ERROR'
  ) {
    super(message);
    this.name = 'AppError';
  }
}

// Throw in services
if (!user) throw new AppError('User not found', 404, 'USER_NOT_FOUND');
```

### API Response Format

```json
// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": { "code": "...", "message": "..." } }

// Paginated
{ "success": true, "data": [...], "pagination": { "page": 1, "total": 100 } }
```

### Database (Prisma) (HIGH)

```typescript
// Always use transactions for multi-step operations
await db.$transaction(async (tx) => {
  const order = await tx.order.create({ data: orderData });
  await tx.inventory.update({ 
    where: { id: productId }, 
    data: { stock: { decrement: 1 } } 
  });
  return order;
});

// Select only needed fields
const user = await db.user.findUnique({
  where: { id },
  select: { id: true, email: true, name: true }
});
```

### Caching (Redis) (HIGH)

```typescript
async function getOrSet<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 3600
): Promise<T> {
  const cached = await redis.get(key);
  if (cached) return JSON.parse(cached);
  
  const data = await fetcher();
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
  return data;
}
```

### Queue (BullMQ) (MEDIUM)

```typescript
// Producer
const emailQueue = new Queue('email', { connection: redis });
await emailQueue.add('send-welcome', { to: user.email, name: user.name });

// Consumer
const worker = new Worker('email', async (job) => {
  await sendEmail(job.data);
}, { connection: redis });
```

## Security Rules (CRITICAL)

- Never hardcode secrets - use environment variables
- Hash passwords with bcrypt (12+ rounds)
- Validate all inputs with Zod
- Use parameterized queries (Prisma handles this)
- Implement rate limiting on auth endpoints
- Use Helmet.js for HTTP security headers

## Testing (HIGH)

- 80% minimum test coverage
- Unit tests for services
- Integration tests for routes
- Use Vitest + Supertest
