# Swift Build Resolver

Diagnose and fix a Swift package or Xcode project that fails to resolve, build, sign or test.

## 1. Gather context

```bash
swift --version && xcodebuild -version            # toolchain and Xcode in use
xcode-select -p                                   # which Xcode the command line uses
swift package resolve 2>&1 | tail -20             # Swift packages
xcodebuild -list                                  # schemes and targets of an Xcode project
xcodebuild -scheme <Scheme> -destination 'platform=iOS Simulator,name=iPhone 15' build 2>&1 | grep -E "error:|warning:" | head -40
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `package 'x' is using Swift tools version N but the installed version is M` | Toolchain older than `swift-tools-version` | Use the Xcode/toolchain the project targets (`xcode-select -s`); do not lower the tools version |
| `Dependencies could not be resolved` | Version conflict or unreachable repository | Check `Package.swift` requirements and `Package.resolved`; `swift package update <name>` for one package |
| CocoaPods: `Unable to find a specification` / pod versions out of sync | Spec repo or lockfile out of date | `pod repo update` then `pod install` (not `pod update` for everything); open the `.xcworkspace`, not the `.xcodeproj` |
| `Sending 'x' risks causing data races` / `non-Sendable type` | Strict concurrency checking | Make the type `Sendable`, isolate it to an actor or `@MainActor`, or copy values across; avoid `@unchecked Sendable` without proof |
| `Call to main actor-isolated ... in a synchronous nonisolated context` | UI code called off the main actor | Mark the caller `@MainActor` or `await MainActor.run { }` |
| `No signing certificate` / provisioning profile errors | Signing set for another team or machine | Build for the simulator, or set your team in the project; never commit personal signing settings |
| `Module 'X' not found` | Target not linked or wrong platform | Add the product to the target's dependencies; check the platform conditions in `Package.swift` |
| Simulator test failures `Unable to boot device` | Destination not installed | `xcrun simctl list devices`, pick an available destination |
| SwiftLint violations | Rules in `.swiftlint.yml` | Fix the code; `swiftlint --fix` for autocorrectable rules |

## 3. Do not

- Delete `Package.resolved` or `Podfile.lock` to make resolution pass.
- Disable strict concurrency checking or add `// swiftlint:disable` to hide new problems.
- Commit `DerivedData`, `xcuserdata` or personal signing changes.

## 4. Verify

```bash
swift build && swift test                                   # packages
xcodebuild -scheme <Scheme> -destination '<destination>' test # apps
```
