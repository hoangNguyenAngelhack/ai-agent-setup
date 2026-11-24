# Deployment Workflow

> Quy trình CI/CD hoàn chỉnh từ development đến production.

---

## Architecture Overview

```
┌─────────────┐     push      ┌──────────────────────────────────────────────────────────┐
│   LOCAL     │ ────────────► │                      GITHUB                              │
│             │               │                                                          │
│ Dev         │               │  dev branch                                              │
│ Claude Code │               │      │                                                   │
│ + IDE       │               │      ▼ PR (dev → main)                                   │
│             │               │  ┌─────────────────┐                                     │
└─────────────┘               │  │ ci.yml — PR gate│                                     │
                              │  │ ✅ Test Backend  │                                     │
                              │  │ ✅ Test Frontend │                                     │
                              │  └────────┬────────┘                                     │
                              │           │ must pass                                    │
                              │           ▼                                              │
                              │  ┌─────────────────────┐                                 │
                              │  │ Branch Protection   │                                 │
                              │  │ ✅ Require PR        │                                 │
                              │  │ ✅ CI must pass      │                                 │
                              │  │ ✅ No force push     │                                 │
                              │  │ ✅ Enforce admins    │                                 │
                              │  └────────┬────────────┘                                 │
                              │           │ merge                                        │
                              │           ▼                                              │
                              │      main branch ─────────────────────────────────────►  │
                              └──────────────────────────────────────────────────────────┘
                                                                      │
                              ┌────────────────────────────────────────┘
                              ▼
                    ┌─────────────────────────────────┐
                    │  deploy.yml — triggers on main  │
                    │                                 │
                    │  ① Version: v1.21.6 (auto)      │  ✅
                    │  ② Test Backend                 │  ✅
                    │  ③ Test Frontend                │  ✅
                    │  ④ Build Backend → GHCR         │  ✅
                    │  ⑤ Build Frontend → GHCR        │  ✅
                    │  ⑥ Git Tag v1.21.6              │  ✅
                    │  ⑦ Deploy VPS (pull + up)       │  ✅
                    │  ⑧ Telegram notify              │  ✅
                    └─────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼ push images     │                 ▼ git tag
┌───────────────────────────────────────────────────────────────────────────────┐
│                            GHCR REGISTRY                                      │
│                                                                               │
│  ┌─────────────────────────────────────┐  ┌─────────────────────────────────┐ │
│  │ runway-backend                      │  │ runway-frontend                 │ │
│  │ v1.21.6 ✅  v1.21.5  v1.21.4  latest │  │ v1.21.6 ✅  v1.21.5  v1.21.4    │ │
│  └─────────────────────────────────────┘  └─────────────────────────────────┘ │
│                                                                               │
│  Rollback (30s): TAG=v1.21.5 docker compose up -d                             │
└───────────────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ docker pull v1.21.6
┌───────────────────────────────────────────────────────────────────────────────┐
│                                 VPS                                           │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Nginx (SSL)                                                             │  │
│  │ domain1 → :8000    domain2 → :3001    domain3 → :3000    domain4 → :5678│  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Docker Containers                                                       │  │
│  │ runway-backend:v1.21.6 ✅   runway-worker:v1.21.6 ✅   n8n:latest ✅      │  │
│  │ runway-frontend:v1.21.6 ✅  postgres:15 ✅                                │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │ Systemd                                                                 │  │
│  │ Redis (127.0.0.1 + 172.17.0.1) ✅    Marketing Next.js :3000 ✅          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Local Development

### Setup
```bash
# Clone repository
git clone git@github.com:org/project.git
cd project

# Install dependencies
npm install

# Setup environment
cp .env.example .env

# Start development
npm run dev
```

### Development Flow
1. Checkout từ `main` hoặc `dev` branch
2. Tạo feature branch: `feature/add-user-auth`
3. Code + test locally
4. Push lên GitHub

```bash
git checkout -b feature/add-user-auth
# ... coding ...
git add .
git commit -m "feat(auth): add JWT authentication"
git push origin feature/add-user-auth
```

---

## 2. GitHub CI/CD

### 2.1 Branch Strategy

| Branch | Purpose | Protection |
|--------|---------|------------|
| `main` | Production code | Full protection |
| `dev` | Integration branch | PR required |
| `feature/*` | New features | None |
| `fix/*` | Bug fixes | None |
| `hotfix/*` | Urgent fixes | Direct to main via PR |

### 2.2 Branch Protection Rules (main)

```yaml
# Settings → Branches → Branch protection rules

✅ Require a pull request before merging
  ✅ Require approvals (1+)
  ✅ Dismiss stale pull request approvals when new commits are pushed

✅ Require status checks to pass before merging
  ✅ Require branches to be up to date before merging
  - test-backend (required)
  - test-frontend (required)

✅ Do not allow force pushes

✅ Do not allow deletions

✅ Include administrators
```

### 2.3 CI Workflow (ci.yml)

```yaml
# .github/workflows/ci.yml
name: CI

on:
  pull_request:
    branches: [main, dev]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: backend

      - name: Run linter
        run: npm run lint
        working-directory: backend

      - name: Run tests
        run: npm test -- --coverage
        working-directory: backend

      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          directory: backend/coverage

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci
        working-directory: frontend

      - name: Run linter
        run: npm run lint
        working-directory: frontend

      - name: Run tests
        run: npm test -- --coverage
        working-directory: frontend

      - name: Build check
        run: npm run build
        working-directory: frontend
```

### 2.4 Deploy Workflow (deploy.yml)

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

env:
  REGISTRY: ghcr.io
  BACKEND_IMAGE: ghcr.io/${{ github.repository }}/runway-backend
  FRONTEND_IMAGE: ghcr.io/${{ github.repository }}/runway-frontend

jobs:
  # ① Auto Version
  version:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - name: Get next version
        id: version
        run: |
          # Get latest tag
          LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "v1.0.0")
          
          # Increment patch version
          VERSION=$(echo $LATEST_TAG | awk -F. '{print $1"."$2"."$3+1}')
          echo "version=$VERSION" >> $GITHUB_OUTPUT
          echo "📦 Version: $VERSION"

  # ② Test Backend
  test-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: backend/package-lock.json
      - run: npm ci
        working-directory: backend
      - run: npm test
        working-directory: backend

  # ③ Test Frontend
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json
      - run: npm ci
        working-directory: frontend
      - run: npm test
        working-directory: frontend

  # ④ Build Backend → GHCR
  build-backend:
    needs: [version, test-backend]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./backend
          push: true
          tags: |
            ${{ env.BACKEND_IMAGE }}:${{ needs.version.outputs.version }}
            ${{ env.BACKEND_IMAGE }}:latest
          cache-from: type=registry,ref=${{ env.BACKEND_IMAGE }}:buildcache
          cache-to: type=registry,ref=${{ env.BACKEND_IMAGE }}:buildcache,mode=max

  # ⑤ Build Frontend → GHCR
  build-frontend:
    needs: [version, test-frontend]
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Login to GHCR
        uses: docker/login-action@v3
        with:
          registry: ${{ env.REGISTRY }}
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}

      - name: Build and push
        uses: docker/build-push-action@v5
        with:
          context: ./frontend
          push: true
          tags: |
            ${{ env.FRONTEND_IMAGE }}:${{ needs.version.outputs.version }}
            ${{ env.FRONTEND_IMAGE }}:latest
          build-args: |
            NEXT_PUBLIC_API_URL=${{ vars.NEXT_PUBLIC_API_URL }}
          cache-from: type=registry,ref=${{ env.FRONTEND_IMAGE }}:buildcache
          cache-to: type=registry,ref=${{ env.FRONTEND_IMAGE }}:buildcache,mode=max

  # ⑥ Git Tag
  tag:
    needs: [version, build-backend, build-frontend]
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4

      - name: Create and push tag
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git tag -a ${{ needs.version.outputs.version }} -m "Release ${{ needs.version.outputs.version }}"
          git push origin ${{ needs.version.outputs.version }}

  # ⑦ Deploy VPS
  deploy:
    needs: [version, build-backend, build-frontend, tag]
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to VPS via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.VPS_HOST }}
          username: ${{ secrets.VPS_USER }}
          key: ${{ secrets.VPS_SSH_KEY }}
          script: |
            cd /opt/app
            
            # Login to GHCR
            echo ${{ secrets.GHCR_TOKEN }} | docker login ghcr.io -u ${{ github.actor }} --password-stdin
            
            # Pull new images
            export TAG=${{ needs.version.outputs.version }}
            docker compose pull
            
            # Deploy with zero-downtime
            docker compose up -d --remove-orphans
            
            # Cleanup old images
            docker image prune -f
            
            # Health check
            sleep 10
            curl -f http://localhost:8000/health || exit 1

  # ⑧ Telegram Notify
  notify:
    needs: [version, deploy]
    runs-on: ubuntu-latest
    if: always()
    steps:
      - name: Send Telegram notification
        uses: appleboy/telegram-action@master
        with:
          to: ${{ secrets.TELEGRAM_CHAT_ID }}
          token: ${{ secrets.TELEGRAM_BOT_TOKEN }}
          format: markdown
          message: |
            ${{ needs.deploy.result == 'success' && '✅' || '❌' }} *Deploy ${{ needs.version.outputs.version }}*
            
            Repository: `${{ github.repository }}`
            Branch: `${{ github.ref_name }}`
            Commit: `${{ github.sha }}`
            
            Status: *${{ needs.deploy.result }}*
            
            [View Action](${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }})
```

---

## 3. GHCR Registry

### Image Naming Convention
```
ghcr.io/{owner}/{repo}/{service}:{version}

# Examples
ghcr.io/myorg/myproject/runway-backend:v1.21.6
ghcr.io/myorg/myproject/runway-frontend:v1.21.6
ghcr.io/myorg/myproject/runway-worker:v1.21.6
```

### Image Tags
| Tag | Description |
|-----|-------------|
| `v1.21.6` | Specific version (immutable) |
| `latest` | Latest stable release |
| `main` | Latest from main branch |

### Manual Rollback (30 seconds)
```bash
# SSH vào VPS
ssh user@vps

# Rollback to previous version
cd /opt/app
export TAG=v1.21.5
docker compose up -d

# Verify rollback
docker ps
curl http://localhost:8000/health
```

---

## 4. VPS Infrastructure

### 4.1 Directory Structure
```
/opt/app/
├── docker-compose.yml
├── .env
├── nginx/
│   ├── nginx.conf
│   └── conf.d/
│       ├── backend.conf
│       ├── frontend.conf
│       └── n8n.conf
├── data/
│   ├── postgres/
│   └── redis/
└── logs/
```

### 4.2 Docker Compose
```yaml
# docker-compose.yml
version: '3.8'

services:
  backend:
    image: ghcr.io/myorg/myproject/runway-backend:${TAG:-latest}
    container_name: runway-backend
    restart: unless-stopped
    ports:
      - "8000:8000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - postgres
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  worker:
    image: ghcr.io/myorg/myproject/runway-backend:${TAG:-latest}
    container_name: runway-worker
    restart: unless-stopped
    command: ["npm", "run", "worker"]
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
    depends_on:
      - backend
      - redis

  frontend:
    image: ghcr.io/myorg/myproject/runway-frontend:${TAG:-latest}
    container_name: runway-frontend
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production

  postgres:
    image: postgres:15
    container_name: postgres
    restart: unless-stopped
    volumes:
      - ./data/postgres:/var/lib/postgresql/data
    environment:
      - POSTGRES_USER=${DB_USER}
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=${DB_NAME}
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${DB_USER}"]
      interval: 10s
      timeout: 5s
      retries: 5

  n8n:
    image: n8nio/n8n:latest
    container_name: n8n
    restart: unless-stopped
    ports:
      - "5678:5678"
    volumes:
      - ./data/n8n:/home/node/.n8n
    environment:
      - N8N_HOST=${N8N_HOST}
      - N8N_PROTOCOL=https
      - WEBHOOK_URL=${N8N_WEBHOOK_URL}
```

### 4.3 Nginx Configuration
```nginx
# /etc/nginx/conf.d/backend.conf
upstream backend {
    server 127.0.0.1:8000;
    keepalive 32;
}

server {
    listen 443 ssl http2;
    server_name api.example.com;

    ssl_certificate /etc/letsencrypt/live/api.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.example.com/privkey.pem;

    location / {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 4.4 Systemd Services

#### Redis Service
```ini
# /etc/systemd/system/redis.service
[Unit]
Description=Redis In-Memory Data Store
After=network.target

[Service]
User=redis
Group=redis
ExecStart=/usr/bin/redis-server /etc/redis/redis.conf
ExecStop=/usr/bin/redis-cli shutdown
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

#### Marketing Next.js Service
```ini
# /etc/systemd/system/marketing.service
[Unit]
Description=Marketing Next.js App
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/marketing
ExecStart=/usr/bin/npm start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
```

### 4.5 Port Mapping

| Domain | Internal Port | Service |
|--------|---------------|---------|
| api.example.com | :8000 | Backend API |
| app.example.com | :3000 | Frontend App |
| admin.example.com | :3001 | Admin Dashboard |
| n8n.example.com | :5678 | n8n Automation |

---

## 5. Monitoring & Health Checks

### Health Endpoints
```bash
# Backend health
curl https://api.example.com/health

# Response
{
  "status": "healthy",
  "version": "v1.21.6",
  "uptime": "2d 5h 30m",
  "checks": {
    "database": "ok",
    "redis": "ok",
    "queue": "ok"
  }
}
```

### Docker Health Monitoring
```bash
# Check all containers
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Check logs
docker logs -f runway-backend --tail 100

# Resource usage
docker stats
```

### Useful Commands
```bash
# View deployment logs
docker compose logs -f

# Restart specific service
docker compose restart backend

# Scale workers
docker compose up -d --scale worker=3

# Enter container
docker exec -it runway-backend sh
```

---

## 6. Troubleshooting

### Deploy Failed
```bash
# 1. Check GitHub Actions logs
# 2. SSH to VPS and check manually
ssh user@vps
cd /opt/app
docker compose logs backend --tail 50

# 3. Manual deploy
docker compose pull
docker compose up -d
```

### Rollback Steps
```bash
# 1. Find previous working version
git tag -l | tail -5

# 2. Deploy previous version
export TAG=v1.21.5
docker compose up -d

# 3. Verify
curl https://api.example.com/health
```

### Database Migration Failed
```bash
# 1. Check migration status
docker exec runway-backend npx prisma migrate status

# 2. Manual migration
docker exec runway-backend npx prisma migrate deploy

# 3. If needed, rollback migration
docker exec runway-backend npx prisma migrate resolve --rolled-back <migration_name>
```

---

## 7. Security Checklist

- [ ] SSH key authentication only (no password)
- [ ] Firewall configured (ufw/iptables)
- [ ] SSL certificates auto-renewed (certbot)
- [ ] Docker socket not exposed
- [ ] Environment variables secured
- [ ] GHCR token rotated periodically
- [ ] VPS SSH key stored in GitHub Secrets
- [ ] Database backups automated
- [ ] Logs rotated and monitored
