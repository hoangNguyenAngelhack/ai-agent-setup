# 14. Release notes: create-ai-agent-setup 2.0.0

> Released 2026-11-25 on the npm dist-tag `latest` (2.0.0-alpha.0 was on `next` the same day).
> Signed off by the maintainer ([13](13-release-checklist.md)). 1.x gets security fixes until
> 2027-05-25 (`npx create-ai-agent-setup@1`).

## Highlights

- **Generated, managed configuration.** The AI configuration comes from a catalog bundled with the
  package instead of a download from GitHub. It is installed as a transaction with a manifest, a
  diff before writing, backups and `rollback`. Files you changed are never overwritten: the new
  version is written next to them as `<file>.ai-agent-setup.new`.
- **Claude Code and Codex.** `--adapter claude-code` reproduces the V1 layout. `--adapter codex`
  writes `AGENTS.md`, `.agents/skills/` and `.codex/`.
- **Existing projects.** `setup` adds the configuration to a project. `diff` shows every change
  first, and `doctor` checks an installation. `update` brings an installation to a newer
  catalog and keeps its adapters and profile.
- **Planning and execution.** `plan`, `explain` and `impact` route a task to capabilities and agents,
  and say why. `run` delivers an approved plan to a host and verifies each step with quality gates.
  Approvals and events are signed per project.
- **Reports.** `gates` runs the quality gates. `report` summarises runs, gates and host token usage.
  `report --kpi` reports the KPIs of [09 §6](09-testing-and-benchmark-strategy.md#6-metrics-and-kpis),
  measured or NOT_VERIFIED.

## Requirements

- Node.js 20 or later. 1.6.1 declared 18, which is past upstream end of life and was never tested.

## Behaviour changes from 1.6.1

- `-f`, `--db` and `-T` are now honoured. 1.6.1 ignored them (F-04, F-06, F-05).
- `--version` prints the package version (F-02).
- Creating a project in an existing directory still fails, and the error now points to `setup`.
- A failed git commit only warns, so a created project is never left half done.
- Interactive mode asks one new question: the AI host (Claude Code, Codex or both).
- Unknown options are now an error. 1.6.1 ignored them silently.
- `create`, `setup`, `update`, `diff`, `doctor`, `rollback` and `catalog` are reserved first arguments, so a
  project can no longer be named after one of them positionally. Use `create <name>`.
- `.claude/CLAUDE.md` holds a generated managed section instead of the V1 document. The V1
  "Maintainer" line is gone; author details still fill `package.json` and the README.
- `.claude/settings.json` no longer ships broad allow rules such as `Bash(rm *)` and `Bash(curl *)`.
  A policy hook checks every command. In a V1 project, `setup` keeps your existing rules and warns
  about them.
- `--db none` on templates that use Prisma keeps PostgreSQL and prints a warning. `--db mysql` and
  `sqlite` switch the provider and `DATABASE_URL`.

## Known limitations

These are not verified, or only partly done, in this release:

- **Host compatibility is partly verified.** With the installed Claude Code CLI (2.1.332), plan
  delivery, stream events, token usage, tool calls and cost were checked on a real run. Delivery allows
  the agent to run only that run's `run event` command, so step progress reaches the run in Claude
  Code's default permission mode; editing files and other commands still need your own permission
  settings, and your `deny` rules still win. Codex (0.172.0) is only partly verified, without an
  account: its start, failure, timeout and Ctrl-C paths were checked on the installed CLI, but no
  signed-in run has completed a turn, reported a step or reported token usage (W2.0-15, W2.1-10).
  Codex runs only in a Git repository or a trusted directory, and it may leave a background
  `git fetch` of its plugin catalog running after it exits.
- **Runtime isolation is a preview.** ADR-017 is still proposed, not accepted. `--isolation restricted`
  works on macOS only (Seatbelt). `isolated` (a separate OS user) is not available, and Linux and
  Windows are unsupported. A fast double fork can outlive the run, but it stays inside the sandbox
  ([12](12-runtime-isolation-security-report.md)).
- **No V1-vs-V2 claim is verified.** The benchmark harness and the 36-task suite are included, but no
  benchmark has been run on real hosts. Every hypothesis in 09 §6 (acceptance, test pass rate,
  tokens, time) is unverified.
- **Some KPIs are not measured yet.** `report --kpi` reports test pass rate, security findings and
  the benchmark-based regression rate as NOT_VERIFIED until a benchmark runs on real hosts (09 §6;
  W2.2-06, W2.2-07).
- **Routing figures come from a development set.** The same author wrote the 140 routing tasks and
  the classifier, so the published precision and recall are optimistic. A second reviewer and a
  held-out split are still pending (09 §4).
- **Costs are the host's own estimate.** Tokens are measured from the host stream. A cost in money
  is reported only when the host gives one (Claude Code), and is labelled estimated.
- **V1 adoption is conservative.** Unmodified V1 files are not offered for replacement. Every V1
  file that differs from V2 is kept, and only `CLAUDE.md` (managed section) and `settings.json`
  (merge) change ([07 §7](07-migration-strategy.md#7-acceptance-criteria)).
- **Codex needs trust.** Codex loads `.codex/` and runs its hooks only in a trusted project, after
  the hooks are approved in `/hooks`.
- **Database switches are unchecked.** It is not verified that each template's schema migrates on
  MySQL or SQLite.

## Upgrading

See [Migrating from V1](../guides/migrating-from-v1.md). In a V1 project, run `diff` first, then
`setup`. `rollback` undoes the last installation.
