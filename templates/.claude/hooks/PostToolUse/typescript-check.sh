#!/bin/bash
# Hook: typescript-check
# Type: PostToolUse
# Trigger: Edit(*.ts, *.tsx)
# Purpose: Type-check TypeScript files after editing

# Don't exit on error - graceful handling
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

# Only check TypeScript files
if [[ "$EXT" != "ts" && "$EXT" != "tsx" ]]; then
    exit 0
fi

# Skip if file doesn't exist
if [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# Check if TypeScript is available
if ! command -v npx &> /dev/null; then
    exit 0
fi

# Check if tsconfig exists
if [ ! -f "tsconfig.json" ]; then
    exit 0
fi

# Run type check on the specific file
echo "Type-checking: $FILE_PATH"

# Use tsc --noEmit to check without emitting
RESULT=$(npx tsc --noEmit "$FILE_PATH" 2>&1 || true)

if [ -n "$RESULT" ]; then
    # Filter for actual errors (not "Cannot find module" for valid imports)
    ERRORS=$(echo "$RESULT" | grep -E "error TS[0-9]+" || true)

    if [ -n "$ERRORS" ]; then
        echo ""
        echo "TypeScript errors found:"
        echo "$ERRORS"
        echo ""
        echo "Consider fixing these type errors."
        # Log to file
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] TS: Type errors in $FILE_PATH" >> /tmp/claude-hooks.log
    fi
fi

exit 0
