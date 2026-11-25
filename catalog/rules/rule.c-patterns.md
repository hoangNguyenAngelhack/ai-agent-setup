# C Patterns

> Safe, portable C (C11/C17 as the project's build sets). Follow its formatter and warning flags.

## Memory and ownership

```c
// ✅ Every allocation has one owner and one release path; check every result
struct buffer *buffer_new(size_t capacity) {
    struct buffer *b = malloc(sizeof *b);
    if (b == NULL) return NULL;
    b->data = malloc(capacity);
    if (b->data == NULL) { free(b); return NULL; }
    b->size = 0;
    b->capacity = capacity;
    return b;
}

void buffer_free(struct buffer *b) {
    if (b == NULL) return;
    free(b->data);
    free(b);
}
```

- Document who owns each pointer; free exactly once; set freed pointers to `NULL` when they stay in scope.
- Use a single cleanup path (`goto cleanup;`) in functions that acquire several resources.
- `sizeof *ptr` instead of repeating the type; check multiplication for overflow before `malloc(n * size)`.

## Strings and buffers

- Always pass buffer sizes; never `gets`, `strcpy`, `strcat` or `sprintf`. Use `snprintf` and check its return value for truncation.
- Bound every loop over input by the buffer length; validate lengths from files, network or users before copying.

## Errors and undefined behaviour

- Check every return value (`malloc`, `fopen`, `read`, `write`, library calls); return error codes consistently and propagate them.
- No signed integer overflow, out-of-bounds access, use after free, uninitialised reads or misaligned casts.
- Prefer fixed-width types (`uint32_t`, `size_t` for sizes) and explicit conversions.

## Concurrency

- Shared state behind a mutex (C11 threads or pthreads); no data races; document which lock protects what.

## Build and tests

- Compile with `-Wall -Wextra -Wpedantic -Werror` (or the project's equivalent) and a fixed standard (`-std=c17`).
- Unit tests registered with `ctest` (Unity, cmocka, or the project's framework).
- Run tests under `-fsanitize=address,undefined` and fix every report.

## Security

- Treat every external input as hostile: lengths, indices, format strings (never pass user data as a format string).
- Avoid `system()` and shell commands; use `exec*` with argument arrays when a process must run.
