# Java Patterns

> Modern Java (17 or later) as the project's build and style allow. Follow the existing code first.

## Types and immutability

```java
// ✅ Records for data carriers: immutable, with equals/hashCode/toString
public record Money(long cents, Currency currency) {
    public Money {
        if (cents < 0) throw new IllegalArgumentException("cents must be >= 0");
        Objects.requireNonNull(currency, "currency");
    }
}

// ✅ Sealed hierarchies with exhaustive switch (Java 21)
sealed interface Payment permits Card, Transfer {}
String describe(Payment p) {
    return switch (p) {
        case Card c -> "card " + c.last4();
        case Transfer t -> "transfer " + t.iban();
    };
}
```

- Fields `private final` by default; collections returned as unmodifiable views (`List.copyOf`).
- `Optional` only as a return type for "maybe absent"; never as a field or parameter, never `get()` without a check.
- `BigDecimal` (with an explicit `RoundingMode`) or integer cents for money, never `double`.

## Exceptions

- Throw specific exceptions with context; do not catch `Exception` or `Throwable` unless you rethrow or translate it at a boundary.
- Never swallow: an empty `catch` block hides failures. Log once, at the boundary that handles it.
- Close resources with try-with-resources:

```java
try (var conn = dataSource.getConnection();
     var stmt = conn.prepareStatement("SELECT name FROM users WHERE id = ?")) {
    stmt.setLong(1, id);
    try (var rs = stmt.executeQuery()) { /* ... */ }
}
```

## Concurrency

- Prefer `ExecutorService` / virtual threads (`Executors.newVirtualThreadPerTaskExecutor()`, Java 21) over raw `Thread`.
- Share immutable data; guard mutable state with `java.util.concurrent` types instead of `synchronized` sprinkled around.
- Always shut executors down; give blocking calls timeouts.

## Spring (when used)

- Constructor injection only; no field `@Autowired`.
- Keep `@Transactional` on service methods, not controllers or private methods.
- Validate input with Bean Validation (`@Valid`, `@NotNull`) at the controller boundary.

## Testing

- JUnit 5 with descriptive `@DisplayName` or method names; AssertJ for readable assertions.
- One behaviour per test; arrange–act–assert; no logic in tests.
- Mock only what you own at boundaries (repositories, clients); prefer real objects inside.

## Security

- SQL with `PreparedStatement` or the ORM's parameters, never string concatenation.
- Never deserialize untrusted data with `ObjectInputStream`.
- Keep secrets out of `application.properties` in the repository; read them from the environment.

## Tooling

Build with the project's wrapper (`./mvnw`, `./gradlew`), not a global install. Keep dependency
versions in one place (BOM or version catalog). Run the project's formatter and static analysis
(Spotless, Checkstyle, Error Prone) when configured.
