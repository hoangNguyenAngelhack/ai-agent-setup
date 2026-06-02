#!/bin/bash
# Hook: security-scan
# Type: PreToolUse
# Trigger: Write, Edit
# Purpose: Scan for secrets/credentials before writing to files

set -e

# Patterns that indicate potential secrets
SECRET_PATTERNS=(
    # API Keys
    'AKIA[0-9A-Z]{16}'                          # AWS Access Key
    'sk-[a-zA-Z0-9]{48}'                        # OpenAI API Key
    'sk_live_[a-zA-Z0-9]{24}'                   # Stripe Live Key
    'sk_test_[a-zA-Z0-9]{24}'                   # Stripe Test Key
    'ghp_[a-zA-Z0-9]{36}'                       # GitHub Personal Token
    'gho_[a-zA-Z0-9]{36}'                       # GitHub OAuth Token
    'xoxb-[a-zA-Z0-9-]+'                        # Slack Bot Token
    'xoxp-[a-zA-Z0-9-]+'                        # Slack User Token

    # Generic patterns
    'password\s*[:=]\s*["\x27][^"\x27]{8,}'     # Password assignments
    'secret\s*[:=]\s*["\x27][^"\x27]{8,}'       # Secret assignments
    'api_key\s*[:=]\s*["\x27][^"\x27]{8,}'      # API key assignments
    'token\s*[:=]\s*["\x27][^"\x27]{8,}'        # Token assignments

    # Private keys
    '-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'
    '-----BEGIN PGP PRIVATE KEY BLOCK-----'
)

# Get the content being written
CONTENT="$TOOL_INPUT"

# Skip if no content
if [ -z "$CONTENT" ]; then
    exit 0
fi

# Check each pattern
FOUND_SECRETS=()
for pattern in "${SECRET_PATTERNS[@]}"; do
    if echo "$CONTENT" | grep -qiE "$pattern" 2>/dev/null; then
        FOUND_SECRETS+=("$pattern")
    fi
done

# Report findings
if [ ${#FOUND_SECRETS[@]} -gt 0 ]; then
    echo "WARNING: Potential secrets detected!"
    echo "Found ${#FOUND_SECRETS[@]} pattern(s) that may indicate secrets."
    echo ""
    echo "Patterns matched:"
    for secret in "${FOUND_SECRETS[@]}"; do
        echo "  - $secret"
    done
    echo ""
    echo "Please review the content before committing."
    echo "If these are intentional (e.g., examples), consider:"
    echo "  - Using placeholder values like 'your-api-key-here'"
    echo "  - Moving secrets to environment variables"
    echo ""
    # Log to file
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SECURITY: Potential secrets found" >> /tmp/claude-hooks.log
    # Exit with warning but don't block (exit 0)
    # Change to exit 1 if you want to block
    exit 0
fi

exit 0
