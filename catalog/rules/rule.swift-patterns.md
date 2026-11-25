# Swift Patterns

> Modern Swift (5.9 or later) for apps and packages. Follow the project's SwiftLint rules and style.

## Optionals and errors

```swift
// ✅ Unwrap safely; fail with a typed error
enum LoadError: Error { case notFound(UserID), decoding(Error) }

func loadUser(_ id: UserID) async throws -> User {
    guard let data = try await store.data(for: id) else { throw LoadError.notFound(id) }
    do { return try JSONDecoder().decode(User.self, from: data) }
    catch { throw LoadError.decoding(error) }
}

// ❌ Force unwrap and try! crash at runtime
let user = try! JSONDecoder().decode(User.self, from: data!)
```

- No `!`, `try!` or `as!` outside tests and truly impossible cases (with a comment).
- `guard` for early exits; `if let x` shorthand for unwrapping.

## Value types and modelling

- Prefer `struct` and `enum`; use `final class` when identity or reference semantics are needed.
- Enums with associated values for states (`case loading, loaded([Item]), failed(String)`) instead of several optionals.
- `Decimal` or integer minor units for money, never `Double`.

## Concurrency

- `async`/`await` over completion handlers; `Task` lifetimes owned by a view or object and cancelled with it.
- Protect shared mutable state with an `actor`; UI updates on `@MainActor`.
- Make types crossing concurrency domains `Sendable`; fix strict-concurrency warnings instead of silencing them with `@unchecked Sendable`.
- Never block the main thread (no synchronous network or disk I/O there).

## SwiftUI (when used)

- Views are small and derived from state; keep logic in an `@Observable` model (or `ObservableObject`).
- `@State` for view-local state, `@Binding` to pass it down, the environment for app-wide services.
- Lists need stable `id`s; avoid heavy work in `body`.

## Memory (UIKit, closures)

- `[weak self]` in escaping closures stored by `self` or long-lived objects; no retain cycles between delegates (`weak var delegate`).

## Testing

- XCTest or Swift Testing (`@Test`, `#expect`), whichever the project uses; `async` tests for async code.
- Inject dependencies through protocols so tests use fakes, not the network.

## Security

- Tokens and passwords in the Keychain, never `UserDefaults`; App Transport Security stays on (HTTPS).
- Validate and encode data you put into URLs, SQL (parameter binding in SQLite/GRDB) or web views.

## Tooling

`swift build`/`swift test` for packages; `xcodebuild` with the project's scheme for apps; SwiftLint
when `.swiftlint.yml` exists. Resolve packages with the committed `Package.resolved`.
