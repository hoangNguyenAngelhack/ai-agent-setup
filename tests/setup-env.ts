import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Tests never touch the user's real key directory (ADR-016): every test process, and the CLI child
 * processes it starts, use a temporary one.
 */
process.env.AI_AGENT_SETUP_KEY_DIR ??= mkdtempSync(join(tmpdir(), 'ai-agent-setup-keys-'));
