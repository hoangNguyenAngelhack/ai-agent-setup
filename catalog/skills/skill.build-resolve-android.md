# Android Build Resolver

Diagnose and fix an Android app that fails with Gradle and the Android Gradle plugin (AGP). Always use
the project's `./gradlew`.

## 1. Gather context

```bash
./gradlew --version                         # Gradle and the JVM it runs on
grep -rn "com.android.application\|agp\|kotlin" gradle/libs.versions.toml build.gradle* 2>/dev/null | head
echo $ANDROID_HOME; cat local.properties 2>/dev/null | grep sdk.dir
./gradlew assembleDebug --stacktrace 2>&1 | grep -E "error|FAILURE|What went wrong" -A5 | head -60
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `Android Gradle plugin requires Java 17 to run` | Gradle runs on an older JDK | Point Gradle at JDK 17+ (`org.gradle.java.home` or `JAVA_HOME`); do not downgrade AGP |
| `SDK location not found` | No `ANDROID_HOME` / `local.properties` | Set `sdk.dir` in `local.properties` (never commit it) or `ANDROID_HOME` |
| `Failed to find target with hash string 'android-N'` / build-tools missing | SDK platform not installed | `sdkmanager "platforms;android-N" "build-tools;X"` |
| Kotlin / Compose compiler version incompatible with AGP or Kotlin | Mismatched plugin versions | Align versions in `libs.versions.toml` using the compatibility tables (Compose compiler plugin for Kotlin 2.x) |
| `Manifest merger failed` | Conflicting attributes from libraries | Read the merger report (`app/build/outputs/logs/manifest-merger-*.txt`); resolve with `tools:replace` only for the attribute that must win |
| `Duplicate class ... found in modules` | Two artifacts ship the same classes | Exclude the old artifact or align versions (BOM) |
| `Resource ... not found` / AAPT errors | Missing or misnamed resource, wrong namespace | Fix the resource name; check `namespace` in the module's `android {}` block |
| R8: `Missing class` in release only | Shrinking removed or cannot see classes | Add the keep rules the library documents (`proguard-rules.pro`); do not disable minification |
| `Execution failed for task ':app:lintVitalRelease'` | Lint errors | Fix them; baseline only for pre-existing issues, never new ones |

## 3. Do not

- Disable lint, minification or tests to pass a build.
- Commit `local.properties`, keystores or signing passwords.
- Upgrade every dependency at once to fix one conflict.

## 4. Verify

```bash
./gradlew assembleDebug test lint
```
