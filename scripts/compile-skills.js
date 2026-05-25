#!/usr/bin/env node

/**
 * Compile all skills from .agents/skills/ into a single AGENTS.md file
 * Usage: node scripts/compile-skills.js
 */

const fs = require('fs');
const path = require('path');

const SKILLS_DIR = path.join(__dirname, '..', '.agents', 'skills');
const OUTPUT_FILE = path.join(__dirname, '..', 'AGENTS.md');

function parseSkillFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');

  // Parse YAML frontmatter
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!frontmatterMatch) {
    return { metadata: {}, content };
  }

  const frontmatter = frontmatterMatch[1];
  const markdownContent = frontmatterMatch[2];

  // Simple YAML parsing
  const metadata = {};
  frontmatter.split('\n').forEach(line => {
    const match = line.match(/^(\w+):\s*(.+)$/);
    if (match) {
      metadata[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  });

  return { metadata, content: markdownContent };
}

function compileSkills() {
  const skills = [];

  // Read all skill directories
  const skillDirs = fs.readdirSync(SKILLS_DIR).filter(dir => {
    const stat = fs.statSync(path.join(SKILLS_DIR, dir));
    return stat.isDirectory();
  });

  for (const skillDir of skillDirs) {
    const skillFile = path.join(SKILLS_DIR, skillDir, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      const { metadata, content } = parseSkillFile(skillFile);
      skills.push({
        name: metadata.name || skillDir,
        description: metadata.description || '',
        version: metadata.version || '1.0.0',
        content: content.trim(),
      });
    }
  }

  // Sort skills alphabetically
  skills.sort((a, b) => a.name.localeCompare(b.name));

  // Generate AGENTS.md
  const output = `# Agent Skills

> Auto-generated from \`.agents/skills/\` — DO NOT EDIT MANUALLY
>
> Run \`node scripts/compile-skills.js\` to regenerate

## Table of Contents

${skills.map(s => `- [${s.name}](#${s.name})`).join('\n')}

## Skills Overview

| Skill | Description |
|-------|-------------|
${skills.map(s => `| **${s.name}** | ${s.description} |`).join('\n')}

---

${skills.map(s => `
## ${s.name}

> Version: ${s.version}

${s.content}

---
`).join('\n')}

## Impact Levels Reference

| Level | Description | Action |
|-------|-------------|--------|
| **CRITICAL** | Must follow | Blocks merge if violated |
| **HIGH** | Should follow | Fix before merge |
| **MAJOR** | Important issue | Address in this PR |
| **MEDIUM** | Recommended | Consider fixing |
| **MINOR** | Nice to have | Optional fix |
| **NIT** | Style preference | Author's choice |

---

*Generated on ${new Date().toISOString().split('T')[0]} by compile-skills.js*
`;

  fs.writeFileSync(OUTPUT_FILE, output);
  console.log(`✅ Compiled ${skills.length} skills into AGENTS.md`);
  console.log(`   Skills: ${skills.map(s => s.name).join(', ')}`);
}

compileSkills();
