/**
 * Review Service layer orchestrating security defense, LLM analysis, and audit tracking.
 */

import { DiffParser } from '../diff/parser';
import { DiffBatcher } from '../diff/batcher';
import { CommentFormatter } from '../formatters/commentFormatter';
import { LLMReviewClient } from '../llm/client';
import { PromptInjectionDefense } from '../security/injectionDefense';
import { PiiScrubber } from '../security/scrubber';
import {
  DiffFile,
  ReviewCategory,
  ReviewComment,
  ReviewSummary,
  SeverityLevel,
} from '../types';
import { AuditRepository, AuditRecord } from '../repositories/auditRepository';

export interface ReviewExecutionOptions {
  diffText: string;
  filename?: string;
  enablePiiScrubbing?: boolean;
  enableInjectionDefense?: boolean;
  minSeverity?: SeverityLevel;
  model?: string;
  isMockMode?: boolean;
}

const severityHierarchy: Record<SeverityLevel, number> = {
  CRITICAL: 5,
  HIGH: 4,
  MEDIUM: 3,
  LOW: 2,
  INFO: 1,
};

export class ReviewService {
  private piiScrubber = new PiiScrubber();
  private injectionDefense = new PromptInjectionDefense();
  private diffBatcher = new DiffBatcher(4000);
  private auditRepo: AuditRepository;

  constructor(auditRepo?: AuditRepository) {
    this.auditRepo = auditRepo || new AuditRepository();
  }

  public getAuditRepo(): AuditRepository {
    return this.auditRepo;
  }

  public async executeReview(options: ReviewExecutionOptions): Promise<{
    summary: ReviewSummary;
    comments: ReviewComment[];
    redactions: number;
    promptInjectionDetected: boolean;
    auditId: string;
  }> {
    const filename = options.filename || 'src/index.ts';
    const enablePii = options.enablePiiScrubbing ?? true;
    const enableDefense = options.enableInjectionDefense ?? true;
    const minSeverity: SeverityLevel = options.minSeverity || 'LOW';
    const isMock = options.isMockMode ?? true;

    // 1. Parse diff into DiffFile structure using DiffParser
    const parser = new DiffParser();
    let diffFiles: DiffFile[] = [parser.parsePatch(filename, options.diffText)];

    if (diffFiles.length === 0) {
      diffFiles = [
        {
          filename,
          status: 'modified',
          additions: 10,
          deletions: 2,
          patch: options.diffText,
          hunks: [
            {
              header: '@@ -1,10 +1,10 @@',
              oldStart: 1,
              oldLines: 10,
              newStart: 1,
              newLines: 10,
              lines: options.diffText.split('\n').map((l, i) => ({
                type: l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : 'context',
                content: l.replace(/^[+-]/, ''),
                newLineNumber: i + 1,
              })),
            },
          ],
          estimatedTokens: Math.ceil(options.diffText.length / 4),
        },
      ];
    }

    const batches = this.diffBatcher.createBatches(diffFiles);
    let totalRedactions = 0;
    let promptInjectionDetected = false;
    const allFindings: ReviewComment[] = [];

    const llmClient = new LLMReviewClient({
      apiKey: 'demo-key',
      model: options.model || 'gpt-4o',
      isMockMode: isMock,
    });

    for (const batch of batches) {
      for (const file of batch.files) {
        if (enablePii) {
          const scrub = this.piiScrubber.scrub(file.content);
          file.content = scrub.cleanText;
          totalRedactions += scrub.totalRedacted;
        }

        if (enableDefense) {
          const defense = this.injectionDefense.wrapUntrustedDiff(file.filename, file.content);
          file.content = defense.safePayload;
          if (defense.hasAdversarialPatterns) {
            promptInjectionDetected = true;
          }
        }
      }

      const findings = await llmClient.reviewBatch(batch);
      allFindings.push(...findings);
    }

    const minScore = severityHierarchy[minSeverity] || 1;
    const filteredComments = allFindings.filter(
      (f) => severityHierarchy[f.severity] >= minScore
    );

    const categoryCounts: Record<ReviewCategory, number> = {
      SECURITY: 0,
      BUG: 0,
      PERFORMANCE: 0,
      CODE_QUALITY: 0,
    };
    const severityCounts: Record<SeverityLevel, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    for (const comment of filteredComments) {
      if (categoryCounts[comment.category] !== undefined) {
        categoryCounts[comment.category]++;
      }
      if (severityCounts[comment.severity] !== undefined) {
        severityCounts[comment.severity]++;
      }
    }

    let status: ReviewSummary['status'] = 'COMMENTED';
    if (filteredComments.length === 0) {
      status = 'APPROVED';
    } else if (severityCounts.CRITICAL > 0 || severityCounts.HIGH > 0 || promptInjectionDetected) {
      status = 'CHANGES_REQUESTED';
    }

    const summary: ReviewSummary = {
      status,
      totalComments: filteredComments.length,
      severityCounts,
      categoryCounts,
      summaryMarkdown: '',
      promptInjectionDetected,
      totalRedactions,
    };

    summary.summaryMarkdown = CommentFormatter.formatReviewSummary(summary);

    const auditId = `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const record: AuditRecord = {
      id: auditId,
      timestamp: new Date().toISOString(),
      filesCount: diffFiles.length,
      findingsCount: filteredComments.length,
      redactionsCount: totalRedactions,
      injectionDetected: promptInjectionDetected,
      status: summary.status === 'APPROVED' ? 'PASSED' : 'FLAGGED',
      summary,
      comments: filteredComments,
    };
    this.auditRepo.save(record);

    return {
      summary,
      comments: filteredComments,
      redactions: totalRedactions,
      promptInjectionDetected,
      auditId,
    };
  }
}
