# JVM Build Resolver (Maven and Gradle)

Diagnose and fix a Java or Kotlin project that fails to resolve, compile or test. Use the project's
wrapper (`./mvnw`, `./gradlew`), never a globally installed Maven or Gradle.

## 1. Gather context

```bash
java -version                      # the JDK running the build
./gradlew --version                # Gradle and the JVM it uses
./mvnw -v                          # Maven and its JDK
./gradlew build --stacktrace 2>&1 | tail -60
./mvnw -q -e verify 2>&1 | tail -60
```

Check the declared toolchain: `java.toolchain` / `jvmToolchain(N)` in Gradle, `maven.compiler.release`
in the POM.

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `invalid target release: N` / `Unsupported class file major version` | JDK older (or newer) than the build expects | Use the JDK the toolchain declares (set `JAVA_HOME` or Gradle toolchains); do not lower the release level |
| `Could not resolve ...` / `Could not find artifact` | Repository missing, offline, or wrong coordinates | Check `repositories {}` / `<repositories>`, the coordinates and version; credentials for private repositories in `~/.gradle/gradle.properties` or `~/.m2/settings.xml`, never in the repository |
| Version conflict / `NoSuchMethodError` at runtime | Two versions of a library on the classpath | `./gradlew dependencyInsight --dependency X` or `./mvnw dependency:tree -Dincludes=group:artifact`; align with a BOM or platform |
| `cannot find symbol` after an upgrade | API changed | Read the migration guide; adapt the code |
| Kotlin: `Unresolved reference` with annotation processing | kapt/KSP not configured for the processor | Apply the KSP or kapt plugin and declare the processor with `ksp(...)`/`kapt(...)` |
| Kotlin: `Inconsistent JVM-target compatibility` | Java and Kotlin targets differ | Set one `jvmToolchain(N)` for both |
| `Execution failed for task ':test'` | Failing tests | Open the report (`build/reports/tests/test/index.html`, `target/surefire-reports`), fix the test or the code |
| Gradle: `Could not determine the dependencies of task` / configuration cache errors | Build script misconfiguration | Run with `--stacktrace`; fix the script; do not disable the configuration cache project-wide |
| `OutOfMemoryError` during build | Too little heap for the daemon | Raise `org.gradle.jvmargs` / `MAVEN_OPTS` moderately |

## 3. Do not

- Skip tests (`-x test`, `-DskipTests`) to claim a build passes.
- Add `@SuppressWarnings`, lower `-Werror`, or exclude modules to hide a failure.
- Delete `~/.gradle` or `~/.m2` wholesale; refresh one dependency with `--refresh-dependencies` instead.

## 4. Verify

```bash
./gradlew clean build      # or
./mvnw -q clean verify
```
