import { LLMReviewClient } from '../src/llm/client';
import { CodeSnippetBatch } from '../src/types';

describe('LLMReviewClient', () => {
  it('correctly produces mock findings for known vulnerability patterns in mock mode', async () => {
    const client = new LLMReviewClient({ isMockMode: true });

    const batch: CodeSnippetBatch = {
      batchId: 'batch-test-1',
      totalEstimatedTokens: 50,
      files: [
        {
          filename: 'src/db.ts',
          hunkHeaders: ['@@ -1,5 +1,5 @@'],
          content: '@@ -1,5 +1,5 @@\n+const query = "SELECT * FROM users WHERE id = " + id;',
          lineMappings: [{ relativeLineIndex: 1, actualNewLineNumber: 15 }],
        },
      ],
    };

    const findings = await client.reviewBatch(batch);

    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('CRITICAL');
    expect(findings[0].category).toBe('SECURITY');
    expect(findings[0].cweId).toBe('CWE-89');
    expect(findings[0].line).toBe(15);
    expect(findings[0].suggestion).toBeDefined();
  });

  it('detects unhandled promises and flags as bug in mock mode', async () => {
    const client = new LLMReviewClient({ isMockMode: true });

    const batch: CodeSnippetBatch = {
      batchId: 'batch-test-2',
      totalEstimatedTokens: 40,
      files: [
        {
          filename: 'src/api.ts',
          hunkHeaders: ['@@ -10,3 +10,4 @@'],
          content: '@@ -10,3 +10,4 @@\n+fetchUser(id).then((user) => render(user));',
          lineMappings: [{ relativeLineIndex: 1, actualNewLineNumber: 12 }],
        },
      ],
    };

    const findings = await client.reviewBatch(batch);
    expect(findings.length).toBe(1);
    expect(findings[0].severity).toBe('HIGH');
    expect(findings[0].category).toBe('BUG');
    expect(findings[0].cweId).toBe('CWE-391');
  });
});
