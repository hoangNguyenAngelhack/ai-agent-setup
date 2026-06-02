#!/bin/bash
# Hook: cost-tracker
# Type: Lifecycle
# Event: Stop
# Purpose: Track and log session cost/token usage

# Don't exit on error
set +e

LOG_FILE="/tmp/claude-cost.log"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
SESSION_ID="${CLAUDE_SESSION_ID:-$(date +%s)}"

# Note: Actual token counts would come from Claude Code's internal tracking
# This hook provides a placeholder for manual tracking or future integration

echo "----------------------------------------" >> "$LOG_FILE"
echo "Session: $SESSION_ID" >> "$LOG_FILE"
echo "Ended: $TIMESTAMP" >> "$LOG_FILE"
echo "Working directory: $(pwd)" >> "$LOG_FILE"

# Track session duration if start time was recorded
START_FILE="/tmp/claude-session-start-$SESSION_ID"
if [ -f "$START_FILE" ]; then
    START_TIME=$(cat "$START_FILE")
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))
    echo "Duration: ${MINUTES}m ${SECONDS}s" >> "$LOG_FILE"
    rm -f "$START_FILE"
fi

# Estimate based on activity (rough heuristic)
# Count files changed in this session
FILES_CHANGED=$(git diff --name-only HEAD~5 2>/dev/null | wc -l | tr -d ' ' || echo "0")
echo "Files changed: $FILES_CHANGED" >> "$LOG_FILE"

# Count lines changed
LINES_ADDED=$(git diff --stat HEAD~5 2>/dev/null | tail -1 | grep -oP '\d+(?= insertion)' || echo "0")
LINES_DELETED=$(git diff --stat HEAD~5 2>/dev/null | tail -1 | grep -oP '\d+(?= deletion)' || echo "0")
echo "Lines: +${LINES_ADDED:-0} / -${LINES_DELETED:-0}" >> "$LOG_FILE"

echo "----------------------------------------" >> "$LOG_FILE"
echo "" >> "$LOG_FILE"

# Print to console
echo ""
echo "Session cost tracking saved to $LOG_FILE"
echo "Files changed: ${FILES_CHANGED} | Lines: +${LINES_ADDED:-0}/-${LINES_DELETED:-0}"
echo ""
echo "Note: For actual token usage, check your Anthropic Console:"
echo "https://console.anthropic.com/settings/usage"

exit 0
