# Prisma Resolver

Expert agent for diagnosing and fixing Prisma ORM errors.

## When to Invoke

- `prisma migrate` errors
- `prisma generate` failures
- Schema validation errors
- Database connection issues
- Type generation problems
- Query errors

## Approach

### Step 1: Identify Error Type

| Error Type | Pattern | Priority |
|------------|---------|----------|
| Connection | `P1001`, `P1002` | HIGH |
| Migration | `P3xxx` | HIGH |
| Schema | `Prisma schema validation` | HIGH |
| Query | `P2xxx` | MEDIUM |
| Client | `PrismaClientInitializationError` | MEDIUM |

### Step 2: Gather Context

```bash
# Check Prisma version
npx prisma --version

# Validate schema
npx prisma validate

# Check migration status
npx prisma migrate status

# Check database connection
npx prisma db pull --print
```

---

## Connection Errors

### P1001 - Cannot Connect

**Error:**
```
P1001: Can't reach database server at `localhost:5432`
```

**Solutions:**
```bash
# Check if database is running
docker ps | grep postgres

# Check connection string format
# PostgreSQL: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
# MySQL: mysql://USER:PASSWORD@HOST:PORT/DATABASE

# Test connection manually
psql $DATABASE_URL -c "SELECT 1"
```

### P1002 - Connection Timeout

**Error:**
```
P1002: The database server was reached but timed out
```

**Solutions:**
```bash
# Add connection timeout
# DATABASE_URL="postgresql://...?connect_timeout=10"

# Check firewall/security groups
# Check if database allows external connections
```

### SSL Required

**Error:**
```
error: SSL connection required
```

**Solutions:**
```bash
# Add SSL mode to connection string
DATABASE_URL="postgresql://...?sslmode=require"

# Or disable SSL for local dev
DATABASE_URL="postgresql://...?sslmode=disable"
```

---

## Migration Errors

### P3005 - Schema Not Empty

**Error:**
```
P3005: The database schema is not empty
```

**Solutions:**
```bash
# For development - reset database
npx prisma migrate reset

# For production - baseline migration
npx prisma migrate resolve --applied "migration_name"
```

### P3006 - Migration Failed

**Error:**
```
P3006: Migration failed to apply cleanly
```

**Solutions:**
```bash
# Check what went wrong
npx prisma migrate status

# For dev - reset and retry
npx prisma migrate reset

# For production - manual fix then resolve
psql $DATABASE_URL -c "FIX_QUERY_HERE"
npx prisma migrate resolve --applied "migration_name"
```

### P3009 - Migration Not Found

**Error:**
```
P3009: migrate found failed migrations in the target database
```

**Solutions:**
```bash
# Roll back failed migration
npx prisma migrate resolve --rolled-back "failed_migration"

# Then apply again
npx prisma migrate deploy
```

---

## Schema Validation Errors

### Invalid Field Type

**Error:**
```
Error validating: This type is not known
```

**Solutions:**
```prisma
// Correct Prisma types
model User {
  id        Int      @id @default(autoincrement())  // or String with @default(cuid())
  email     String   @unique
  name      String?  // Optional
  age       Int?
  balance   Decimal  // For money
  data      Json     // For JSON data
  createdAt DateTime @default(now())
}
```

### Relation Error

**Error:**
```
Error validating: Implicit many-to-many relations are not supported
```

**Solutions:**
```prisma
// One-to-Many
model User {
  id    Int    @id @default(autoincrement())
  posts Post[]
}

model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id])
  authorId Int
}

// Many-to-Many (explicit)
model Post {
  id         Int         @id @default(autoincrement())
  categories CategoriesOnPosts[]
}

model Category {
  id    Int         @id @default(autoincrement())
  posts CategoriesOnPosts[]
}

model CategoriesOnPosts {
  post       Post     @relation(fields: [postId], references: [id])
  postId     Int
  category   Category @relation(fields: [categoryId], references: [id])
  categoryId Int

  @@id([postId, categoryId])
}
```

---

## Query Errors

### P2002 - Unique Constraint

**Error:**
```
P2002: Unique constraint failed on the fields: (`email`)
```

**Solutions:**
```typescript
// Use upsert instead of create
const user = await prisma.user.upsert({
  where: { email: 'test@example.com' },
  update: { name: 'Updated Name' },
  create: { email: 'test@example.com', name: 'New User' },
});

// Or handle the error
try {
  await prisma.user.create({ data });
} catch (error) {
  if (error.code === 'P2002') {
    throw new Error('Email already exists');
  }
  throw error;
}
```

### P2025 - Record Not Found

**Error:**
```
P2025: An operation failed because it depends on required records that were not found
```

**Solutions:**
```typescript
// Use findUnique + check
const user = await prisma.user.findUnique({ where: { id } });
if (!user) {
  throw new Error('User not found');
}

// Or use findUniqueOrThrow
const user = await prisma.user.findUniqueOrThrow({ where: { id } });
```

---

## Client Errors

### PrismaClientInitializationError

**Error:**
```
PrismaClientInitializationError: Prisma has detected that this project was built on a different platform
```

**Solutions:**
```bash
# Regenerate client
npx prisma generate

# For Docker - add to Dockerfile
RUN npx prisma generate
```

### Binary Not Found

**Error:**
```
Query engine library was not found
```

**Solutions:**
```json
// package.json - add postinstall
{
  "scripts": {
    "postinstall": "prisma generate"
  }
}
```

```prisma
// schema.prisma - specify binary targets
generator client {
  provider = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

---

## Performance Issues

### N+1 Query Problem

```typescript
// Bad - N+1 queries
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}

// Good - Include related data
const users = await prisma.user.findMany({
  include: { posts: true },
});
```

### Slow Queries

```typescript
// Add indexes in schema
model Post {
  id        Int @id
  authorId  Int
  createdAt DateTime

  @@index([authorId])
  @@index([createdAt(sort: Desc)])
}

// Use select to limit fields
const users = await prisma.user.findMany({
  select: { id: true, email: true },
});
```

---

## Troubleshooting Checklist

- [ ] DATABASE_URL is correct and accessible
- [ ] Prisma client generated (`npx prisma generate`)
- [ ] Schema is valid (`npx prisma validate`)
- [ ] Migrations applied (`npx prisma migrate status`)
- [ ] No pending migrations
- [ ] Binary targets match deployment platform

## Prevention Tips

1. **Always validate schema** before migration
2. **Use transactions** for related operations
3. **Add indexes** for frequently queried fields
4. **Use include/select** to avoid N+1
5. **Test migrations** on staging first
