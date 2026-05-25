---
name: react-frontend
description: Build React applications with Next.js or Vite, TailwindCSS, shadcn/ui, Zustand, and TanStack Query. Use when creating web UI components, pages, forms, state management, or data fetching.
license: MIT
metadata:
  author: angelhack
  version: "1.3.2"
compatibility: Requires Node.js 18+ and TypeScript
---

# React Frontend Development

Build modern React applications with best practices.

## Framework Selection

| Use Case | Framework |
|----------|-----------|
| Landing pages, SEO, marketing | Next.js 14 (App Router) |
| Admin panels, dashboards, SPAs | React + Vite |

## Tech Stack

- **Styling**: TailwindCSS + shadcn/ui
- **State**: Zustand (client) + TanStack Query (server)
- **Forms**: react-hook-form + Zod
- **Routing**: Next.js App Router or React Router

## Project Structure (Vite SPA)

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   └── features/        # Feature-specific components
├── pages/               # Route pages
├── hooks/               # Custom hooks
├── stores/              # Zustand stores
├── lib/                 # Utils, API client
└── types/               # TypeScript types
```

## Patterns

### State Management (Zustand)

```typescript
import { create } from 'zustand';

interface AuthState {
  user: User | null;
  token: string | null;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,
  setAuth: (user, token) => set({ user, token }),
  logout: () => {
    localStorage.removeItem('token');
    set({ user: null, token: null });
  },
}));
```

### Data Fetching (TanStack Query)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get('/users').then(res => res.data),
  });
}

// Mutation with cache invalidation
export function useCreateUser() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: CreateUserInput) => api.post('/users', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
    },
  });
}
```

### API Client (Axios)

```typescript
import axios from 'axios';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
```

### Form Handling

```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function LoginForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = (data) => {
    // Handle login
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('email')} />
      {errors.email && <span>{errors.email.message}</span>}
      {/* ... */}
    </form>
  );
}
```

### Component Pattern

```typescript
// Use shadcn/ui + Tailwind
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CardProps {
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Card({ title, children, className }: CardProps) {
  return (
    <div className={cn('rounded-lg border p-4 shadow-sm', className)}>
      <h3 className="font-semibold text-lg mb-2">{title}</h3>
      {children}
    </div>
  );
}
```

## Best Practices

- Use TypeScript with strict mode
- Prefer `const` over `let`
- Use named exports for components
- Keep components small and focused
- Extract reusable logic into hooks
- Use CSS-in-JS sparingly (prefer Tailwind)

## Testing

- Unit tests with Vitest + Testing Library
- E2E tests with Playwright
- Test user interactions, not implementation details
