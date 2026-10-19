import { CommentFormatter } from '../src/formatters/commentFormatter';
import { ReviewComment, ReviewSummary } from '../src/types';

describe('CommentFormatter', () => {
  it('formats inline comment with severity badge and GitHub suggestion block', () => {
    const comment: ReviewComment = {
      path: 'src/user.ts',
      line: 25,
      severity: 'CRITICAL',
      severityScore: 9.8,
      category: 'SECURITY',
      title: 'SQL Injection Vulnerability',
      description: 'Concatenating unsanitized input allows SQL injection.',
      suggestion: 'const user = await db.query(sql, [id]);',
      cweId: 'CWE-89',
    };

    const formatted = CommentFormatter.formatInlineComment(comment);

    expect(formatted).toContain('🛡️ **[CRITICAL]**');
    expect(formatted).toContain('Score: 9.8/10');
    expect(formatted).toContain('**Category**: `SECURITY` | **CWE**: `CWE-89`');
    expect(formatted).toContain('```suggestion');
    expect(formatted).toContain('const user = await db.query(sql, [id]);');
  });

  it('formats review summary markdown with metrics table and decision banner', () => {
    const summary: ReviewSummary = {
      status: 'CHANGES_REQUESTED',
      totalComments: 3,
      severityCounts: {
        CRITICAL: 1,
        HIGH: 1,
        MEDIUM: 1,
        LOW: 0,
        INFO: 0,
      },
      categoryCounts: {
        SECURITY: 1,
        BUG: 1,
        PERFORMANCE: 1,
        CODE_QUALITY: 0,
      },
      summaryMarkdown: '',
      promptInjectionDetected: false,
      totalRedactions: 2,
    };

    const formatted = CommentFormatter.formatReviewSummary(summary);

    expect(formatted).toContain('## ❌ Automated Deep Code Review Summary');
    expect(formatted).toContain('**Review Decision**: `CHANGES_REQUESTED`');
    expect(formatted).toContain('| **Critical Severity** | `1` | 🔴 Immediate Action Required |');
    expect(formatted).toContain('PII & Secrets Scrubbed**: `2`');
    expect(formatted).toContain('Clear (No Injections Found)');
  });
});
