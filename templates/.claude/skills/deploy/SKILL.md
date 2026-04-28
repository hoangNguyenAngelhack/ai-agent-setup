---
name: deploy
description: Skill to automate the full deployment process including build, test, and release steps
---

# Deploy Skill

## Purpose
Automate the deployment pipeline: build → test → deploy → verify.

## Prerequisites
- All tests passing
- Environment variables configured
- Access to deployment target

## Steps

### 1. Verify Clean State
```bash
git status
git pull origin main
```

### 2. Run Tests
```bash
npm test
```
If tests fail → STOP. Report failures.

### 3. Build
```bash
npm run build
```

### 4. Deploy by Environment

**Development:**
```bash
docker-compose -f docker-compose.dev.yml up -d --build
```

**Production:**
```bash
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml up -d
```

### 5. Health Check
```bash
curl -f http://localhost:3000/health || echo "Health check failed"
```

### 6. Tail Logs (first 30 seconds)
```bash
docker-compose logs --tail=50 -f app
```

## Rollback
```bash
git revert HEAD --no-edit
git push origin main
# Redeploy previous version
```

## Success Criteria
- Health endpoint returns 200
- No error logs in initial 30 seconds
- All smoke tests pass
