# Rule Tiers

Chọn tier phù hợp với project của bạn. Mặc định là **Standard**.

## Quick Reference

| Tier | Test Coverage | Code Review | Security | Use Case |
|------|---------------|-------------|----------|----------|
| **Starter** | 50% | Optional | Basic | MVP, prototypes, learning |
| **Standard** | 80% | Required | Full | Production apps |
| **Strict** | 95% | Required + 2 reviewers | Full + audit | Fintech, healthcare, enterprise |

---

## Starter Tier

> Dành cho: MVP, prototypes, hackathons, learning projects

### Rules Applied
| Rule | Requirement |
|------|-------------|
| `clean-code.md` | ✅ Required |
| `code-style.md` | ✅ Required |
| `error-handling.md` | ⚡ Basic only (AppError class) |
| `tech-stack.md` | ⚡ Flexible (can use alternatives) |
| `system-design.md` | ❌ Optional |
| `project-structure.md` | ⚡ Simplified |
| `api-conventions.md` | ⚡ Basic REST only |
| `naming-conventions.md` | ✅ Required |
| `database.md` | ⚡ Basic (no transactions required) |
| `security.md` | ⚡ Critical rules only |
| `monitoring.md` | ❌ Optional |
| `testing.md` | ⚡ 50% coverage minimum |
| `git-workflow.md` | ⚡ Simple (main + feature branches) |

### Relaxed Requirements
- Test coverage: **50%** minimum
- Code review: Optional (self-review OK)
- Documentation: README only
- Monitoring: Console logging OK
- CI/CD: Optional

---

## Standard Tier (Default)

> Dành cho: Production applications, team projects

### Rules Applied
| Rule | Requirement |
|------|-------------|
| `clean-code.md` | ✅ Required |
| `code-style.md` | ✅ Required |
| `error-handling.md` | ✅ Required |
| `tech-stack.md` | ✅ Required |
| `system-design.md` | ✅ Required |
| `project-structure.md` | ✅ Required |
| `api-conventions.md` | ✅ Required |
| `naming-conventions.md` | ✅ Required |
| `database.md` | ✅ Required |
| `security.md` | ✅ Required |
| `monitoring.md` | ✅ Required |
| `testing.md` | ✅ Required |
| `git-workflow.md` | ✅ Required |

### Requirements
- Test coverage: **80%** minimum
- Code review: 1 reviewer required
- Documentation: README + API docs
- Monitoring: Structured logging (Pino)
- CI/CD: Required (GitHub Actions)

---

## Strict Tier

> Dành cho: Fintech, healthcare, enterprise, regulated industries

### Rules Applied
All Standard rules **plus**:

| Additional Requirement | Description |
|------------------------|-------------|
| Test coverage | **95%** minimum |
| Code review | **2 reviewers** required |
| Security audit | Required before each release |
| Penetration testing | Quarterly |
| Dependency audit | Weekly `npm audit` |
| Secrets scanning | Pre-commit hooks |
| Audit logging | All data access logged |
| Data encryption | At rest and in transit |
| Backup verification | Monthly restore tests |

### Additional Rules
```
security.md additions:
- SOC 2 compliance checklist
- GDPR/CCPA data handling
- PCI DSS (if payment processing)
- HIPAA (if healthcare data)

monitoring.md additions:
- Real-time alerting (PagerDuty/Opsgenie)
- Distributed tracing (required)
- Error tracking (Sentry required)
- APM (Application Performance Monitoring)

testing.md additions:
- Mutation testing
- Load testing before release
- Chaos engineering (recommended)
```

---

## How to Set Tier

### Option 1: In CLAUDE.md
Add at the top of your `.claude/CLAUDE.md`:

```markdown
# Project Configuration
**Tier:** Starter | Standard | Strict
```

### Option 2: In settings.json
```json
{
  "tier": "standard"
}
```

### Option 3: Per-command override
```
/build --tier=starter
/review --tier=strict
```

---

## Tier Comparison Matrix

| Aspect | Starter | Standard | Strict |
|--------|---------|----------|--------|
| **Testing** | | | |
| Unit test coverage | 50% | 80% | 95% |
| Integration tests | Optional | Required | Required |
| E2E tests | Optional | Recommended | Required |
| Load testing | No | Optional | Required |
| **Code Quality** | | | |
| Code review | Self-review | 1 reviewer | 2 reviewers |
| Linting | Recommended | Required | Required + strict |
| Type safety | Optional | Required | Required + strict |
| **Security** | | | |
| Input validation | Basic | Full | Full + sanitization |
| Auth/authz | Basic | JWT + RBAC | JWT + RBAC + MFA |
| Secrets management | .env | .env + vault | Vault only |
| Security audit | No | Pre-release | Continuous |
| **Operations** | | | |
| Logging | Console | Structured | Structured + audit |
| Monitoring | Optional | Metrics | Metrics + APM + tracing |
| Alerting | No | Slack/email | PagerDuty + escalation |
| Backup | Optional | Daily | Hourly + verified |
| **Documentation** | | | |
| README | Required | Required | Required |
| API docs | Optional | Required | Required + examples |
| Architecture docs | No | Recommended | Required |
| Runbooks | No | Optional | Required |
