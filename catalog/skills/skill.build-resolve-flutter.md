# Flutter Build Resolver

Diagnose and fix a Flutter app or Dart package that fails with pub, analysis, tests or a platform build.

## 1. Gather context

```bash
flutter --version && dart --version          # compare with `environment: sdk:` in pubspec.yaml
flutter doctor -v | head -40                 # platform toolchains (Xcode, Android SDK)
flutter pub get 2>&1 | tail -20
flutter analyze 2>&1 | head -40
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `The current Dart SDK version is X. Because app requires SDK version >=Y` | SDK older than the constraint | Use the Flutter version the project pins (FVM or `.flutter-version` when present); do not loosen the constraint |
| `version solving failed` | Conflicting package constraints | Read the conflict; `flutter pub upgrade <package>` or adjust one constraint; `dependency_overrides` only temporarily and with a reason |
| `Target of URI doesn't exist` / missing `*.g.dart` | Generated code not built | `dart run build_runner build --delete-conflicting-outputs` |
| `The method 'x' isn't defined` after an upgrade | Breaking change in a package or Flutter | Read the migration guide; adapt the code |
| iOS: `CocoaPods could not find compatible versions` / pod install errors | Pods out of date or platform version too low | `cd ios && pod repo update && pod install`; raise `platform :ios` only if the dependency requires it |
| Android: Gradle, AGP or Kotlin version errors | Android toolchain mismatch | Follow the Android build resolver; align with the versions `flutter create` currently generates |
| `setState() called after dispose()` / `Looking up a deactivated widget's ancestor` | Async work using a dead `BuildContext` | Check `mounted` after `await`; cancel subscriptions in `dispose()` |
| Widget test `pumpAndSettle timed out` | Endless animation or pending timer | Use `pump(duration)` for animations; fake async work |
| Analyzer warnings as errors | Lints in `analysis_options.yaml` | Fix them; `// ignore:` only with a reason |

## 3. Do not

- Delete `pubspec.lock` (apps) or commit `dependency_overrides` to hide a conflict.
- Turn off lints in `analysis_options.yaml` or skip tests to get green.
- Commit build outputs (`build/`, `.dart_tool/`, `ios/Pods`).

## 4. Verify

```bash
flutter pub get && flutter analyze && flutter test     # Flutter
dart pub get && dart analyze && dart test              # Dart packages
```
