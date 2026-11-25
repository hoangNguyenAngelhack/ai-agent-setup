# Go Patterns

> Idiomatic Go that `gofmt`, `go vet` and reviewers accept. Follow the module's existing style first.

## Errors are values

```go
// ✅ Return errors, wrap them with context, check them at once
func LoadUser(ctx context.Context, id string) (*User, error) {
	u, err := repo.Find(ctx, id)
	if err != nil {
		return nil, fmt.Errorf("load user %s: %w", id, err)
	}
	return u, nil
}

// ✅ Compare with errors.Is / errors.As, never with strings
if errors.Is(err, sql.ErrNoRows) { return nil, ErrNotFound }

// ❌ Ignoring an error, or panicking in library code
u, _ := repo.Find(ctx, id)
```

- Define sentinel errors (`var ErrNotFound = errors.New("not found")`) or typed errors for callers to test.
- `panic` only for programmer errors that cannot happen; never across a package boundary.
- Error strings start lower case and carry no trailing punctuation.

## Context and cancellation

- The first parameter of anything that does I/O or may block is `ctx context.Context`.
- Never store a context in a struct; never pass `nil` (use `context.TODO()` while refactoring).
- Respect `ctx.Done()` in loops and select statements; set timeouts at the edge (`context.WithTimeout`).

## Goroutines and concurrency

```go
// ✅ Every goroutine has an owner and a way to stop; errgroup propagates errors and cancellation
g, ctx := errgroup.WithContext(ctx)
for _, id := range ids {
	g.Go(func() error { return process(ctx, id) })
}
if err := g.Wait(); err != nil { return err }
```

- Do not start a goroutine without knowing how it ends: leaked goroutines are leaked memory.
- Protect shared state with a `sync.Mutex` or confine it to one goroutine and use channels; run tests with `-race`.
- The sender closes a channel, never the receiver.

## Design

- Accept interfaces, return concrete types; define small interfaces where they are used.
- Keep packages cohesive and named for what they provide (`user`, not `utils`); avoid import cycles.
- Zero values should be useful; prefer constructors (`NewServer`) only when invariants need them.
- Exported identifiers have doc comments starting with their name.

## Testing

```go
func TestParseAmount(t *testing.T) {
	tests := []struct {
		name    string
		in      string
		want    int64
		wantErr bool
	}{
		{"whole", "12", 1200, false},
		{"cents", "12.34", 1234, false},
		{"empty", "", 0, true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseAmount(tt.in)
			if (err != nil) != tt.wantErr { t.Fatalf("err = %v, wantErr %v", err, tt.wantErr) }
			if got != tt.want { t.Errorf("got %d, want %d", got, tt.want) }
		})
	}
}
```

- Table-driven tests with `t.Run`; `t.Helper()` in helpers; `t.TempDir()` for files.
- `go test ./... -race` before you claim a change works.

## Security

- SQL through `database/sql` placeholders (`$1`, `?`), never `fmt.Sprintf` into a query.
- `html/template` for HTML (it escapes), not `text/template`.
- `exec.Command(name, args...)` with separate arguments; never `sh -c` with user input.
- Limit request bodies (`http.MaxBytesReader`) and set server timeouts.

## Tooling

`gofmt`/`goimports` on every file, `go vet ./...`, and `golangci-lint run` when the project has a
configuration. Keep `go.mod` and `go.sum` tidy with `go mod tidy`.
