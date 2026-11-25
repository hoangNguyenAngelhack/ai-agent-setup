# C++ Patterns

> Modern C++ (C++17/20 as the project's CMake sets). Follow its `.clang-format` and `.clang-tidy`.

## Ownership and resources (RAII)

```cpp
// ✅ Owners are values or smart pointers; resources are released by destructors
auto parser = std::make_unique<Parser>(config);
std::vector<Order> orders = load_orders(path);   // returned by value (moved, not copied)

class File {
public:
    explicit File(const std::filesystem::path& p) : handle_{std::fopen(p.c_str(), "rb")} {
        if (!handle_) throw std::system_error(errno, std::generic_category(), p.string());
    }
private:
    std::unique_ptr<FILE, decltype(&std::fclose)> handle_{nullptr, &std::fclose};
};

// ❌ Manual new/delete and raw owning pointers leak on every early return or exception
Parser* parser = new Parser(config);
```

- No raw `new`/`delete`; `std::unique_ptr` by default, `std::shared_ptr` only for real shared ownership.
- Raw pointers and references are non-owning views; `std::span`/`std::string_view` for borrowed ranges (never outliving the owner).
- Rule of zero: let members manage resources; if you write a destructor, handle copy and move too.

## Correctness

- `const` by default (variables, member functions, references); `explicit` single-argument constructors.
- Initialise every variable; prefer `{}` initialisation and `auto` when the type is obvious.
- Use the standard library (`<algorithm>`, ranges) over hand-written loops with indices.
- Avoid undefined behaviour: no signed overflow, out-of-bounds access (`.at()` or checked indices in debug), dangling references, or data races.

## Errors

- Exceptions for exceptional failures (or `std::expected`/error codes where the project uses them); never ignore return values marked `[[nodiscard]]`.

## Concurrency

- `std::jthread`/`std::thread` joined before destruction; shared state behind `std::mutex` with `std::scoped_lock`; atomics only for simple counters and flags.

## Build and tests

- CMake targets with `target_*` commands (no global `include_directories`/`add_definitions`); warnings on (`-Wall -Wextra -Wpedantic`, `/W4`) and treated as errors in CI.
- Tests with the project's framework (GoogleTest, Catch2) registered with `ctest`.
- Run tests under AddressSanitizer and UndefinedBehaviorSanitizer (`-fsanitize=address,undefined`) before claiming a fix.

## Security

- Bounds-checked containers instead of C arrays; `std::string` instead of `char*` buffers; never `strcpy`/`sprintf` (use `std::format` or `snprintf`).
- Validate sizes from untrusted input before allocating or indexing.
