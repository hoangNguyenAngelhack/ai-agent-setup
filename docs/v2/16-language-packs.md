# 16. Language packs (wave 1)

**Status:** wave 1 implemented on `feature/language-packs-wave-1` (2026-11-25); waves 2 and 3 open. Requested by the maintainer:
the toolkit should help agents write code in every common language, and do it efficiently.

## 1. Problem

V2.0 detects many stacks, but guides agents well only for Node.js and TypeScript:

| Layer | Before wave 1 |
|---|---|
| Detection | JavaScript/TypeScript, Python, Java/Kotlin, Go, C#/F#, Rust, Ruby, PHP, Dart |
| Gate commands | Node (scripts), Go, Rust, Maven, Gradle, .NET build and tests; Python tests only |
| Rules and skills | TypeScript, Python, SQL; Node, NestJS, React, React Native, Prisma |
| Benchmark | JavaScript and Python only |

Every project also receives every rule and skill, whatever its language: a Go project gets the Node
build skill, a Node project would get a Go rule.

## 2. Wave 1 scope

Languages: **Go, Java, Kotlin, C#, Rust, PHP, Ruby**, and the missing Python pieces.

1. **Language-aware installation.** A catalog entry that names languages in
   `requiredContext.projectSignals` is installed only when the project uses one of them. A project
   with no detected language (an empty directory) still gets everything, as before.
2. **Rules** `rule.<language>-patterns`: idiomatic code, errors, concurrency, testing and security
   for each language, scoped to its files (Claude Code path rules; Codex skills), so they never count
   toward the always-loaded context (T0).
3. **Build-resolution skills** `skill.build-resolve-<stack>`: how to diagnose and fix build, dependency
   and toolchain errors for Go, JVM (Maven and Gradle), .NET, Rust, PHP, Ruby and Python.
4. **Gate commands that match the project's own tools.** Detection learns the test runner and linter
   of each stack (RSpec or Minitest, RuboCop; PHPUnit or Pest, PHPStan; Ruff, mypy); gates run the tool
   the project uses, never a guess: `bundle exec rspec`, `vendor/bin/phpunit`, `ruff check .`,
   `mypy .`, `dotnet format --verify-no-changes`, `cargo check`.

Out of scope for wave 1: Swift, Kotlin Android, Dart/Flutter and C/C++ (wave 2); benchmark tasks per
language and the measured comparison (wave 3, needs model quota).

## 3. Acceptance criteria

- A Go, JVM, .NET, Rust, PHP, Ruby or Python project gets its own rule and build skill, and not those
  of other languages; a Node project is unchanged; an empty directory gets everything.
- Each stack's gates resolve to the command of the tool it uses, and to no command when the project
  has no such tool (the gate then says how to configure it).
- T0 context stays within the profile budget.
- Tests cover detection, gate resolution and language-aware generation; golden snapshots change only
  by the new entries.
