# External AI Skills

> Curated list of AI skills that enhance your development workflow. Install these skills to teach AI agents specialized knowledge.

---

## Deployment & Infrastructure

### Vercel Skills

Official AI skills from [Vercel](https://vercel.com) for deployment, React best practices, and web optimization.

**Skills included:**
| Skill | Description |
|-------|-------------|
| `deploy-to-vercel` | Deployment workflows, CI/CD, preview URLs |
| `vercel-cli-with-tokens` | Vercel CLI usage with authentication |
| `vercel-optimize` | Performance optimization on Vercel platform |
| `react-best-practices` | React patterns and conventions |
| `react-view-transitions` | View Transitions API with React |
| `react-native-skills` | React Native development patterns |
| `web-design-guidelines` | Web design principles and accessibility |
| `composition-patterns` | Component composition patterns |

**Installation:**

```bash
# Universal (auto-detects agent)
npx skills add https://github.com/vercel-labs/agent-skills

# Specific skill only
npx skills add https://github.com/vercel-labs/agent-skills/skills/deploy-to-vercel
```

**Links:**
- Repository: https://github.com/vercel-labs/agent-skills
- Skills CLI: https://github.com/vercel-labs/skills

---

## UI Components

### shadcn/ui Skills

Official AI skills for [shadcn/ui](https://ui.shadcn.com) — the popular component library built on Radix UI and Tailwind CSS.

**Skills included:**
| Skill | Description |
|-------|-------------|
| `shadcn` | CLI usage, component installation, customization, theming |

**Installation:**

```bash
npx skills add https://github.com/shadcn-ui/ui
```

**Links:**
- Repository: https://github.com/shadcn-ui/ui
- Docs: https://ui.shadcn.com

---

## Backend-as-a-Service

### Supabase Skills

Official AI skills for [Supabase](https://supabase.com) — the open-source Firebase alternative.

**Skills included:**
| Skill | Description |
|-------|-------------|
| `studio-best-practices` | Supabase Studio patterns |
| `studio-ui-patterns` | UI component patterns |
| `studio-queries` | Database query patterns |
| `studio-testing` | Testing strategies |
| `studio-e2e-tests` | E2E test patterns |
| `studio-error-handling` | Error handling patterns |
| `studio-mock-api-tests` | Mock API testing |
| `safe-sql-execution` | Safe SQL execution |
| `telemetry-standards` | Telemetry best practices |
| `vitest` | Vitest configuration |

**Installation:**

```bash
npx skills add https://github.com/supabase/supabase
```

**Links:**
- Repository: https://github.com/supabase/supabase
- Docs: https://supabase.com/docs

---

## Animation

### GSAP Skills

Official AI skills for [GSAP](https://gsap.com) (GreenSock Animation Platform) — the industry-standard JavaScript animation library.

**Skills included:**
| Skill | Description |
|-------|-------------|
| `gsap-core` | Core API: `gsap.to()`, `from()`, `fromTo()`, easing, stagger |
| `gsap-timeline` | Timelines: sequencing, position parameter, labels, nesting |
| `gsap-scrolltrigger` | ScrollTrigger: scroll-linked animations, pinning, scrub |
| `gsap-plugins` | Plugins: Flip, Draggable, SplitText, MorphSVG, etc. |
| `gsap-react` | React: `useGSAP` hook, refs, cleanup, SSR |
| `gsap-performance` | Performance: transforms, will-change, batching |
| `gsap-frameworks` | Vue, Svelte: lifecycle, scoping, cleanup |
| `gsap-utils` | Utilities: clamp, mapRange, snap, toArray, etc. |

**Installation:**

```bash
# Universal (auto-detects agent)
npx skills add https://github.com/greensock/gsap-skills

# Specific agent
npx skills add https://github.com/greensock/gsap-skills --agent cursor
npx skills add https://github.com/greensock/gsap-skills --agent claude
npx skills add https://github.com/greensock/gsap-skills --agent antigravity
```

**Claude Code:**
```bash
/plugin marketplace add greensock/gsap-skills
```

**Cursor:**
Settings → Rules → Add Rule → Remote Rule (Github) → `greensock/gsap-skills`

**Manual:**
Clone and copy `skills/` folder to your agent's skill directory:
- Claude Code: `~/.claude/skills/`
- Cursor: `~/.cursor/skills/`
- Codex: `~/.codex/skills/`

**Links:**
- Repository: https://github.com/greensock/gsap-skills
- GSAP Docs: https://gsap.com/docs

---

## How to Add Skills

Most AI agents support the [Agent Skills](https://agentskills.io) format. Use the `skills` CLI:

```bash
# Install skills CLI
npm install -g skills

# Add a skill from GitHub
npx skills add <github-url>

# List installed skills
npx skills list

# Remove a skill
npx skills remove <skill-name>
```

---

## Suggest a Skill

Know a useful AI skill? Add it to this list by editing this file or opening an issue.

**Criteria for inclusion:**
- Open source with MIT/Apache license
- Follows Agent Skills format
- Actively maintained
- Provides clear value for developers
