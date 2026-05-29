# External AI Skills

> Curated list of AI skills that enhance your development workflow. Install these skills to teach AI agents specialized knowledge.

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
