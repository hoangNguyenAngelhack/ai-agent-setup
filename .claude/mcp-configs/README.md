# MCP Server Configurations

Pre-configured Model Context Protocol (MCP) servers for common development services.

## What is MCP?

MCP (Model Context Protocol) allows Claude Code to interact with external services like databases, deployment platforms, and automation tools.

## Available Configurations

| File | Description |
|------|-------------|
| `mcp-servers.json` | Full collection of MCP servers |
| `mcp-servers.minimal.json` | Minimal set for most projects |
| `.env.example` | Required environment variables |

## Quick Start

1. **Copy the config you need:**

```bash
# Full collection
cp .claude/mcp-configs/mcp-servers.json ~/.claude/mcp-servers.json

# Or minimal set
cp .claude/mcp-configs/mcp-servers.minimal.json ~/.claude/mcp-servers.json
```

2. **Set up environment variables:**

```bash
# Copy the example file
cp .claude/mcp-configs/.env.example ~/.claude/.env

# Edit with your actual values
nano ~/.claude/.env
```

3. **Restart Claude Code** to load the new servers.

## Available Servers

### Database & Storage

| Server | Purpose | Priority |
|--------|---------|----------|
| **Supabase** | PostgreSQL database, auth, storage | HIGH |
| **Upstash** | Redis/Kafka serverless | MEDIUM |

### Deployment & Infrastructure

| Server | Purpose | Priority |
|--------|---------|----------|
| **Vercel** | Deploy & preview | HIGH |
| **Railway** | App deployment | MEDIUM |
| **Cloudflare** | Workers, KV, R2 | MEDIUM |

### Automation & Testing

| Server | Purpose | Priority |
|--------|---------|----------|
| **Playwright** | Browser automation, E2E | HIGH |
| **Browserbase** | Cloud browsers | LOW |

### Development Tools

| Server | Purpose | Priority |
|--------|---------|----------|
| **GitHub** | Enhanced git operations | HIGH |
| **Linear** | Issue tracking | MEDIUM |
| **Sentry** | Error tracking | MEDIUM |

### Communication

| Server | Purpose | Priority |
|--------|---------|----------|
| **Resend** | Email sending | LOW |
| **Slack** | Team notifications | LOW |

### Payments

| Server | Purpose | Priority |
|--------|---------|----------|
| **Stripe** | Payment processing | LOW |

## Best Practices

### Keep Under 10 MCPs

Each enabled MCP consumes context window space. For optimal performance:

- Enable only servers you actively use
- Disable servers after project-specific work
- Use the minimal config for most projects

### Security

- **Never commit** `.env` files with real credentials
- Use environment variables for all secrets
- Rotate API keys periodically
- Use read-only tokens where possible

### Per-Project Configuration

For project-specific MCPs, use `.claude/settings.json`:

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": ["-y", "@supabase/mcp-server"],
      "env": {
        "SUPABASE_URL": "${SUPABASE_URL}",
        "SUPABASE_KEY": "${SUPABASE_KEY}"
      }
    }
  }
}
```

## Troubleshooting

### Server not connecting?

1. Check environment variables are set correctly
2. Verify the MCP server package is installed
3. Check Claude Code logs for errors
4. Try restarting Claude Code

### High context usage?

1. Reduce number of enabled MCPs
2. Use the minimal configuration
3. Disable unused servers

### Authentication errors?

1. Verify API keys are correct
2. Check token permissions/scopes
3. Ensure tokens haven't expired

## Adding Custom Servers

To add your own MCP server:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@my-org/mcp-server"],
      "env": {
        "MY_API_KEY": "${MY_API_KEY}"
      }
    }
  }
}
```

## Resources

- [MCP Documentation](https://modelcontextprotocol.io/)
- [Claude Code MCP Guide](https://docs.anthropic.com/en/docs/claude-code/mcp)
- [MCP Server Registry](https://github.com/modelcontextprotocol/servers)
