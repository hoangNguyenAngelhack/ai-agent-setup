---
name: code-review
description: Perform five-axis code reviews covering correctness, readability, architecture, security, and performance. Use when reviewing PRs, code changes, or evaluating code quality.
license: MIT
metadata:
  author: angelhack
  version: "1.3.3"
---

# Five-Axis Code Review

Comprehensive code review framework for production-quality code.

## The Five Axes

### 1. Correctness

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

### 2. Readability

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

### 3. Architecture

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

### 4. Security

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

### 5. Performance

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
