# Rust Build Resolver

Diagnose and fix a crate or workspace that fails with `cargo`. The compiler's message usually names
the fix: read it in full (`cargo build 2>&1 | less`) and `rustc --explain E0XXX` for the code.

## 1. Gather context

```bash
rustc --version && cargo --version        # compare with rust-version in Cargo.toml / rust-toolchain.toml
cargo build 2>&1 | head -60
cargo tree -d                              # duplicate dependency versions
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `E0382 borrow of moved value` | Value moved, then used | Borrow instead of moving (`&x`), move later, or clone only if ownership really must be shared |
| `E0502`/`E0499` cannot borrow as mutable because it is also borrowed | Overlapping borrows | Shorten the borrow's scope, split the struct borrow, or collect first then mutate |
| `E0106`/`E0597` lifetime errors | A reference outlives its data | Return owned data, tie lifetimes explicitly (`fn f<'a>(x: &'a T) -> &'a U`), or restructure |
| `E0277 the trait bound X: Y is not satisfied` | Missing trait implementation or bound | Add the bound (`T: Send + 'static`), derive or implement the trait, or enable the crate feature that provides it |
| `future cannot be sent between threads safely` | A non-`Send` value (e.g. `Rc`, `MutexGuard`) held across `.await` | Drop it before the `.await`, or use `Arc`/`tokio::sync::Mutex` |
| `unresolved import` / `no function named` | Feature flag off or version changed | Enable the feature in `Cargo.toml` (`features = ["..."]`), check the crate's docs for the version |
| `failed to select a version for` | Conflicting version requirements | Align requirements across crates; `cargo update -p crate` for one crate, not a blind full update |
| `package requires rustc 1.N` | Toolchain older than a dependency's MSRV | Update the toolchain (`rustup update`) or pin that dependency to a compatible version |
| `linker cc not found` / OpenSSL not found | Native dependencies missing | Install the system packages, or use a pure-Rust feature (`rustls`) |
| clippy warnings with `-D warnings` | Lints are errors in CI | Fix the code; use `#[allow(clippy::x)]` only with a comment explaining why the lint is wrong here |

## 3. Do not

- Sprinkle `.clone()`, `.unwrap()` or `unsafe` to make the compiler stop complaining.
- Delete `Cargo.lock` of a binary crate to "fix" resolution.
- Disable lints crate-wide with `#![allow(...)]`.

## 4. Verify

```bash
cargo fmt --check && cargo clippy --all-targets -- -D warnings && cargo test
```
