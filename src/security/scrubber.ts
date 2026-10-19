/**
 * PII and Secret Scrubbing Middleware.
 * Detects and redacts credentials, private keys, API tokens, and PII
 * before sending source code to external LLM providers.
 */

import { RedactionRecord } from '../types';

export interface ScrubResult {
  cleanText: string;
  redactions: RedactionRecord[];
  totalRedacted: number;
}

export class PiiScrubber {
  // Ordered regex patterns for credentials and sensitive data
  private patterns: Array<{
    type: RedactionRecord['type'];
    regex: RegExp;
    prefix: string;
  }> = [
    // 1. Private Keys
    {
      type: 'PRIVATE_KEY',
      regex: /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g,
      prefix: 'REDACTED_PRIVATE_KEY',
    },
    // 2. AWS Access Key
    {
      type: 'API_KEY',
      regex: /\b(AKIA[0-9A-Z]{16})\b/g,
      prefix: 'REDACTED_AWS_KEY',
    },
    // 3. GitHub Tokens (Classic & Fine-Grained)
    {
      type: 'API_KEY',
      regex: /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{82})\b/g,
      prefix: 'REDACTED_GITHUB_PAT',
    },
    // 4. OpenAI API Keys
    {
      type: 'API_KEY',
      regex: /\b(sk-[a-zA-Z0-9T3BlbkFJ]{24,64})\b/g,
      prefix: 'REDACTED_OPENAI_KEY',
    },
    // 5. Slack Tokens
    {
      type: 'API_KEY',
      regex: /\b(xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,32})\b/g,
      prefix: 'REDACTED_SLACK_TOKEN',
    },
    // 6. Google API Key
    {
      type: 'API_KEY',
      regex: /\b(AIza[0-9A-Za-z\-_]{35})\b/g,
      prefix: 'REDACTED_GOOGLE_API_KEY',
    },
    // 7. JWT Tokens
    {
      type: 'SECRET',
      regex: /\b(eyJ[A-Za-z0-9-_]{10,}\.eyJ[A-Za-z0-9-_]{10,}\.[A-Za-z0-9-_]{10,})\b/g,
      prefix: 'REDACTED_JWT_TOKEN',
    },
    // 8. Explicit Hardcoded Secret / Password Assignments
    {
      type: 'SECRET',
      regex: /(?<=["']?(?:password|passwd|secret|api_key|apiKey|auth_token|authToken)["']?\s*[:=]\s*["'])(?!\[REDACTED_)([^"'\s]{6,})(?=["'])/gi,
      prefix: 'REDACTED_SECRET_VALUE',
    },
    // 9. Social Security Numbers (US)
    {
      type: 'SSN',
      regex: /\b(\d{3}-\d{2}-\d{4})\b/g,
      prefix: 'REDACTED_SSN',
    },
    // 10. Email Addresses
    {
      type: 'EMAIL',
      regex: /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
      prefix: 'REDACTED_EMAIL',
    },
    // 11. International Phone Numbers
    {
      type: 'PHONE',
      regex: /\b(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
      prefix: 'REDACTED_PHONE',
    },
    // 12. Public/Private IPv4 Addresses (Excluding loopback 127.0.0.1 and broadcast 0.0.0.0)
    {
      type: 'IP_ADDRESS',
      regex: /\b((?!127\.0\.0\.1|0\.0\.0\.0)(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?))\b/g,
      prefix: 'REDACTED_IP',
    },
  ];

  /**
   * Scans input text and replaces sensitive credentials and PII with safe placeholder tokens.
   */
  public scrub(text: string): ScrubResult {
    let cleanText = text;
    const redactionMap = new Map<string, RedactionRecord>();
    let totalRedacted = 0;

    for (const rule of this.patterns) {
      cleanText = cleanText.replace(rule.regex, (match) => {
        totalRedacted++;
        const currentCount = (redactionMap.get(rule.type)?.occurrenceCount || 0) + 1;
        const placeholder = `[${rule.prefix}:${currentCount}]`;

        redactionMap.set(rule.type, {
          type: rule.type,
          placeholder: `[${rule.prefix}]`,
          occurrenceCount: currentCount,
        });

        return placeholder;
      });
    }

    return {
      cleanText,
      redactions: Array.from(redactionMap.values()),
      totalRedacted,
    };
  }
}
