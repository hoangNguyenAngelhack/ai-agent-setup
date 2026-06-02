#!/bin/bash
# Hook: console-log-warn
# Type: PostToolUse
# Trigger: Edit
# Purpose: Warn about console.log statements in production code

# Don't exit on error
set +e

# Parse the file path from tool input
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"\K[^"]+' 2>/dev/null || echo "")

if [ -z "$FILE_PATH" ]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null || echo "")
fi

# Skip if no file path
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Get file extension
EXT="${FILE_PATH##*.}"

# Only check JavaScript/TypeScript files
case "$EXT" in
    js|jsx|ts|tsx) ;;
    *) exit 0 ;;
esac

# Skip test files
if echo "$FILE_PATH" | grep -qE '\.(test|spec)\.(js|jsx|ts|tsx)$'; then
    exit 0
fi

# Skip if file doesn't exist
if [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# Count console.log statements
LOG_COUNT=$(grep -c 'console\.log' "$FILE_PATH" 2>/dev/null || echo "0")

# Also check for other console methods
DEBUG_COUNT=$(grep -cE 'console\.(debug|info|warn|error|trace)' "$FILE_PATH" 2>/dev/null || echo "0")

# Calculate total
TOTAL=$((LOG_COUNT + DEBUG_COUNT))

if [ "$TOTAL" -gt 0 ]; then
    echo ""
    echo "Note: Found $TOTAL console statement(s) in $FILE_PATH"

    if [ "$LOG_COUNT" -gt 0 ]; then
        echo "  - console.log: $LOG_COUNT"
    fi

    if [ "$DEBUG_COUNT" -gt 0 ]; then
        echo "  - Other console methods: $DEBUG_COUNT"
    fi

    echo ""
    echo "Consider:"
    echo "  - Using a proper logger (e.g., Pino, Winston)"
    echo "  - Removing debug statements before committing"
    echo "  - Using conditional logging (if (DEBUG) console.log(...))"
    echo ""
fi

exit 0
