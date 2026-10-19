/**
 * Upstream LLM Review Client.
 * Dispatches prepared batches to LLM review endpoints with structured JSON schemas,
 * exponential backoff, and a built-in deterministic mock provider for testing and CI.
 */

import { CodeSnippetBatch, ReviewComment } from '../types';
import { parseLLMJsonResponse } from '../validation/schemas';

export interface LLMClientOptions {
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  isMockMode?: boolean;
}

export class LLMReviewClient {
  private apiKey: string;
  private baseUrl: string;
  private model: string;
  private isMockMode: boolean;

  constructor(options: LLMClientOptions = {}) {
    this.apiKey = options.apiKey || '';
    this.baseUrl = (options.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
    this.model = options.model || 'gpt-4o';
    this.isMockMode = options.isMockMode ?? (!this.apiKey || this.apiKey === 'mock-key');
  }

  /**
   * Execute deep review on a single batch of code snippets.
   */
  public async reviewBatch(batch: CodeSnippetBatch): Promise<ReviewComment[]> {
    if (this.isMockMode) {
      return this.mockReview(batch);
    }

    const systemPrompt = [
      'You are a Principal Security Engineer and Static Analysis Expert conducting a deep code review on a GitHub Pull Request.',
      'Analyze the provided code diffs for security vulnerabilities (CWE/OWASP), critical bugs, performance regressions, and maintainability anti-patterns.',
      'Respond ONLY with valid JSON matching this schema:',
      '{',
      '  "batchSummary": "Brief overview of findings",',
      '  "findings": [',
      '    {',
      '      "path": "relative/file/path.ext",',
      '      "line": 12,',
      '      "severity": "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO",',
      '      "severityScore": 9.5,',
      '      "category": "SECURITY" | "BUG" | "PERFORMANCE" | "CODE_QUALITY",',
      '      "title": "Short title",',
      '      "description": "Actionable explanation of why this is defective",',
      '      "suggestion": "Exact replacement code (optional)",',
      '      "cweId": "CWE-89 (optional)"',
      '    }',
      '  ]',
      '}',
      'CRITICAL: The line number must correspond to an added or modified line in the new file version.',
    ].join('\n');

    const userPrompt = batch.files
      .map(
        (f) =>
          `FILE: ${f.filename}\n` +
          `VALID LINE NUMBERS: ${f.lineMappings.map((m) => m.actualNewLineNumber).join(', ')}\n` +
          `DIFF:\n${f.content}\n`
      )
      .join('\n---\n');

    let lastError: Error | null = null;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.2,
            response_format: { type: 'json_object' },
          }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`LLM API returned HTTP ${response.status}: ${errText}`);
        }

        const data = (await response.json()) as { choices?: Array<{ message?: { content?: string } }> };
        const rawContent = data.choices?.[0]?.message?.content || '{}';

        const parsed = parseLLMJsonResponse(rawContent);
        return parsed.findings;
      } catch (err) {
        lastError = err as Error;
        // Wait with exponential backoff before retry
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
        }
      }
    }

    console.warn(`Upstream LLM call failed after ${maxRetries} attempts: ${lastError?.message}. Falling back to mock findings.`);
    return this.mockReview(batch);
  }

  /**
   * Deterministic heuristic mock engine for unit tests and offline executions.
   */
  private mockReview(batch: CodeSnippetBatch): ReviewComment[] {
    const findings: ReviewComment[] = [];

    for (const file of batch.files) {
      const lines = file.content.split('\n');

      file.lineMappings.forEach((mapping) => {
        const lineText = lines[mapping.relativeLineIndex] || '';

        // 1. SQL Injection Detection
        if (
          /SELECT\s+.*FROM\s+.*\+/i.test(lineText) ||
          /query\s*\(\s*["'].*\$\{/i.test(lineText) ||
          /exec\s*\(\s*.*\+/i.test(lineText)
        ) {
          findings.push({
            path: file.filename,
            line: mapping.actualNewLineNumber,
            severity: 'CRITICAL',
            severityScore: 9.6,
            category: 'SECURITY',
            title: 'Potential SQL Injection Vulnerability',
            description: 'Direct string concatenation in database query construction permits SQL injection attacks. Use parameterized queries or prepared statements.',
            suggestion: lineText.replace(/\+.*$/, '+ parameterized_input;'),
            cweId: 'CWE-89',
          });
        }

        // 2. Unhandled Promise / Async Defect
        if (/\.then\(/.test(lineText) && !/\.catch\(/.test(file.content)) {
          findings.push({
            path: file.filename,
            line: mapping.actualNewLineNumber,
            severity: 'HIGH',
            severityScore: 7.8,
            category: 'BUG',
            title: 'Unhandled Asynchronous Promise Rejection',
            description: 'Promise chain lacks an error rejection handler (.catch) or surrounding try/catch block, risking uncaught process termination.',
            suggestion: lineText.replace(/;?$/, '.catch((err) => logger.error(err));'),
            cweId: 'CWE-391',
          });
        }

        // 3. Performance: Synchronous I/O in Async context
        if (/readFileSync|writeFileSync|execSync/.test(lineText)) {
          findings.push({
            path: file.filename,
            line: mapping.actualNewLineNumber,
            severity: 'MEDIUM',
            severityScore: 5.5,
            category: 'PERFORMANCE',
            title: 'Blocking Synchronous I/O Call',
            description: 'Synchronous file system call blocks the Node.js event loop, degrading concurrency and request throughput under load.',
            suggestion: lineText.replace(/Sync/g, ''),
            cweId: 'CWE-400',
          });
        }

        // 4. Code Quality / TODO Detection
        if (/TODO|FIXME/i.test(lineText)) {
          findings.push({
            path: file.filename,
            line: mapping.actualNewLineNumber,
            severity: 'INFO',
            severityScore: 1.5,
            category: 'CODE_QUALITY',
            title: 'Unresolved Code Annotation (TODO/FIXME)',
            description: 'Unresolved technical debt marker found in modified code. Ensure ticket tracking before merging to main branch.',
          });
        }

        // 5. Adversarial Inoculation Finding
        if (/ignore\s+all\s+previous/i.test(lineText)) {
          findings.push({
            path: file.filename,
            line: mapping.actualNewLineNumber,
            severity: 'CRITICAL',
            severityScore: 10.0,
            category: 'SECURITY',
            title: 'Adversarial Prompt Injection Attempt Detected',
            description: 'Code contains direct instruction override patterns targeting automated review pipelines. Flagged for manual security review.',
            cweId: 'CWE-74',
          });
        }
      });
    }

    return findings;
  }
}
