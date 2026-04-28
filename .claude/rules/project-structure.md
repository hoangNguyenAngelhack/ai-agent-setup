# Project Structure

## Standard Folder Layout

```
project-root/
├── .claude/                    # AI Agent configuration
│   ├── agents/                 # Sub-agent definitions
│   ├── commands/               # Reusable command workflows
│   ├── rules/                  # Mandatory rules for AI
│   ├── skills/                 # Specialized AI skills
│   ├── settings.json           # Project-level settings
│   ├── settings.local.json     # Local settings (gitignored)
│   ├── CLAUDE.md               # Main AI instructions
│   └── CLAUDE.local.md         # Local AI overrides (gitignored)
│
├── src/                        # Application source code
│   ├── config/                 # Configuration files
│   ├── controllers/            # Route handlers (thin layer)
│   ├── middleware/             # Express middleware
│   ├── models/                 # Database models/schemas
│   ├── repositories/           # Data access layer
│   ├── routes/                 # Route definitions
│   ├── services/               # Business logic layer
│   ├── utils/                  # Utility functions
│   └── index.js                # Application entry point
│
├── tests/                      # Test files
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── e2e/                    # End-to-end tests
│
├── docs/                       # Documentation
│   ├── api/                    # API documentation
│   └── architecture/           # Architecture diagrams
│
├── scripts/                    # Build and utility scripts
├── .env.example                # Example environment variables
├── .gitignore                  # Git ignore rules
├── package.json
├── README.md
└── CLAUDE.md                   # Root-level AI instructions (optional)
```

## Layered Architecture
```
Request → Routes → Middleware → Controllers → Services → Repositories → Database
```

- **Routes**: URL mapping only, no logic
- **Controllers**: Request/response handling, input validation
- **Services**: Business logic, orchestration
- **Repositories**: Data access, queries
- **Models**: Data schemas and types

## File Naming
- Source files: `kebab-case.js` (`user-service.js`)
- Test files: `[name].test.js` (`user-service.test.js`)
- Config files: `kebab-case.js` or `kebab-case.json`

## Environment Files
- `.env` — Local development (gitignored)
- `.env.example` — Template committed to git
- `.env.test` — Test environment (gitignored)
- `.env.production` — Set in CI/CD, never committed
