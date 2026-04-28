# Contributing

Thanks for your interest in contributing to this project!

## Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/ai-agent-setup.git
   cd ai-agent-setup
   ```
3. Copy `.claude/` to your project to test changes

## Development Workflow

Follow the project's workflow:

```
/spec → /plan → /build → /test → /review → /deploy
```

## Making Changes

### For Rules (`.claude/rules/`)

1. Create a feature branch: `git checkout -b feature/update-rule-name`
2. Make your changes
3. Update `CHANGELOG.md` under `## [Unreleased]`
4. Test the rule in a real project
5. Submit a PR

### For Examples (`examples/`)

1. Ensure code follows all rules in `.claude/rules/`
2. Add tests if applicable
3. Update `examples/README.md` if adding new files

### For Agents/Commands/Skills

1. Follow existing file structure and naming
2. Document when to use the agent/command/skill
3. Add examples in the file

## Code Style

All code must follow:
- `.claude/rules/code-style.md` - Formatting
- `.claude/rules/clean-code.md` - Best practices
- `.claude/rules/naming-conventions.md` - Naming

## Commit Messages

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(rules): add new caching rule
fix(examples): correct import path in user-service
docs(readme): add examples section
chore: update dependencies
```

## Pull Request Process

1. Ensure all rules are followed
2. Update documentation if needed
3. Update `CHANGELOG.md`
4. Fill out the PR template completely
5. Wait for review (minimum 1 approval required)

## Tier System

When updating rules, consider the impact on different tiers:
- **Starter** - Relaxed requirements
- **Standard** - Default, production-ready
- **Strict** - Enterprise/regulated industries

See `.claude/rules/TIERS.md` for details.

## Questions?

Open an issue with the `question` label or email hoang.nguyen@angelhack.com.

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
