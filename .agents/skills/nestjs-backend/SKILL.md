---
name: nestjs-backend
description: Build production-ready NestJS backend APIs with TypeORM/Prisma, dependency injection, guards, and microservices patterns. Use when creating NestJS APIs, modules, services, controllers, or enterprise-grade backends.
license: MIT
metadata:
  author: angelhack
  version: "1.3.5"
compatibility: Requires Node.js 18+, NestJS 10+, TypeScript
---

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
