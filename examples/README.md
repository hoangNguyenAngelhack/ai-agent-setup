# Examples

Sample code demonstrating the coding standards and patterns defined in `.claude/rules/`.

## Backend Examples

| File | Demonstrates |
|------|-------------|
| [app-error.ts](backend/app-error.ts) | Custom error classes (error-handling.md) |
| [user-service.ts](backend/user-service.ts) | Service layer with caching (clean-code.md, naming-conventions.md) |
| [user-controller.ts](backend/user-controller.ts) | Controller with Zod validation (api-conventions.md) |
| [user-routes.ts](backend/user-routes.ts) | Express routes with auth middleware (security.md) |
| [db.ts](backend/db.ts) | Prisma singleton pattern (database.md) |
| [cache.ts](backend/cache.ts) | Redis cache utilities (tech-stack.md) |
| [async-handler.ts](backend/async-handler.ts) | Async error wrapper (error-handling.md) |
| [error-handler.ts](backend/error-handler.ts) | Global error handler (error-handling.md) |
| [logger.ts](backend/logger.ts) | Pino logger setup (monitoring.md) |
| [auth-middleware.ts](backend/auth-middleware.ts) | JWT authentication (security.md) |
| [user-service.test.ts](backend/user-service.test.ts) | Unit tests with Vitest (testing.md) |

## Frontend Examples

| File | Demonstrates |
|------|-------------|
| [api.ts](frontend/api.ts) | Axios instance with interceptors (tech-stack.md) |
| [use-users.ts](frontend/use-users.ts) | TanStack Query hooks (tech-stack.md) |
| [user-list.tsx](frontend/user-list.tsx) | React component with shadcn/ui (tech-stack.md) |
| [user-store.ts](frontend/user-store.ts) | Zustand state management (tech-stack.md) |

## Key Patterns

### Layered Architecture
```
Routes → Controller → Service → Repository → Database
```

### Cache Key Naming
```
{app}:{version}:{entity}:{id}:{variant}
myapp:v1:user:123:profile
```

### Error Response Format
```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found"
  }
}
```

### Pagination Response
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 100,
    "totalPages": 5
  }
}
```
