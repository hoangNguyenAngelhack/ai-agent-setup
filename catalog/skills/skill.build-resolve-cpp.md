# C and C++ Build Resolver

Diagnose and fix a C or C++ project that fails to configure, compile, link or test with CMake. Read the
**first** compiler error: template and macro errors cascade.

## 1. Gather context

```bash
cmake --version && c++ --version && cc --version
cmake -S . -B build 2>&1 | tail -30                       # configure
cmake --build build 2>&1 | grep -E "error|undefined reference" -m 20
ctest --test-dir build --output-on-failure 2>&1 | tail -40
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `Could not find a package configuration file provided by "X"` | Dependency not installed or not on `CMAKE_PREFIX_PATH` | Install it (system package, vcpkg or Conan as the project uses) and point `CMAKE_PREFIX_PATH` / the toolchain file at it |
| `fatal error: x.h: No such file or directory` | Include path missing on the target | `target_include_directories(target PRIVATE ...)` or link the target that exports the headers |
| `undefined reference to ...` / `unresolved external symbol` | Missing library, wrong order, or declaration without definition | `target_link_libraries(target PRIVATE lib)`; check that the function is defined and compiled; `extern "C"` for C functions called from C++ |
| `multiple definition of ...` | Definition in a header included twice | Mark it `inline` or move it to one `.cpp`/`.c` file |
| `error: 'std::x' is not a member` / C++20 features rejected | Wrong language standard | `set(CMAKE_CXX_STANDARD 20)` + `CMAKE_CXX_STANDARD_REQUIRED ON` (or `target_compile_features`) |
| New warnings fail the build (`-Werror`) | Real problems (conversion, unused, shadowing) | Fix the code; never remove `-Werror` |
| AddressSanitizer: heap-use-after-free / buffer-overflow | Memory bug | Read the stack trace's first frame in your code; fix ownership or bounds |
| UBSan: signed integer overflow / misaligned access | Undefined behaviour | Use wider or unsigned types deliberately; fix the cast or alignment |
| Stale build after changing options | Cached configuration | Reconfigure in a fresh build directory (`cmake -S . -B build-new`) |

## 3. Do not

- Add `-w`, remove `-Werror`, or disable a sanitizer to make tests pass.
- Hard-code absolute include or library paths of your machine.
- Cast away `const` or add `reinterpret_cast` to silence a type error.

## 4. Verify

```bash
cmake -S . -B build -DCMAKE_BUILD_TYPE=Debug && cmake --build build && ctest --test-dir build --output-on-failure
```
