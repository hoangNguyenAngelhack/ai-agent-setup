import { describe, expect, it } from 'vitest';
import { redactText, redactValue } from '../../../src/shared/redact';

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
