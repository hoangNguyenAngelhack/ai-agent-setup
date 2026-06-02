#!/bin/bash
# Hook: lint-check
# Type: PreToolUse
# Trigger: Bash(git commit)
# Purpose: Run linter before git commit

set -e

# Check if this is a git commit command
if ! echo "$TOOL_INPUT" | grep -q "git commit"; then
    exit 0
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    exit 0
fi

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM 2>/dev/null || true)

if [ -z "$STAGED_FILES" ]; then
    exit 0
fi

echo "Running pre-commit checks on staged files..."

# Check for JavaScript/TypeScript files
JS_TS_FILES=$(echo "$STAGED_FILES" | grep -E '\.(js|jsx|ts|tsx)$' || true)

if [ -n "$JS_TS_FILES" ]; then
    # Check if ESLint is available
    if command -v npx &> /dev/null && [ -f "package.json" ]; then
        if grep -q '"eslint"' package.json 2>/dev/null; then
            echo "Checking ESLint..."
            if ! npx eslint $JS_TS_FILES --quiet 2>/dev/null; then
                echo ""
                echo "ESLint found issues. Please fix them before committing."
                echo "Run: npx eslint --fix <files>"
                # Log to file
                echo "[$(date '+%Y-%m-%d %H:%M:%S')] LINT: ESLint issues found" >> /tmp/claude-hooks.log
                # Warning only, don't block
                exit 0
            fi
        fi
    fi
fi

# Check for Python files
PY_FILES=$(echo "$STAGED_FILES" | grep -E '\.py$' || true)

if [ -n "$PY_FILES" ]; then
    # Check if ruff or flake8 is available
    if command -v ruff &> /dev/null; then
        echo "Checking Ruff..."
        if ! ruff check $PY_FILES 2>/dev/null; then
            echo ""
            echo "Ruff found issues. Please fix them before committing."
            echo "Run: ruff check --fix <files>"
            exit 0
        fi
    elif command -v flake8 &> /dev/null; then
        echo "Checking Flake8..."
        if ! flake8 $PY_FILES 2>/dev/null; then
            echo ""
            echo "Flake8 found issues. Please fix them before committing."
            exit 0
        fi
    fi
fi

echo "Pre-commit checks passed."
exit 0
