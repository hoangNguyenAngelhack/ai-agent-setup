# Agent Skills

> Auto-generated from `.agents/skills/` — DO NOT EDIT MANUALLY
>
> Run `node scripts/compile-skills.js` to regenerate

## Table of Contents

- [code-review](#code-review)
- [nestjs-backend](#nestjs-backend)
- [nodejs-backend](#nodejs-backend)
- [react-frontend](#react-frontend)
- [react-native-mobile](#react-native-mobile)
- [tdd](#tdd)

## Skills Overview

| Skill | Description |
|-------|-------------|
| **code-review** | Perform five-axis code reviews covering correctness, readability, architecture, security, and performance. Use when reviewing PRs, code changes, or evaluating code quality. |
| **nestjs-backend** | Build production-ready NestJS backend APIs with TypeORM/Prisma, dependency injection, guards, and microservices patterns. Use when creating NestJS APIs, modules, services, controllers, or enterprise-grade backends. |
| **nodejs-backend** | Build production-ready Node.js backend APIs with Express, Prisma, Redis, and BullMQ. Use when creating REST APIs, database models, services, middleware, background jobs, or server-side logic. |
| **react-frontend** | Build React applications with Next.js or Vite, TailwindCSS, shadcn/ui, Zustand, and TanStack Query. Use when creating web UI components, pages, forms, state management, or data fetching. |
| **react-native-mobile** | Build React Native mobile apps with Expo or React Native CLI, NativeWind (Tailwind), React Navigation, and Zustand. Use when creating iOS/Android apps, mobile UI, navigation, or native features. |
| **tdd** | Test-Driven Development workflow with RED-GREEN-REFACTOR cycle. Use when writing tests first, implementing features with TDD, or ensuring code correctness through testing. |

---


## code-review

> Version: 1.0.0

# Five-Axis Code Review

Comprehensive code review framework for production-quality code.

## Impact Levels

| Level | Description |
|-------|-------------|
| **CRITICAL** | Must fix - blocks merge |
| **MAJOR** | Should fix - significant issue |
| **MINOR** | Nice to fix - code quality |
| **NIT** | Optional - style preference |

## The Five Axes

### 1. Correctness (CRITICAL)

- Does the code work as intended?
- Are edge cases handled?
- Does it match the specification/requirements?
- Are there potential bugs or logic errors?

```
Questions to ask:
- What happens with null/undefined inputs?
- What happens with empty arrays/objects?
- Are boundary conditions handled?
- Is error handling comprehensive?
```

### 2. Readability (MAJOR)

- Can others understand this code easily?
- Are names descriptive and consistent?
- Is the code structure logical?
- Are complex parts documented?

```
Questions to ask:
- Would a new team member understand this?
- Are functions focused and well-named?
- Is there unnecessary complexity?
- Are comments explaining WHY, not WHAT?
```

### 3. Architecture (MAJOR)

- Does it follow established patterns?
- Are abstractions appropriate?
- Is the code modular and reusable?
- Are dependencies managed well?

```
Questions to ask:
- Does this belong in this layer/module?
- Is there code duplication?
- Are interfaces clean and minimal?
- Does it violate SOLID principles?
```

### 4. Security (CRITICAL)

- Is user input validated?
- Are secrets properly handled?
- Is authentication/authorization correct?
- Are there injection vulnerabilities?

```
Questions to ask:
- Can user input cause harm?
- Are passwords/tokens exposed in logs?
- Is access control enforced?
- Are SQL queries parameterized?
```

### 5. Performance (MAJOR)

- Are there N+1 queries?
- Is pagination used for lists?
- Are expensive operations cached?
- Are there memory leaks?

```
Questions to ask:
- How does this scale with data size?
- Are database queries optimized?
- Is caching appropriate?
- Are async operations handled correctly?
```

## Review Process

### Step 1: Understand Context

```
- What problem does this PR solve?
- What's the expected behavior?
- Are there related issues/PRs?
```

### Step 2: Review Changes

```
For each file:
1. Understand the purpose of changes
2. Check each axis
3. Note issues with severity (critical/major/minor/nit)
```

### Step 3: Provide Feedback

```
Format:
[SEVERITY] File:Line - Description

Examples:
[CRITICAL] auth.ts:45 - SQL injection vulnerability
[MAJOR] user-service.ts:23 - Missing error handling
[MINOR] utils.ts:12 - Variable name could be clearer
[NIT] config.ts:5 - Inconsistent spacing
```

## Common Issues Checklist

### Security
- [ ] No hardcoded secrets
- [ ] Input validation present
- [ ] Auth checks on protected routes
- [ ] No sensitive data in logs
- [ ] SQL injection prevented

### Performance
- [ ] No N+1 queries
- [ ] Pagination for lists
- [ ] Appropriate caching
- [ ] No memory leaks
- [ ] Async operations correct

### Code Quality
- [ ] Functions < 30 lines
- [ ] Clear naming
- [ ] No code duplication
- [ ] Error handling present
- [ ] Types are specific (no `any`)

### Testing
- [ ] Tests cover happy path
- [ ] Tests cover error cases
- [ ] Tests are maintainable
- [ ] No flaky tests

## Review Output Format

```markdown
## Summary
[1-2 sentence overview of the changes]

## Correctness
- [Findings]

## Readability
- [Findings]

## Architecture
- [Findings]

## Security
- [Findings]

## Performance
- [Findings]

## Verdict
[ ] Approve
[ ] Request Changes
[ ] Comment

## Action Items
1. [Critical issues to fix]
2. [Major issues to address]
```

---


## nestjs-backend

> Version: 1.0.0

# NestJS Backend Development

Build enterprise-grade backend APIs with NestJS framework.

## Tech Stack

- **Framework**: NestJS 10+
- **ORM**: TypeORM / Prisma
- **Database**: PostgreSQL
- **Cache**: Redis (@nestjs/cache-manager)
- **Queue**: BullMQ (@nestjs/bullmq)
- **Validation**: class-validator + class-transformer
- **Documentation**: Swagger (@nestjs/swagger)

## Project Structure

```
src/
├── common/              # Shared utilities
│   ├── decorators/      # Custom decorators
│   ├── filters/         # Exception filters
│   ├── guards/          # Auth guards
│   ├── interceptors/    # Logging, transform
│   └── pipes/           # Validation pipes
├── config/              # Configuration module
├── modules/
│   ├── auth/            # Authentication
│   ├── users/           # User module
│   └── [feature]/       # Feature modules
├── app.module.ts        # Root module
└── main.ts              # Bootstrap
```

## Core Patterns

### Module Structure (CRITICAL)

```typescript
// users/users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService], // Export for other modules
})
export class UsersModule {}
```

### Dependency Injection (CRITICAL)

```typescript
// CORRECT - Constructor injection
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly cacheManager: Cache,
  ) {}
}

// WRONG - Don't use @Inject() for class providers
constructor(@Inject(UsersRepository) repo: UsersRepository) {}

// OK - Use @Inject() only for non-class tokens
constructor(@Inject('CONFIG') config: AppConfig) {}
```

### Controller Pattern (HIGH)

```typescript
@Controller('users')
@ApiTags('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID' })
  @ApiResponse({ status: 200, type: UserResponseDto })
  async findOne(@Param('id', ParseUUIDPipe) id: string): Promise<UserResponseDto> {
    return this.usersService.findOne(id);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    return this.usersService.create(dto);
  }
}
```

### Service Pattern (HIGH)

```typescript
@Injectable()
export class UsersService {
  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.usersRepository.create(dto);
    
    // Emit domain event
    this.eventEmitter.emit('user.created', new UserCreatedEvent(user));
    
    return user;
  }

  async findOne(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
```

### Repository Pattern (HIGH)

```typescript
@Injectable()
export class UsersRepository {
  constructor(
    @InjectRepository(User)
    private readonly repo: Repository<User>,
  ) {}

  async findById(id: string): Promise<User | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(dto: CreateUserDto): Promise<User> {
    const user = this.repo.create(dto);
    return this.repo.save(user);
  }
}
```

## Validation (CRITICAL)

### DTOs with class-validator

```typescript
export class CreateUserDto {
  @IsEmail()
  @ApiProperty({ example: 'user@example.com' })
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d)/, {
    message: 'Password must contain letters and numbers',
  })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}

// Enable validation globally in main.ts
app.useGlobalPipes(new ValidationPipe({
  whitelist: true,           // Strip non-whitelisted properties
  forbidNonWhitelisted: true, // Throw on extra properties
  transform: true,           // Auto-transform to DTO instances
}));
```

## Error Handling (CRITICAL)

### Global Exception Filter

```typescript
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    
    let status = 500;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message = typeof res === 'string' ? res : (res as any).message;
      code = (res as any).code || 'HTTP_ERROR';
    }

    response.status(status).json({
      success: false,
      error: { code, message },
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Custom Exceptions

```typescript
export class BusinessException extends HttpException {
  constructor(message: string, code: string, status: number = 400) {
    super({ message, code }, status);
  }
}

// Usage
throw new BusinessException('Insufficient balance', 'INSUFFICIENT_BALANCE', 422);
```

## Authentication & Authorization (CRITICAL)

### JWT Guard

```typescript
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw new UnauthorizedException('Invalid or expired token');
    }
    return user;
  }
}
```

### Role-Based Access

```typescript
// roles.decorator.ts
export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

// roles.guard.ts
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>('roles', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles) return true;
    
    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}

// Usage
@Post()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
async createAdmin(@Body() dto: CreateUserDto) {}
```

## Caching (HIGH)

```typescript
@Injectable()
export class UsersService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async findOne(id: string): Promise<User> {
    const cacheKey = `user:${id}`;
    
    // Check cache first
    const cached = await this.cacheManager.get<User>(cacheKey);
    if (cached) return cached;
    
    // Fetch from DB
    const user = await this.usersRepository.findById(id);
    if (user) {
      await this.cacheManager.set(cacheKey, user, 3600000); // 1 hour
    }
    
    return user;
  }
}
```

## Queue / Background Jobs (HIGH)

```typescript
// email.processor.ts
@Processor('email')
export class EmailProcessor {
  @Process('send-welcome')
  async handleWelcomeEmail(job: Job<{ email: string; name: string }>) {
    await this.mailService.sendWelcome(job.data.email, job.data.name);
  }
}

// Usage in service
@Injectable()
export class UsersService {
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async create(dto: CreateUserDto): Promise<User> {
    const user = await this.usersRepository.create(dto);
    
    // Add job to queue
    await this.emailQueue.add('send-welcome', {
      email: user.email,
      name: user.name,
    });
    
    return user;
  }
}
```

## Configuration (HIGH)

```typescript
// config/database.config.ts
export default registerAs('database', () => ({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 5432,
  username: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
}));

// Usage
@Injectable()
export class DatabaseService {
  constructor(
    @Inject(databaseConfig.KEY)
    private dbConfig: ConfigType<typeof databaseConfig>,
  ) {
    console.log(this.dbConfig.host);
  }
}
```

## Testing (HIGH)

```typescript
describe('UsersService', () => {
  let service: UsersService;
  let repository: MockType<UsersRepository>;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: UsersRepository,
          useFactory: () => ({
            findById: jest.fn(),
            create: jest.fn(),
          }),
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(UsersRepository);
  });

  it('should return user when found', async () => {
    const mockUser = { id: '1', email: 'test@test.com' };
    repository.findById.mockResolvedValue(mockUser);

    const result = await service.findOne('1');

    expect(result).toEqual(mockUser);
    expect(repository.findById).toHaveBeenCalledWith('1');
  });

  it('should throw NotFoundException when user not found', async () => {
    repository.findById.mockResolvedValue(null);

    await expect(service.findOne('1')).rejects.toThrow(NotFoundException);
  });
});
```

## Microservices (MEDIUM)

```typescript
// TCP Microservice
const app = await NestFactory.createMicroservice<MicroserviceOptions>(
  AppModule,
  {
    transport: Transport.TCP,
    options: { host: '0.0.0.0', port: 3001 },
  },
);

// Message patterns
@MessagePattern({ cmd: 'get_user' })
async getUser(@Payload() data: { id: string }) {
  return this.usersService.findOne(data.id);
}

// Client usage
@Injectable()
export class OrdersService {
  constructor(@Inject('USERS_SERVICE') private usersClient: ClientProxy) {}

  async createOrder(userId: string) {
    const user = await firstValueFrom(
      this.usersClient.send({ cmd: 'get_user' }, { id: userId })
    );
  }
}
```

## Impact Levels

| Level | Description |
|-------|-------------|
| **CRITICAL** | Must follow - security, data integrity |
| **HIGH** | Should follow - maintainability, performance |
| **MEDIUM** | Recommended - code quality |

---


## nodejs-backend

> Version: 1.0.0

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

---


## react-frontend

> Version: 1.0.0

# React Frontend Development

Build modern React applications with best practices.

## Impact Levels

| Level | Description |
|-------|-------------|
| **CRITICAL** | Must follow - security, data integrity |
| **HIGH** | Should follow - maintainability, performance |
| **MEDIUM** | Recommended - code quality |

## Framework Selection (HIGH)

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

### State Management (Zustand) (HIGH)

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

### Data Fetching (TanStack Query) (HIGH)

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

### API Client (Axios) (CRITICAL)

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

### Form Handling (HIGH)

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

### Component Pattern (MEDIUM)

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

## Testing (HIGH)

- Unit tests with Vitest + Testing Library
- E2E tests with Playwright
- Test user interactions, not implementation details

---


## react-native-mobile

> Version: 1.0.0

# React Native Mobile Development

Build cross-platform mobile apps with React Native.

## Impact Levels

| Level | Description |
|-------|-------------|
| **CRITICAL** | Must follow - security, performance |
| **HIGH** | Should follow - maintainability, UX |
| **MEDIUM** | Recommended - code quality |

## Framework Selection (HIGH)

| Use Case | Framework |
|----------|-----------|
| Most apps (95%), MVPs, quick iteration | Expo (managed) |
| Custom native modules, brownfield apps | React Native CLI |

## Tech Stack

- **UI**: NativeWind (Tailwind CSS)
- **Navigation**: React Navigation / Expo Router
- **State**: Zustand + TanStack Query
- **Storage**: MMKV / expo-secure-store
- **Forms**: react-hook-form + Zod
- **Animations**: react-native-reanimated

## Critical Rules

### 1. NO INLINE STYLES (CRITICAL)

```tsx
// FORBIDDEN
<View style={{flex: 1, padding: 16}}>
<View style={[styles.container, {marginTop: 10}]}>

// CORRECT - Use NativeWind
<View className="flex-1 p-4">
<View className="mt-2.5">
```

### 2. Use Shared Components (CRITICAL)

```tsx
// CORRECT
import { Text } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

// WRONG - Don't import Text from react-native
import { Text } from 'react-native';
```

## Project Structure (Expo Router)

```
app/
├── (tabs)/              # Tab navigator
│   ├── _layout.tsx
│   ├── index.tsx        # Home
│   └── profile.tsx
├── (auth)/              # Auth stack
│   ├── _layout.tsx
│   ├── login.tsx
│   └── register.tsx
├── _layout.tsx          # Root layout
└── +not-found.tsx

components/
├── ui/                  # Shared UI
└── features/            # Feature-specific

stores/                  # Zustand stores
lib/                     # API, utils
```

## Patterns

### Navigation (Expo Router) (HIGH)

```tsx
// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="(auth)" />
    </Stack>
  );
}

// app/(tabs)/_layout.tsx
import { Tabs } from 'expo-router';
import { Home, User } from 'lucide-react-native';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen 
        name="index" 
        options={{ 
          title: 'Home',
          tabBarIcon: ({ color }) => <Home color={color} />
        }} 
      />
    </Tabs>
  );
}
```

### State Management (HIGH)

```typescript
// stores/auth-store.ts
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      logout: () => set({ token: null, user: null }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
```

### API Client

```typescript
// lib/api.ts
import axios from 'axios';
import Constants from 'expo-constants';
import { useAuthStore } from '@/stores/auth-store';

const API_URL = Constants.expoConfig?.extra?.apiUrl;

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

### Secure Storage (CRITICAL)

```typescript
import * as SecureStore from 'expo-secure-store';

export const secureStorage = {
  async get(key: string): Promise<string | null> {
    return SecureStore.getItemAsync(key);
  },
  async set(key: string, value: string): Promise<void> {
    await SecureStore.setItemAsync(key, value);
  },
  async remove(key: string): Promise<void> {
    await SecureStore.deleteItemAsync(key);
  },
};
```

### UI Components

```tsx
// components/ui/Button.tsx
import { TouchableOpacity, Text, View } from 'react-native';
import { cn } from '@/lib/utils';

interface ButtonProps {
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  children: React.ReactNode;
  className?: string;
}

export function Button({ 
  onPress, 
  variant = 'primary', 
  children,
  className 
}: ButtonProps) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className={cn(
        'py-3 px-6 rounded-lg items-center',
        variant === 'primary' && 'bg-primary',
        variant === 'secondary' && 'border border-primary bg-transparent',
        className
      )}
    >
      {children}
    </TouchableOpacity>
  );
}
```

## Performance (HIGH)

- Use `FlatList` for long lists (not ScrollView)
- Use `useMemo` for expensive calculations
- Use `expo-image` or `FastImage` for images
- Use `react-native-reanimated` for 60fps animations
- Avoid re-renders with `memo()` for heavy components

## EAS Build & Submit

```bash
# Install
npm install -g eas-cli

# Build
eas build --platform ios --profile production
eas build --platform android --profile production

# Submit
eas submit --platform ios
eas submit --platform android
```

## Testing

- Jest + React Native Testing Library
- Detox for E2E
- Test user flows, not implementation

---


## tdd

> Version: 1.0.0

# Test-Driven Development

Write tests before code using the RED-GREEN-REFACTOR cycle.

## Impact Levels

| Level | Description |
|-------|-------------|
| **CRITICAL** | Must follow - test coverage |
| **HIGH** | Should follow - test quality |
| **MEDIUM** | Recommended - patterns |

## The TDD Cycle (CRITICAL)

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

## Test Structure (HIGH)

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

## What to Test (HIGH)

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

## Mocking (MEDIUM)

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

## Coverage Requirements (CRITICAL)

| Tier | Coverage |
|------|----------|
| Starter | 50% |
| Standard | 80% |
| Strict | 95% |

## Anti-Patterns to Avoid (HIGH)

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

---


## Impact Levels Reference

| Level | Description | Action |
|-------|-------------|--------|
| **CRITICAL** | Must follow | Blocks merge if violated |
| **HIGH** | Should follow | Fix before merge |
| **MAJOR** | Important issue | Address in this PR |
| **MEDIUM** | Recommended | Consider fixing |
| **MINOR** | Nice to have | Optional fix |
| **NIT** | Style preference | Author's choice |

---

*Generated on 2026-05-25 by compile-skills.js*
