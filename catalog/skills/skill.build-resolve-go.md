# Go Build Resolver

Diagnose and fix a Go module that fails to build, vet or test. Fix the cause; never silence the tool.

## 1. Gather context

```bash
go version                # compare with the `go` and `toolchain` lines in go.mod
go env GOPATH GOFLAGS GOPROXY GOPRIVATE CGO_ENABLED
go build ./... 2>&1 | head -40
go vet ./...
```

Read the **first** error: later ones are often consequences.

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `go: updates to go.mod needed` / `missing go.sum entry` | Dependencies changed without updating the module files | `go mod tidy`, then review the diff of `go.mod`/`go.sum` |
| `no required module provides package X` | Import of a module not in `go.mod` | `go get X@<version>` (pin a version), then `go mod tidy` |
| `go.mod requires go >= 1.N (running go 1.M)` | Toolchain older than the module | Install the required toolchain, or let `GOTOOLCHAIN=auto` fetch it; do not lower the `go` line |
| `ambiguous import` / two major versions | `v2+` modules need the `/vN` path suffix | Import `example.com/mod/v2/...` consistently |
| `import cycle not allowed` | Packages depend on each other | Move the shared type to a third package or invert the dependency with an interface |
| `undefined: X` after an upgrade | API changed in a dependency | Read the dependency's changelog; adapt the call, do not pin an old version silently |
| `cgo: C compiler "gcc" not found` | cgo needs a C toolchain | Install it, or build with `CGO_ENABLED=0` when the module does not need cgo |
| `go vet`: `printf`, `copylocks`, `lostcancel` | Real bugs | Fix the code (wrong format verb, copied mutex, missing `cancel()`) |
| Private module: `410 Gone` / `unknown revision` | Proxy cannot see the repository | Set `GOPRIVATE=your.host/*` and configure git credentials for that host |
| `-race` reports a data race | Unsynchronised shared memory | Add a mutex or confine the state to one goroutine; never remove `-race` from CI |

## 3. Do not

- Delete `go.sum` to "reset" it, or commit `replace` directives to local paths.
- Add `//nolint` or skip a test to make the build green.
- Run `go get -u ./...` (it upgrades everything) to fix one error.

## 4. Verify

```bash
go mod tidy && git diff --exit-code go.mod go.sum   # nothing left to tidy
go build ./... && go vet ./... && go test ./... -race
```
