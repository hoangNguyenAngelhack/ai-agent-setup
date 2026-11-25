# Rust Patterns

> Idiomatic Rust that `cargo clippy -- -D warnings` accepts. Follow the crate's existing style first.

## Errors

```rust
// ✅ Libraries: typed errors (thiserror); applications: anyhow with context
#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    #[error("user {0} not found")]
    NotFound(UserId),
    #[error(transparent)]
    Db(#[from] sqlx::Error),
}

pub async fn load(pool: &PgPool, id: UserId) -> Result<User, LoadError> {
    sqlx::query_as!(User, "SELECT id, name FROM users WHERE id = $1", id.0)
        .fetch_optional(pool)
        .await?
        .ok_or(LoadError::NotFound(id))
}
```

- Propagate with `?`; add context (`.context("reading config")` with anyhow) where it helps.
- No `unwrap()`/`expect()` in library code or request paths; `expect("why it cannot fail")` only for real invariants.
- Never `panic!` for expected failures.

## Ownership and borrowing

- Borrow (`&T`, `&str`, `&[T]`) in parameters; take ownership only when you store or consume.
- Do not `clone()` to silence the borrow checker before understanding the conflict; restructure scopes or split borrows.
- Return owned data from constructors; prefer iterators over index loops.
- `Arc<Mutex<T>>` only for shared mutable state across threads; keep lock scopes short, never hold a lock across `.await`.

## Types and traits

- Newtypes for identifiers and units (`struct UserId(Uuid)`); enums for states instead of booleans.
- Derive what you need (`Debug`, `Clone`, `PartialEq`); implement `Display` for user-facing text.
- Keep `pub` minimal; document public items with `///` and examples that compile as doctests.

## Async

- One runtime (usually Tokio); no blocking calls in async code (`spawn_blocking` for CPU or blocking I/O).
- Cancellation-safe code in `select!` branches; set timeouts on network calls.

## Unsafe

- Avoid `unsafe`. If unavoidable, keep it tiny, wrapped in a safe API, with a `// SAFETY:` comment proving each invariant.

## Testing

- Unit tests in `#[cfg(test)] mod tests` beside the code; integration tests in `tests/`.
- `#[tokio::test]` for async; property tests (proptest) for parsers and invariants.

## Security

- Parameterised queries (sqlx macros, diesel); never `format!` into SQL.
- Validate untrusted input sizes before allocating; use `cargo audit` when configured.

## Tooling

`cargo fmt`, `cargo clippy --all-targets -- -D warnings`, `cargo test`. Commit `Cargo.lock` for
binaries; respect the crate's MSRV (`rust-version`).
