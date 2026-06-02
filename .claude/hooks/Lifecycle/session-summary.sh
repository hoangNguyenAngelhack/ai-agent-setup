#!/bin/bash
# Hook: session-summary
# Type: Lifecycle
# Event: Stop
# Purpose: Log session summary when Claude Code session ends

# Don't exit on error
set +e

LOG_FILE="/tmp/claude-session.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

echo "----------------------------------------" >> "$LOG_FILE"
echo "Session ended: $TIMESTAMP" >> "$LOG_FILE"
echo "Working directory: $(pwd)" >> "$LOG_FILE"

# Get git status if in a repo
if git rev-parse --git-dir > /dev/null 2>&1; then
    BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    echo "Git branch: $BRANCH" >> "$LOG_FILE"

    # Count uncommitted changes
    CHANGES=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    echo "Uncommitted changes: $CHANGES" >> "$LOG_FILE"

    # Get recent commits in this session (last hour)
    RECENT_COMMITS=$(git log --oneline --since="1 hour ago" 2>/dev/null | wc -l | tr -d ' ')
    echo "Commits in last hour: $RECENT_COMMITS" >> "$LOG_FILE"

    if [ "$RECENT_COMMITS" -gt 0 ]; then
        echo "Recent commits:" >> "$LOG_FILE"
        git log --oneline --since="1 hour ago" 2>/dev/null | head -5 | while read line; do
            echo "  - $line" >> "$LOG_FILE"
        done
    fi
fi

# Get modified files in the last hour
echo "Files modified recently:" >> "$LOG_FILE"
find . -type f -mmin -60 \
    -not -path './.git/*' \
    -not -path './node_modules/*' \
    -not -path './.next/*' \
    -not -path './dist/*' \
    -not -path './build/*' \
    2>/dev/null | head -10 | while read file; do
    echo "  - $file" >> "$LOG_FILE"
done

echo "----------------------------------------" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Print summary to console
echo ""
echo "Session summary saved to $LOG_FILE"
echo "Branch: ${BRANCH:-N/A} | Changes: ${CHANGES:-0} | Recent commits: ${RECENT_COMMITS:-0}"

exit 0
