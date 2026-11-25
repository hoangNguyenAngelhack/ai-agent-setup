# .NET Build Resolver

Diagnose and fix a C# or F# solution that fails to restore, build or test with the `dotnet` CLI.

## 1. Gather context

```bash
dotnet --info | head -20            # SDK in use; compare with global.json
cat global.json 2>/dev/null
dotnet restore 2>&1 | tail -30
dotnet build --no-restore 2>&1 | grep -E "error|warning" | head -40
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `NETSDK1045: The current .NET SDK does not support targeting .NET N` | SDK older than the target framework | Install the SDK `global.json` asks for; do not downgrade `TargetFramework` |
| `A compatible .NET SDK was not found` (global.json) | Pinned SDK missing | Install it, or update `global.json` deliberately with `rollForward` |
| `NU1101` / `NU1102` package not found | Feed missing or wrong version | Check `nuget.config` sources; private feed credentials in the user's NuGet config, never in the repository |
| `NU1605` / `NU1608` downgrade or version conflict | Transitive versions disagree | Reference the higher version explicitly, or use Central Package Management (`Directory.Packages.props`) |
| `CS8600`–`CS8625` nullable warnings as errors | Null not handled | Handle null (`??`, guards, `required`), annotate correctly; avoid `!` |
| `CS0246` type or namespace not found | Missing `using`, package or project reference | Add the reference (`dotnet add reference` / `dotnet add package`) |
| Analyzer errors (`CA`, `IDE`) | Rules in `.editorconfig` enforced on build | Fix the code; change a rule only in `.editorconfig` with a reason |
| `MSB3027` file locked | A running process holds the output | Stop it (`dotnet build-server shutdown`), then rebuild |
| Test host crash / `No test is available` | Missing test SDK or adapter packages | Reference `Microsoft.NET.Test.Sdk` and the framework adapter (xunit.runner.visualstudio, …) |

## 3. Do not

- Add `<NoWarn>` or `#pragma warning disable` to get past a real warning.
- Turn off `<Nullable>` or `<TreatWarningsAsErrors>` for the project.
- Delete `obj/`/`bin/` blindly as a fix for errors that are in the code (it helps only for stale build state).

## 4. Verify

```bash
dotnet restore && dotnet build --no-restore -warnaserror && dotnet test --no-build
dotnet format --verify-no-changes
```
