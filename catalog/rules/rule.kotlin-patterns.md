# Kotlin Patterns

> Idiomatic Kotlin for the JVM and Android. Follow the project's existing style and ktlint/detekt rules.

## Null safety

```kotlin
// ✅ Model absence in the type; handle it once
fun findUser(id: UserId): User? = repo.find(id)

val name = findUser(id)?.name ?: "unknown"

// ❌ `!!` turns a type error into a crash at runtime
val name = findUser(id)!!.name
```

- No `!!` outside tests; use `?.`, `?:`, `requireNotNull(x) { "why" }` or a smart cast.
- `lateinit` only for values a framework injects; never for something you could pass in.

## Data modelling

```kotlin
data class Money(val cents: Long, val currency: Currency) {
    init { require(cents >= 0) { "cents must be >= 0" } }
}

sealed interface Result<out T> {
    data class Ok<T>(val value: T) : Result<T>
    data class Err(val reason: String) : Result<Nothing>
}

fun render(r: Result<User>) = when (r) {   // exhaustive: no else branch needed
    is Result.Ok -> r.value.name
    is Result.Err -> r.reason
}
```

- `val` over `var`; read-only `List`/`Map` in APIs, mutable collections only inside functions.
- Value classes (`@JvmInline value class UserId(val value: String)`) for identifiers.

## Coroutines

- Structured concurrency: launch in a scope that owns the work (`coroutineScope`, `viewModelScope`), never `GlobalScope`.
- `suspend` functions are main-safe: move blocking I/O with `withContext(Dispatchers.IO)`.
- Do not catch `CancellationException` without rethrowing it.
- Prefer `Flow` for streams; collect with lifecycle awareness on Android.

## Errors

- Exceptions for unexpected failures; a sealed `Result` type (or `kotlin.Result`) for expected outcomes callers must handle.
- `runCatching` swallows cancellation and every error: avoid it around suspending calls.

## Testing

- JUnit 5 or kotlin.test; `kotlinx-coroutines-test` with `runTest` for suspend code.
- Backtick names describe behaviour: ``fun `rejects negative amounts`()``.
- Fakes over mocks for your own interfaces; MockK only at boundaries.

## Security

- Parameterised queries (Exposed, jOOQ, JDBC parameters), never string templates into SQL.
- On Android: no secrets in the APK, `EncryptedSharedPreferences`/Keystore for tokens, HTTPS only.

## Tooling

Build with `./gradlew`; keep versions in `libs.versions.toml`. Run ktlint or detekt when configured.
