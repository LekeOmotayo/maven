import {
  ActionInputSchema,
  parseLLMJsonResponse,
  ReviewCommentSchema,
} from '../src/validation/schemas';

describe('Zod Validation Schemas', () => {
  it('validates compliant review comment object', () => {
    const validComment = {
      path: 'src/api/auth.ts',
      line: 42,
      severity: 'CRITICAL',
      severityScore: 9.5,
      category: 'SECURITY',
      title: 'SQL Injection via query concatenation',
      description: 'Concatenating raw inputs allows attackers to execute arbitrary SQL commands.',
      suggestion: 'const user = await db.query("SELECT * FROM users WHERE id = $1", [id]);',
      cweId: 'CWE-89',
    };

    expect(() => ReviewCommentSchema.parse(validComment)).not.toThrow();
  });

  it('rejects invalid severity score outside 1.0 - 10.0 range', () => {
    const invalidComment = {
      path: 'src/api/auth.ts',
      line: 42,
      severity: 'CRITICAL',
      severityScore: 12.5, // Invalid > 10
      category: 'SECURITY',
      title: 'Invalid score',
      description: 'Test description with sufficient length',
    };

    expect(() => ReviewCommentSchema.parse(invalidComment)).toThrow();
  });

  it('parses raw and markdown-wrapped JSON LLM output', () => {
    const markdownWrapped = [
      '```json',
      '{',
      '  "batchSummary": "Review finished with 1 finding",',
      '  "findings": [',
      '    {',
      '      "path": "src/app.ts",',
      '      "line": 15,',
      '      "severity": "HIGH",',
      '      "severityScore": 8.0,',
      '      "category": "BUG",',
      '      "title": "Unhandled promise",',
      '      "description": "Missing catch block on async call",',
      '      "suggestion": "promise.catch(console.error)"',
      '    }',
      '  ]',
      '}',
      '```',
    ].join('\n');

    const parsed = parseLLMJsonResponse(markdownWrapped);
    expect(parsed.findings.length).toBe(1);
    expect(parsed.findings[0].severity).toBe('HIGH');
  });

  it('validates ActionInputSchema with default values', () => {
    const rawInputs = {
      githubToken: 'ghp_test123',
      owner: 'acme-corp',
      repo: 'payment-service',
      pullNumber: 101,
      commitSha: 'abcdef1234567890',
    };

    const config = ActionInputSchema.parse(rawInputs);
    expect(config.model).toBe('gpt-4o');
    expect(config.maxTokensPerBatch).toBe(4000);
    expect(config.severityThreshold).toBe('LOW');
    expect(config.enablePiiScrubbing).toBe(true);
  });
});
