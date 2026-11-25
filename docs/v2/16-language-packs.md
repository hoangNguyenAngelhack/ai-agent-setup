# 16. Language packs

**Status:** waves 1 and 2 merged (#26); polyglot gates and publish policy on `feature/polyglot-gates` (2026-11-25); wave 3 open. Requested by the maintainer:
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

## 3. Wave 2 scope

**Swift (iOS and Swift packages), Android (Kotlin), Dart/Flutter, C and C++ (CMake).**

1. **Stacks, not only languages.** The installation filter covers platforms too (`android`, `ios`,
   `flutter`): the Android rule and build skill go to Android apps, not to every Kotlin service.
2. **Detection** of native Android apps (Android Gradle plugin at the root or in `app/`), native iOS
   apps (an Xcode project at the root), Swift packages, plain Dart packages, and CMake projects (C or
   C++, CTest, clang-tidy); ktlint and detekt for Gradle builds. A Flutter app's `ios/` folder does not
   make it a Swift project.
3. **Rules** for Swift, Android, Dart and Flutter, C++ and C; **build skills** for Swift (SwiftPM,
   Xcode, CocoaPods), Android (Gradle and AGP), Flutter and C/C++ (CMake, linking, sanitizers).
4. **Gates:** `swift build`/`swift test`/`swiftlint`, `flutter test`/`flutter analyze`, `dart
   test`/`dart analyze`, CMake configure and build with `ctest`, `./gradlew lint` for Android (ktlint
   or detekt first when declared). An Xcode app gets no default command: it needs its scheme.

Out of scope: benchmark tasks per language and the measured comparison (wave 3, needs model quota).

## 4. Polyglot gates and publish policy

Language packs only help if the project's gates can run. Before this change the dependency audit and
coverage gates worked for Node only, so every other stack stopped at them.

| Gate | Per stack |
|---|---|
| `gate.dependency-audit` (version 1.1.0) | npm: `npm audit --json`, high and critical fail. Go `govulncheck ./...`, Python `pip-audit`, Rust `cargo audit`, Ruby `bundle exec bundle-audit check --update`, PHP `composer audit`, .NET `dotnet list package --vulnerable --include-transitive`: any known vulnerability fails |
| `gate.coverage-80`/`-95` | Go `go test -coverprofile`, Python with pytest-cov, Rust `cargo llvm-cov`, Flutter `flutter test --coverage`, SwiftPM `swift test --enable-code-coverage`, JVM with JaCoCo (Gradle or Maven), .NET with coverlet, PHPUnit and Pest (Cobertura), Ruby with SimpleCov; Node unchanged |
| `safety.publish-approval` | Asks before publishing in every ecosystem: cargo, gem, twine, Poetry, uv, NuGet, CocoaPods, pub, Maven deploy, Gradle publish tasks (not `publishToMavenLocal`), Swift registry, Bun, Deno, `docker push`/`podman push`, as well as npm, pnpm and yarn |

Audit tools print their own results. They are read fail-closed: PASS needs exit code 0 and the tool's
"no vulnerabilities" sentence, the vulnerability sentence is FAIL, anything else NOT_VERIFIED. These
sentences follow the tools' documentation and were **not verified against installed tools** (none was
installed here): a mismatch shows as NOT_VERIFIED, never as a false PASS. Coverage reports are read
from their documented formats; a metric a format does not measure (for example functions in
Cobertura) is reported as not measured, never as passed.

## 5. Acceptance criteria

- A Go, JVM, .NET, Rust, PHP, Ruby or Python project gets its own rule and build skill, and not those
  of other languages; a Node project is unchanged; an empty directory gets everything.
- Each stack's gates resolve to the command of the tool it uses, and to no command when the project
  has no such tool (the gate then says how to configure it).
- T0 context stays within the profile budget.
- Tests cover detection, gate resolution and language-aware generation; golden snapshots change only
  by the new entries.
