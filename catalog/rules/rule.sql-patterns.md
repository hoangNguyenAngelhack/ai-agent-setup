# SQL Patterns

> Best practices for SQL queries and database design with Prisma/PostgreSQL focus.

## Query Optimization

### Use Indexes Strategically

```sql
-- Index columns used in WHERE, JOIN, ORDER BY
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_created_at ON orders(created_at DESC);

-- Composite index for multi-column queries
CREATE INDEX idx_orders_user_status ON orders(user_id, status);
```

```prisma
// Prisma schema
model Order {
  id        Int      @id @default(autoincrement())
  userId    Int
  status    String
  createdAt DateTime @default(now())

  @@index([userId])
  @@index([userId, status])
  @@index([createdAt(sort: Desc)])
}
```

### Select Only Needed Columns

```sql
-- ❌ Bad - fetches all columns
SELECT * FROM users WHERE id = 1;

-- ✅ Good - only needed columns
SELECT id, email, name FROM users WHERE id = 1;
```

```typescript
// Prisma
// ❌ Bad
const user = await prisma.user.findUnique({ where: { id: 1 } });

// ✅ Good
const user = await prisma.user.findUnique({
  where: { id: 1 },
  select: { id: true, email: true, name: true },
});
```

---

## N+1 Query Prevention

### The Problem

```typescript
// ❌ N+1 Problem - 1 query for users + N queries for posts
const users = await prisma.user.findMany();
for (const user of users) {
  const posts = await prisma.post.findMany({
    where: { authorId: user.id },
  });
}
```

### Solutions

```typescript
// ✅ Solution 1: Include related data
const users = await prisma.user.findMany({
  include: { posts: true },
});

// ✅ Solution 2: Batch query
const users = await prisma.user.findMany();
const userIds = users.map(u => u.id);
const posts = await prisma.post.findMany({
  where: { authorId: { in: userIds } },
});

// ✅ Solution 3: Use joins (raw SQL)
const result = await prisma.$queryRaw`
  SELECT u.*, p.*
  FROM users u
  LEFT JOIN posts p ON p.author_id = u.id
  WHERE u.id IN (${userIds})
`;
```

---

## Pagination

### Offset-Based (Simple but Slow for Large Offsets)

```typescript
// ✅ OK for small datasets
const users = await prisma.user.findMany({
  skip: (page - 1) * pageSize,
  take: pageSize,
  orderBy: { createdAt: 'desc' },
});
```

### Cursor-Based (Recommended for Large Datasets)

```typescript
// ✅ Better for large datasets
const users = await prisma.user.findMany({
  take: pageSize,
  skip: cursor ? 1 : 0, // Skip the cursor itself
  cursor: cursor ? { id: cursor } : undefined,
  orderBy: { id: 'asc' },
});

const nextCursor = users.length === pageSize ? users[users.length - 1].id : null;
```

---

## Transaction Patterns

### Basic Transaction

```typescript
// ✅ Automatic transaction
const [order, payment] = await prisma.$transaction([
  prisma.order.create({ data: orderData }),
  prisma.payment.create({ data: paymentData }),
]);
```

### Interactive Transaction

```typescript
// ✅ Complex transaction with logic
const result = await prisma.$transaction(async (tx) => {
  const user = await tx.user.findUnique({ where: { id: userId } });
  
  if (!user || user.balance < amount) {
    throw new Error('Insufficient balance');
  }
  
  await tx.user.update({
    where: { id: userId },
    data: { balance: { decrement: amount } },
  });
  
  return tx.order.create({ data: orderData });
});
```

### Isolation Levels

```typescript
// ✅ Prevent race conditions
const result = await prisma.$transaction(
  async (tx) => {
    // Critical operation
  },
  {
    isolationLevel: 'Serializable',
    maxWait: 5000, // 5s max wait to acquire lock
    timeout: 10000, // 10s max execution time
  }
);
```

---

## Common Query Patterns

### Upsert (Insert or Update)

```typescript
// ✅ Create or update in one query
const user = await prisma.user.upsert({
  where: { email: 'test@example.com' },
  update: { name: 'Updated Name' },
  create: { email: 'test@example.com', name: 'New User' },
});
```

### Conditional Update

```typescript
// ✅ Update only if condition met
const updated = await prisma.order.updateMany({
  where: {
    id: orderId,
    status: 'PENDING', // Only update if still pending
  },
  data: { status: 'PROCESSING' },
});

if (updated.count === 0) {
  throw new Error('Order already processed');
}
```

### Soft Delete

```prisma
model User {
  id        Int       @id @default(autoincrement())
  email     String    @unique
  deletedAt DateTime?

  @@index([deletedAt])
}
```

```typescript
// ✅ Soft delete
await prisma.user.update({
  where: { id: userId },
  data: { deletedAt: new Date() },
});

// ✅ Query excluding deleted
const users = await prisma.user.findMany({
  where: { deletedAt: null },
});
```

### Aggregations

```typescript
// ✅ Count, sum, avg
const stats = await prisma.order.aggregate({
  where: { status: 'COMPLETED' },
  _count: true,
  _sum: { total: true },
  _avg: { total: true },
});

// ✅ Group by
const ordersByStatus = await prisma.order.groupBy({
  by: ['status'],
  _count: true,
  _sum: { total: true },
});
```

---

## Schema Design

### Primary Keys

```prisma
// ✅ Auto-increment for simple cases
model User {
  id Int @id @default(autoincrement())
}

// ✅ CUID for distributed systems
model User {
  id String @id @default(cuid())
}

// ✅ UUID for security (unpredictable)
model User {
  id String @id @default(uuid())
}
```

### Foreign Keys

```prisma
model Post {
  id       Int  @id @default(autoincrement())
  author   User @relation(fields: [authorId], references: [id], onDelete: Cascade)
  authorId Int

  @@index([authorId])
}
```

### Timestamps

```prisma
model User {
  id        Int      @id @default(autoincrement())
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}
```

---

## Anti-Patterns to Avoid

### Don't Store JSON When You Need Relations

```prisma
// ❌ Bad - querying/updating is hard
model User {
  id    Int  @id
  tags  Json // ["tag1", "tag2"]
}

// ✅ Good - proper relation
model User {
  id   Int       @id
  tags UserTag[]
}

model Tag {
  id    Int       @id
  name  String    @unique
  users UserTag[]
}

model UserTag {
  userId Int
  tagId  Int
  user   User @relation(fields: [userId], references: [id])
  tag    Tag  @relation(fields: [tagId], references: [id])

  @@id([userId, tagId])
}
```

### Don't Use SELECT * in Production

```sql
-- ❌ Bad
SELECT * FROM users;

-- ✅ Good
SELECT id, email, name FROM users;
```

### Don't Forget Limits

```sql
-- ❌ Bad - can return millions of rows
SELECT * FROM logs WHERE level = 'ERROR';

-- ✅ Good
SELECT * FROM logs WHERE level = 'ERROR' LIMIT 100;
```

### Don't Use LIKE with Leading Wildcard

```sql
-- ❌ Bad - cannot use index
SELECT * FROM users WHERE email LIKE '%@gmail.com';

-- ✅ Better - use index
SELECT * FROM users WHERE email LIKE 'john%';

-- ✅ Best - use full-text search for complex patterns
CREATE INDEX idx_users_email_gin ON users USING gin(email gin_trgm_ops);
```

---

## Performance Checklist

- [ ] Indexed all foreign keys
- [ ] Indexed frequently filtered columns
- [ ] Using cursor pagination for large datasets
- [ ] Using transactions for multi-step operations
- [ ] No N+1 queries (use include/join)
- [ ] Limited result sets (no unbounded queries)
- [ ] Selected only needed columns
- [ ] No leading wildcards in LIKE queries
