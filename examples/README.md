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

## Mobile Examples — Expo

| File | Demonstrates |
|------|-------------|
| [api.ts](mobile-expo/api.ts) | Axios client with auth interceptors (tech-stack.md) |
| [auth-store.ts](mobile-expo/auth-store.ts) | Zustand + MMKV persistence (tech-stack.md) |
| [use-users.ts](mobile-expo/use-users.ts) | TanStack Query with infinite scroll (tech-stack.md) |
| [user-list.tsx](mobile-expo/user-list.tsx) | FlatList with expo-image (mobile-performance-checklist.md) |
| [user-list.test.tsx](mobile-expo/user-list.test.tsx) | React Native Testing Library tests (testing.md) |
| [root-navigator.tsx](mobile-expo/root-navigator.tsx) | Expo Router with auth flow (mobile.md) |
| [login-screen.tsx](mobile-expo/login-screen.tsx) | Form with react-hook-form + zod (tech-stack.md) |
| [animated-card.tsx](mobile-expo/animated-card.tsx) | Reanimated animations + skeleton (mobile-performance-checklist.md) |
| [secure-storage.ts](mobile-expo/secure-storage.ts) | expo-secure-store utils (security.md) |
| [ui-components.tsx](mobile-expo/ui-components.tsx) | Button, Input, Badge, Avatar (tech-stack.md) |

## Mobile Examples — React Native CLI

| File | Demonstrates |
|------|-------------|
| [api.ts](mobile-cli/api.ts) | Axios client with react-native-config (tech-stack.md) |
| [auth-store.ts](mobile-cli/auth-store.ts) | Zustand + MMKV persistence (tech-stack.md) |
| [use-users.ts](mobile-cli/use-users.ts) | TanStack Query with infinite scroll (tech-stack.md) |
| [user-list.tsx](mobile-cli/user-list.tsx) | FlatList with FastImage (mobile-performance-checklist.md) |
| [root-navigator.tsx](mobile-cli/root-navigator.tsx) | React Navigation with auth flow (mobile.md) |
| [login-screen.tsx](mobile-cli/login-screen.tsx) | Form with react-hook-form + zod (tech-stack.md) |
| [secure-storage.ts](mobile-cli/secure-storage.ts) | react-native-keychain utils (security.md) |
| [app.tsx](mobile-cli/app.tsx) | App entry with providers (tech-stack.md) |

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

### Mobile FlatList Pattern
```tsx
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  getItemLayout={getItemLayout}
  removeClippedSubviews
  maxToRenderPerBatch={10}
  windowSize={5}
/>
```

### Mobile Auth Flow
```
RootNavigator
├── !authenticated → AuthStack (Login, Register)
├── !onboarded → OnboardingScreen
└── authenticated → MainTabs + DetailScreens
```
