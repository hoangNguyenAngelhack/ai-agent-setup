# How to Make Claude More Honest

> A guide to reducing hallucinations and improving accuracy in Claude's responses.

---

## Why This Matters

You ask Claude: *"What did Einstein say about creativity?"*

Claude confidently replies: *"Einstein once said: 'Creativity is intelligence having fun.'"*

Sounds inspiring. But here's the problem — **Einstein probably never said that**. It's a quote widely misattributed to him on the internet. Claude sometimes fabricates quotes, statistics, and sources to sound authoritative. It's not lying intentionally; it's pattern-matching what a "helpful answer" looks like.

This is called **hallucination**, and it's one of the biggest risks when using AI for research, writing, or decision-making.

The good news: you can significantly reduce this behavior with a simple configuration change.

---

## The Problem

AI models sometimes:
- Present uncertain information as fact
- Fabricate sources, statistics, or quotes
- Guess about recent events they don't have data on
- Sound confident when they shouldn't be

## The Solution

Add an **Honesty Prompt** to your Claude configuration. This instructs Claude to prioritize accuracy over confidence.

---

## Setup Options

### Option 1: Global (All Projects)

Create or edit `~/.claude/CLAUDE.md`:

```bash
mkdir -p ~/.claude
nano ~/.claude/CLAUDE.md
```

### Option 2: Per-Project

Create or edit `.claude/CLAUDE.md` in your project root:

```bash
mkdir -p .claude
nano .claude/CLAUDE.md
```

### Option 3: As a Separate Rule

Create `.claude/rules/honesty.md` for easier toggling:

```bash
mkdir -p .claude/rules
nano .claude/rules/honesty.md
```

---

## The Honesty Prompt

Copy this into your chosen file:

```markdown
## Honesty & Epistemic Humility

Prioritize accuracy over confidence. Be transparent about what you know, don't know, and are inferring.

### 1. Uncertainty
- If unsure, say so: "I'm not certain, but...", "You should verify this...", "Based on my current knowledge..."
- Don't present uncertain information as fact
- If context is missing, state what's needed
- If multiple possibilities exist, explain them

### 2. Sources
Never fabricate:
- Research papers, URLs, authors
- Statistics, studies, books
- Legal cases, quotes, company reports
- Historical references

If no verifiable source exists, say so. If relying on general knowledge, state that.

### 3. Statistics & Numbers
Flag any numbers, percentages, rankings, market sizes, or estimates you're not fully confident about. Don't invent data to seem helpful.

### 4. Recent Events
Don't guess about current events. For topics that may have changed recently (news, laws, product features, software versions, company leadership), note that information may be outdated and needs verification.

### 5. People & Quotes
Never attribute a statement to a real person unless certain they said it. Separate confirmed facts from inference.
```

---

## Before & After Examples

### Example 1: Statistics

**Without honesty prompt:**
> "React has 85% market share in frontend frameworks."

**With honesty prompt:**
> "React is one of the most popular frontend frameworks. I don't have exact current market share data — you should check recent surveys like State of JS for accurate numbers."

### Example 2: Sources

**Without honesty prompt:**
> "According to a 2023 study by Stanford University..."

**With honesty prompt:**
> "Based on general knowledge about this topic (I don't have a specific source to cite)..."

### Example 3: Recent Events

**Without honesty prompt:**
> "The latest version of Next.js is 15.2 with these features..."

**With honesty prompt:**
> "As of my knowledge cutoff, Next.js 14 was the latest major version. Check the official docs for the current version and features."

---

## When to Use This

| Use Case | Recommended |
|----------|-------------|
| Research & fact-finding | Yes |
| Writing documentation | Yes |
| Code generation | Optional (less relevant) |
| Creative writing | No (may over-hedge) |
| Quick coding tasks | No (slows down workflow) |

---

## Tips

1. **Global vs Local**: Use global (`~/.claude/CLAUDE.md`) if you want this behavior everywhere. Use per-project if you only need it for research-heavy work.

2. **Combine with other rules**: This prompt works alongside coding standards, tech stack rules, etc.

3. **Adjust as needed**: If Claude becomes too hesitant, you can soften the language or move it to a toggleable rule file.

---

## Verification

After setup, test with questions like:
- "What's the current market share of TypeScript?"
- "Quote what Elon Musk said about AI last week"
- "What's the exact salary for senior engineers at Google?"

Claude should now hedge appropriately instead of inventing answers.
