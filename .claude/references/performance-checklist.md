# Performance Checklist

> Quick reference for performance optimization.

## Core Web Vitals Targets

| Metric | Good | Needs Work | Poor |
|--------|------|------------|------|
| **LCP** (Largest Contentful Paint) | < 2.5s | 2.5-4s | > 4s |
| **INP** (Interaction to Next Paint) | < 200ms | 200-500ms | > 500ms |
| **CLS** (Cumulative Layout Shift) | < 0.1 | 0.1-0.25 | > 0.25 |

## Frontend Performance

### Critical Render Path
- [ ] Minimize critical CSS (inline above-fold styles)
- [ ] Defer non-critical JavaScript
- [ ] Preload critical resources
- [ ] Optimize font loading (font-display: swap)

### Images
- [ ] Use modern formats (WebP, AVIF)
- [ ] Implement lazy loading
- [ ] Serve responsive sizes (srcset)
- [ ] Use CDN for static assets
- [ ] Set explicit width/height (prevent CLS)

### JavaScript
- [ ] Code splitting (dynamic imports)
- [ ] Tree shaking enabled
- [ ] Bundle size monitored (< 200KB initial)
- [ ] No unused dependencies

### React Specific
- [ ] Memoize expensive computations (useMemo)
- [ ] Prevent unnecessary re-renders (React.memo)
- [ ] Virtualize long lists (react-window)
- [ ] Use Suspense for code splitting

```javascript
// ✅ Good: Memoized component
const ExpensiveList = React.memo(({ items }) => {
  return items.map(item => <Item key={item.id} {...item} />);
});

// ✅ Good: Memoized computation
const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);
```

## Backend Performance

### Database
- [ ] Indexes on queried columns
- [ ] No N+1 queries
- [ ] Pagination implemented
- [ ] Connection pooling configured
- [ ] Query timeouts set

```javascript
// ❌ N+1 Problem
const users = await db.user.findMany();
for (const user of users) {
  user.orders = await db.order.findMany({ where: { userId: user.id } });
}

// ✅ Fixed: Include relation
const users = await db.user.findMany({
  include: { orders: true }
});
```

### Caching
- [ ] Cache frequently accessed data
- [ ] Appropriate TTLs set
- [ ] Cache invalidation strategy
- [ ] CDN for static content

```javascript
// Cache pattern
async function getUser(id) {
  const cached = await redis.get(`user:${id}`);
  if (cached) return JSON.parse(cached);
  
  const user = await db.user.findUnique({ where: { id } });
  await redis.setex(`user:${id}`, 3600, JSON.stringify(user));
  return user;
}
```

### API
- [ ] Response compression (gzip/brotli)
- [ ] Pagination for lists
- [ ] Field selection (select only needed)
- [ ] Async operations for slow tasks

```javascript
// ✅ Good: Paginated API
GET /api/users?page=1&limit=20&fields=id,name,email
```

## Measurement Commands

```bash
# Lighthouse (Chrome)
npx lighthouse https://example.com --output=json

# Bundle analysis
npx webpack-bundle-analyzer stats.json

# Check bundle size
npx bundlephobia <package-name>

# Database query analysis
EXPLAIN ANALYZE SELECT * FROM users WHERE email = '...';

# Redis latency
redis-cli --latency

# API response time
curl -o /dev/null -s -w '%{time_total}\n' https://api.example.com/users
```

## Performance Budget

| Resource | Budget |
|----------|--------|
| Initial JS | < 200KB |
| Initial CSS | < 50KB |
| Total page weight | < 1MB |
| Time to Interactive | < 3s |
| API response (p95) | < 200ms |

## Monitoring

- [ ] Real User Monitoring (RUM) enabled
- [ ] Synthetic monitoring configured
- [ ] Alerting on degradation
- [ ] Performance tracked in CI

```javascript
// Example: Track Core Web Vitals
import { onLCP, onINP, onCLS } from 'web-vitals';

onLCP(metric => sendToAnalytics('LCP', metric.value));
onINP(metric => sendToAnalytics('INP', metric.value));
onCLS(metric => sendToAnalytics('CLS', metric.value));
```
