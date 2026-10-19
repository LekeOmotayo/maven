/**
 * Actionable Comment and Summary Formatter.
 * Formats findings into GitHub-flavored markdown with automated security badges,
 * severity scores, and 1-click GitHub suggestion diff blocks.
 */

import { ReviewCategory, ReviewComment, ReviewSummary, SeverityLevel } from '../types';

export class CommentFormatter {
  /**
   * Return an emoji badge corresponding to severity level.
   */
  public static getSeverityBadge(severity: SeverityLevel): string {
    switch (severity) {
      case 'CRITICAL':
        return '🛡️ **[CRITICAL]**';
      case 'HIGH':
        return '⚠️ **[HIGH]**';
      case 'MEDIUM':
        return '⚡ **[MEDIUM]**';
      case 'LOW':
        return '💡 **[LOW]**';
      case 'INFO':
        return 'ℹ️ **[INFO]**';
    }
  }

  /**
   * Format an inline GitHub review comment body.
   */
  public static formatInlineComment(comment: ReviewComment): string {
    const badge = this.getSeverityBadge(comment.severity);
    const scoreFormatted = comment.severityScore.toFixed(1);

    const lines: string[] = [
      `### ${badge} ${comment.title} \`Score: ${scoreFormatted}/10\``,
      `**Category**: \`${comment.category}\`${comment.cweId ? ` | **CWE**: \`${comment.cweId}\`` : ''}`,
      '',
      `> 📝 **Impact Analysis**: ${comment.description}`,
      '',
    ];

    if (comment.suggestion && comment.suggestion.trim()) {
      lines.push('#### Suggested Fix:');
      lines.push('```suggestion');
      lines.push(comment.suggestion.trim());
      lines.push('```');
    }

    lines.push('', '---', '_Automated deep review by Enterprise AI Action_');

    return lines.join('\n');
  }

  /**
   * Format the top-level Pull Request review summary.
   */
  public static formatReviewSummary(summary: ReviewSummary): string {
    const statusIcon =
      summary.status === 'APPROVED'
        ? '✅'
        : summary.status === 'CHANGES_REQUESTED'
        ? '❌'
        : '💬';

    const lines: string[] = [
      `## ${statusIcon} Automated Deep Code Review Summary`,
      '',
      `**Review Decision**: \`${summary.status}\` | **Total Findings**: \`${summary.totalComments}\``,
      '',
      `| Metric | Count | Status Badge |`,
      `| :--- | :--- | :--- |`,
      `| **Critical Severity** | \`${summary.severityCounts.CRITICAL}\` | ${summary.severityCounts.CRITICAL > 0 ? '🔴 Immediate Action Required' : '🟢 None'} |`,
      `| **High Severity** | \`${summary.severityCounts.HIGH}\` | ${summary.severityCounts.HIGH > 0 ? '🟠 Review Recommended' : '🟢 None'} |`,
      `| **Medium Severity** | \`${summary.severityCounts.MEDIUM}\` | ${summary.severityCounts.MEDIUM > 0 ? '🟡 Notice' : '🟢 None'} |`,
      `| **Low / Info** | \`${summary.severityCounts.LOW + summary.severityCounts.INFO}\` | ⚪ Suggestions |`,
      '',
      `### 🛡️ Enterprise Security & Privacy Guardrails`,
      `- **PII & Secrets Scrubbed**: \`${summary.totalRedactions}\` sensitive tokens safely masked before LLM ingestion.`,
      `- **Prompt Injection Defense**: ${summary.promptInjectionDetected ? '⚠️ **Adversarial Pattern Detected & Inoculated**' : '✅ **Clear (No Injections Found)**'}.`,
      '',
      `### 📊 Findings by Category`,
      `- **Security**: \`${summary.categoryCounts.SECURITY}\``,
      `- **Bugs / Logic**: \`${summary.categoryCounts.BUG}\``,
      `- **Performance**: \`${summary.categoryCounts.PERFORMANCE}\``,
      `- **Code Quality**: \`${summary.categoryCounts.CODE_QUALITY}\``,
      '',
      '---',
      '_Review conducted with strict input/output validation and token-aware diff chunking._',
    ];

    return lines.join('\n');
  }
}
