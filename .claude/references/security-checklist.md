# Security Checklist

> Quick reference for security review. See `.claude/rules/security.md` for full rules.

## Pre-Commit Checks

- [ ] No secrets in code (API keys, passwords, tokens)
- [ ] `.gitignore` excludes sensitive files (`.env`, credentials)
- [ ] `.env.example` contains only placeholder values
- [ ] No hardcoded URLs with credentials

## Authentication

- [ ] Passwords hashed with bcrypt (rounds >= 12) or argon2
- [ ] Session cookies: `httpOnly`, `secure`, `sameSite: 'lax'`
- [ ] JWT tokens have reasonable expiry (15min access, 7d refresh)
- [ ] Rate limiting on auth endpoints (max 10 attempts/15min)
- [ ] Logout invalidates session/token

## Authorization

- [ ] Every endpoint checks authentication
- [ ] Resource ownership verified (no IDOR)
- [ ] API keys are scoped appropriately
- [ ] JWT signature, expiration, and issuer validated
- [ ] Admin functions protected

## Input Validation

- [ ] All user input validated at system boundary
- [ ] Allowlist validation preferred over blocklist
- [ ] String lengths constrained
- [ ] Numeric ranges validated
- [ ] File uploads restricted by type and size
- [ ] SQL queries parameterized (never string concat)

## Security Headers

```javascript
// Required headers
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Permissions-Policy: geolocation=(), camera=()
```

## CORS

- [ ] Restrictive origin allowlist (no `*` in production)
- [ ] Credentials mode appropriate
- [ ] Methods and headers restricted

## Data Protection

- [ ] Sensitive fields excluded from API responses
- [ ] No secrets in logs
- [ ] PII encrypted when required
- [ ] HTTPS enforced
- [ ] Database backups encrypted

## Dependencies

```bash
# Run regularly
npm audit
npm audit fix
```

- [ ] No critical vulnerabilities
- [ ] Dependencies up to date
- [ ] Lock file committed

## Error Handling

- [ ] Generic error messages in production
- [ ] No stack traces exposed
- [ ] No database details in errors
- [ ] No internal paths revealed

## OWASP Top 10 Quick Check

| # | Vulnerability | Check |
|---|--------------|-------|
| 1 | Broken Access Control | Auth on all endpoints? |
| 2 | Cryptographic Failures | Secrets encrypted? HTTPS? |
| 3 | Injection | Inputs sanitized? Queries parameterized? |
| 4 | Insecure Design | Threat modeling done? |
| 5 | Security Misconfiguration | Headers set? Defaults changed? |
| 6 | Vulnerable Components | `npm audit` clean? |
| 7 | Auth Failures | Rate limiting? Strong passwords? |
| 8 | Data Integrity | Signatures verified? |
| 9 | Logging Failures | Security events logged? |
| 10 | SSRF | External URLs validated? |
