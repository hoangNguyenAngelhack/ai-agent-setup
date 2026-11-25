import { describe, expect, it } from 'vitest';
import { redactJsonLine, redactText, redactValue } from '../../../src/shared/redact';

// Synthetic values only; none of them is a real credential.
const GITHUB = `ghp_${'a1B2'.repeat(9)}`;
const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.c2lnbmF0dXJlc2lnbmF0dXJl'; // secret-scan:allow synthetic fixture

describe('redactText', () => {
  it.each([
    ['github token', `push with ${GITHUB} now`, 'github-token'],
    ['jwt', `value ${JWT}`, 'jwt'],
    ['aws key', 'AKIAABCDEFGHIJKLMNOP', 'aws-access-key'], // secret-scan:allow synthetic fixture
    ['bearer', 'Authorization: Bearer abcdefghijklmnop', 'bearer'], // secret-scan:allow synthetic fixture
    ['assignment', 'DB_PASSWORD=hunter2hunter2', 'assignment'],
    ['url credentials', 'postgres://admin:s3cret@db:5432/app', 'url-credentials'], // secret-scan:allow synthetic fixture
    ['email', 'contact jane.doe@example.com', 'email'],
    ['phone', 'call +84 912 345 678', 'phone'],
    ['private key', '-----BEGIN RSA PRIVATE KEY-----\nMIIB\n-----END RSA PRIVATE KEY-----', 'private-key'], // secret-scan:allow synthetic fixture
  ])('should redact a %s', (_name, input, label) => {
    const result = redactText(input);

    expect(result.redactions[label]).toBeGreaterThan(0);
    expect(result.text).toContain('[REDACTED');
  });

  it('should keep the secret value out of the output', () => {
    expect(redactText(`x ${GITHUB} DB_PASSWORD=hunter2hunter2`).text).not.toMatch(/a1B2a1B2|hunter2/);
    expect(redactText('Authorization: Bearer abcdefghijklmnop').text).toBe('Authorization: Bearer [REDACTED:bearer]'); // secret-scan:allow synthetic fixture
  });

  it('should leave ordinary output alone', () => {
    const log = 'Tests  435 passed (435)\nDuration 12.3s at 2026-11-24T10:00:00Z exit code 0';

    expect(redactText(log)).toEqual({ text: log, redactions: {} });
  });

  it('should redact every string inside a JSON value', () => {
    expect(redactValue({ list: ['jane.doe@example.com'], nested: { n: 1, note: `token=${GITHUB}` } })).toEqual({
      list: ['[REDACTED:email]'],
      nested: { n: 1, note: 'token=[REDACTED:assignment]' },
    });
  });
});

describe('redactJsonLine', () => {
  // Every secret below must be gone from the stored line, and the line must stay valid JSON.
  const SECRETS = [GITHUB, 'hunter2hunter2', 'abcdefghijklmnop', 's3cret', 'jane.doe@example.com', '4242'];
  const lines = [
    // Usage line of a host stream: the regex on raw text broke the JSON here.
    { type: 'assistant', message: { id: 'm1', usage: { input_tokens: 12, output_tokens: 7 } } },
    // Secrets inside string values, nested arrays and command text.
    { type: 'item.completed', item: { text: `export GITHUB_TOKEN=${GITHUB}`, args: ['--url', 'postgres://admin:s3cret@db:5432/app'] } }, // secret-scan:allow synthetic fixture
    { headers: { authorization: 'Bearer abcdefghijklmnop' }, owner: 'jane.doe@example.com' }, // secret-scan:allow synthetic fixture
    // Values under sensitive key names, whatever their type.
    { db_password: 'hunter2hunter2', api_key: 4242, nested: [{ access_key: true }] },
  ];

  it.each(lines.map((line) => [JSON.stringify(line).slice(0, 40), JSON.stringify(line)]))('should keep %s… valid JSON and remove its secrets', (_name, line) => {
    const stored = redactJsonLine(line);
    expect(() => JSON.parse(stored) as unknown).not.toThrow();
    for (const secret of SECRETS) expect(stored).not.toContain(secret);
  });

  it('should be at least as strict as redactText on the same line', () => {
    for (const line of lines.map((item) => JSON.stringify(item))) {
      for (const secret of SECRETS.filter((item) => !redactText(line).text.includes(item))) expect(redactJsonLine(line)).not.toContain(secret);
    }
    // Escaped characters are decoded before the rules run, so an escaped secret is caught too.
    const escaped = `{"note":"\\u0067${GITHUB.slice(1)}"}`;
    expect(redactJsonLine(escaped)).not.toContain(GITHUB.slice(4));
  });

  it('should keep ordinary fields and shape, and redact as text a line that is not a JSON object', () => {
    expect(JSON.parse(redactJsonLine('{"type":"result","subtype":"success","usage":{"output_tokens":7},"total_cost_usd":0.5}'))).toEqual({
      type: 'result',
      subtype: 'success',
      usage: { output_tokens: '[REDACTED:assignment]' },
      total_cost_usd: 0.5,
    });
    expect(redactJsonLine(`plain text DB_PASSWORD=hunter2hunter2`)).toBe(redactText('plain text DB_PASSWORD=hunter2hunter2').text);
    expect(redactJsonLine('{not json')).toBe('{not json');
    expect(redactJsonLine('"jane.doe@example.com"')).toBe(redactText('"jane.doe@example.com"').text);
  });
});

