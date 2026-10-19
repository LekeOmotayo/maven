import { PiiScrubber } from '../src/security/scrubber';

describe('PiiScrubber', () => {
  let scrubber: PiiScrubber;

  beforeEach(() => {
    scrubber = new PiiScrubber();
  });

  it('redacts AWS Access Keys', () => {
    const raw = 'const awsKey = "AKIAIOSFODNN7EXAMPLE";';
    const result = scrubber.scrub(raw);

    expect(result.cleanText).not.toContain('AKIAIOSFODNN7EXAMPLE');
    expect(result.cleanText).toContain('[REDACTED_AWS_KEY:1]');
    expect(result.totalRedacted).toBe(1);
    expect(result.redactions[0].type).toBe('API_KEY');
  });

  it('redacts GitHub Personal Access Tokens', () => {
    const raw = 'const token = "ghp_1234567890abcdefghijklmnopqrstuvwxyz";';
    const result = scrubber.scrub(raw);

    expect(result.cleanText).not.toContain('ghp_1234567890abcdefghijklmnopqrstuvwxyz');
    expect(result.cleanText).toContain('[REDACTED_GITHUB_PAT:1]');
    expect(result.totalRedacted).toBe(1);
  });

  it('redacts OpenAI API Keys', () => {
    const raw = 'export const OPENAI_API_KEY = "sk-testmockopenaisamplekeynotreal9999";';
    const result = scrubber.scrub(raw);

    expect(result.cleanText).not.toContain('sk-testmockopenaisamplekeynotreal9999');
    expect(result.cleanText).toContain('[REDACTED_OPENAI_KEY:1]');
  });

  it('redacts Private RSA Keys', () => {
    const raw = `
      const key = \`-----BEGIN RSA PRIVATE KEY-----
      MIIEowIBAAKCAQEA0Y7b...
      -----END RSA PRIVATE KEY-----\`;
    `;
    const result = scrubber.scrub(raw);

    expect(result.cleanText).not.toContain('-----BEGIN RSA PRIVATE KEY-----');
    expect(result.cleanText).toContain('[REDACTED_PRIVATE_KEY:1]');
    expect(result.totalRedacted).toBe(1);
  });

  it('redacts PII: emails, SSNs, and phone numbers', () => {
    const raw = `
      // Developer contact: john.doe@enterprise.com
      // Tax ID: 123-45-6789
      // Direct line: +1 (555) 234-5678
      // Internal Host: 192.168.1.100
    `;
    const result = scrubber.scrub(raw);

    expect(result.cleanText).not.toContain('john.doe@enterprise.com');
    expect(result.cleanText).toContain('[REDACTED_EMAIL:1]');

    expect(result.cleanText).not.toContain('123-45-6789');
    expect(result.cleanText).toContain('[REDACTED_SSN:1]');

    expect(result.cleanText).not.toContain('+1 (555) 234-5678');
    expect(result.cleanText).toContain('[REDACTED_PHONE:1]');

    expect(result.cleanText).not.toContain('192.168.1.100');
    expect(result.cleanText).toContain('[REDACTED_IP:1]');

    expect(result.totalRedacted).toBe(4);
  });

  it('leaves clean source code unredacted', () => {
    const cleanCode = 'function add(a: number, b: number): number { return a + b; }';
    const result = scrubber.scrub(cleanCode);

    expect(result.cleanText).toBe(cleanCode);
    expect(result.totalRedacted).toBe(0);
    expect(result.redactions.length).toBe(0);
  });
});
