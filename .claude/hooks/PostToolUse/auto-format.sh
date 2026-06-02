#!/bin/bash
# Hook: auto-format
# Type: PostToolUse
# Trigger: Edit
# Purpose: Auto-format files after editing

# Don't exit on error - this is a post-hook, should be graceful
set +e

# Parse the file path from tool input
# TOOL_INPUT format: {"file_path": "/path/to/file", ...}
FILE_PATH=$(echo "$TOOL_INPUT" | grep -oP '"file_path"\s*:\s*"\K[^"]+' 2>/dev/null || echo "")

# If no file path found, try alternative parsing
if [ -z "$FILE_PATH" ]; then
    FILE_PATH=$(echo "$TOOL_INPUT" | sed -n 's/.*"file_path"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' 2>/dev/null || echo "")
fi

# Skip if no file path
if [ -z "$FILE_PATH" ]; then
    exit 0
fi

# Skip if file doesn't exist
if [ ! -f "$FILE_PATH" ]; then
    exit 0
fi

# Get file extension
EXT="${FILE_PATH##*.}"

# Format based on file type
case "$EXT" in
    js|jsx|ts|tsx|json|css|scss|md|html|yaml|yml)
        # Check if Prettier is available
        if command -v npx &> /dev/null && [ -f "package.json" ]; then
            if grep -qE '"prettier"' package.json 2>/dev/null || [ -f ".prettierrc" ] || [ -f ".prettierrc.json" ]; then
                echo "Formatting with Prettier: $FILE_PATH"
                npx prettier --write "$FILE_PATH" 2>/dev/null || true
            fi
        fi
        ;;
    py)
        # Check if Black or Ruff is available
        if command -v ruff &> /dev/null; then
            echo "Formatting with Ruff: $FILE_PATH"
            ruff format "$FILE_PATH" 2>/dev/null || true
        elif command -v black &> /dev/null; then
            echo "Formatting with Black: $FILE_PATH"
            black "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    go)
        # Check if gofmt is available
        if command -v gofmt &> /dev/null; then
            echo "Formatting with gofmt: $FILE_PATH"
            gofmt -w "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
    rs)
        # Check if rustfmt is available
        if command -v rustfmt &> /dev/null; then
            echo "Formatting with rustfmt: $FILE_PATH"
            rustfmt "$FILE_PATH" 2>/dev/null || true
        fi
        ;;
esac

exit 0
