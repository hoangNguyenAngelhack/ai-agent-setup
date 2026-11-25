# C# Patterns

> Modern C# on current .NET. Follow the solution's `.editorconfig`, analyzers and existing style first.

## Nullability and types

```csharp
// ✅ <Nullable>enable</Nullable>: the compiler tracks null for you
public sealed record Money(long Cents, string Currency)
{
    public Money
    {
        ArgumentOutOfRangeException.ThrowIfNegative(Cents);
        ArgumentException.ThrowIfNullOrEmpty(Currency);
    }
}

public User? FindUser(Guid id) => _users.FirstOrDefault(u => u.Id == id);
```

- Treat nullable warnings as errors; avoid the `!` null-forgiving operator except where you can prove it.
- `record` for immutable data, `sealed` by default for classes not designed for inheritance.
- `decimal` for money, never `double`.

## Async

```csharp
// ✅ Async all the way, with cancellation
public async Task<Order> GetOrderAsync(int id, CancellationToken ct)
{
    var order = await _db.Orders.FindAsync([id], ct);
    return order ?? throw new NotFoundException($"order {id}");
}
```

- Never block on async code (`.Result`, `.Wait()`): it deadlocks and wastes threads.
- No `async void` except event handlers. Accept and pass a `CancellationToken`.
- `ConfigureAwait(false)` in library code; not needed in ASP.NET Core application code.

## Resources and errors

- `using`/`await using` for every `IDisposable`/`IAsyncDisposable`.
- Throw specific exceptions; catch only what you can handle; `throw;` (not `throw ex;`) to keep the stack.
- `HttpClient` from `IHttpClientFactory`, not `new HttpClient()` per request.

## ASP.NET Core and dependency injection

- Constructor injection; register lifetimes deliberately (no scoped service inside a singleton).
- Validate input (data annotations or FluentValidation) and return `ProblemDetails` for errors.
- Configuration through `IOptions<T>`; secrets from user-secrets or environment, never `appsettings.json` in the repository.

## LINQ and EF Core

- Keep queries `IQueryable` until the end; `AsNoTracking()` for reads; avoid N+1 with `Include` or projection.
- Use parameters: `FromSql($"... {id}")` is parameterised, string concatenation into SQL is not.

## Testing

- xUnit (or the solution's framework) with one behaviour per test; FluentAssertions when used.
- `WebApplicationFactory<T>` for API tests; real database containers over in-memory providers when behaviour depends on SQL.

## Tooling

`dotnet build -warnaserror` when the project allows it, `dotnet format --verify-no-changes`, and
`dotnet test`. Pin the SDK with `global.json` when the repository has one.
