/**
 * GitHub Action Entrypoint.
 * Orchestrates diff retrieval, token-aware chunking, PII scrubbing,
 * prompt injection defense, LLM analysis, and structured PR review submissions.
 */

import * as core from '@actions/core';
import { loadActionConfig } from './config';
import { DiffBatcher } from './diff/batcher';
import { CommentFormatter } from './formatters/commentFormatter';
import { GitHubClient } from './github/octokitClient';
import { LLMReviewClient } from './llm/client';
import { PromptInjectionDefense } from './security/injectionDefense';
import { PiiScrubber } from './security/scrubber';
import { ReviewCategory, ReviewComment, ReviewSummary, SeverityLevel } from './types';

export async function run(): Promise<void> {
  try {
    core.info('🚀 Starting Enterprise Deep Code Review Action...');
    const config = loadActionConfig();

    core.info(
      `Analyzing PR #${config.pullNumber} on ${config.owner}/${config.repo} ` +
      `[Model: ${config.model}, Max Batch Tokens: ${config.maxTokensPerBatch}]`
    );

    // Initialize pipeline services
    const githubClient = new GitHubClient(config.githubToken, config.isMockMode);
    const diffBatcher = new DiffBatcher(config.maxTokensPerBatch, config.ignorePatterns);
    const piiScrubber = new PiiScrubber();
    const injectionDefense = new PromptInjectionDefense();
    const llmClient = new LLMReviewClient({
      apiKey: config.openaiApiKey,
      baseUrl: config.openaiBaseUrl,
      model: config.model,
      isMockMode: config.isMockMode,
    });

    // 1. Fetch modified PR files with unified diffs
    core.info('📥 Fetching pull request file diffs from GitHub...');
    const diffFiles = await githubClient.fetchPullRequestFiles(
      config.owner,
      config.repo,
      config.pullNumber
    );

    if (diffFiles.length === 0) {
      core.info('✅ No reviewable diffs found in this pull request.');
      return;
    }

    core.info(`Found ${diffFiles.length} modified files in pull request.`);

    // 2. Batch files and hunks respecting token limits
    const batches = diffBatcher.createBatches(diffFiles);
    core.info(`Created ${batches.length} token-bounded review batches.`);

    let totalRedactions = 0;
    let promptInjectionDetected = false;
    const allFindings: ReviewComment[] = [];

    // 3. Process batches through security middleware & LLM review
    for (const [idx, batch] of batches.entries()) {
      core.info(`🔍 Reviewing batch ${idx + 1}/${batches.length} (Est. ${batch.totalEstimatedTokens} tokens)...`);

      // Apply Security Middleware to each file in batch
      for (const file of batch.files) {
        // PII & Secrets Scrubbing
        if (config.enablePiiScrubbing) {
          const scrubResult = piiScrubber.scrub(file.content);
          file.content = scrubResult.cleanText;
          totalRedactions += scrubResult.totalRedacted;
        }

        // Prompt Injection Defense Wrapper
        if (config.enableInjectionDefense) {
          const defenseResult = injectionDefense.wrapUntrustedDiff(file.filename, file.content);
          file.content = defenseResult.safePayload;
          if (defenseResult.hasAdversarialPatterns) {
            promptInjectionDetected = true;
            core.warning(
              `⚠️ Adversarial prompt patterns detected in ${file.filename}: ${defenseResult.detectedPatterns.join(', ')}`
            );
          }
        }
      }

      // Execute review via LLM Client
      const batchFindings = await llmClient.reviewBatch(batch);
      allFindings.push(...batchFindings);
    }

    // 4. Filter findings by minimum severity threshold
    const severityHierarchy: Record<SeverityLevel, number> = {
      CRITICAL: 5,
      HIGH: 4,
      MEDIUM: 3,
      LOW: 2,
      INFO: 1,
    };

    const thresholdRank = severityHierarchy[config.severityThreshold];
    const filteredFindings = allFindings.filter(
      (finding) => severityHierarchy[finding.severity] >= thresholdRank
    );

    core.info(`Identified ${filteredFindings.length} actionable findings meeting threshold '${config.severityThreshold}'.`);

    // 5. Post inline comments on GitHub PR diff
    for (const finding of filteredFindings) {
      await githubClient.postInlineComment(
        config.owner,
        config.repo,
        config.pullNumber,
        config.commitSha,
        finding
      );
    }

    // 6. Aggregate metrics and post review summary
    const severityCounts: Record<SeverityLevel, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      INFO: 0,
    };

    const categoryCounts: Record<ReviewCategory, number> = {
      SECURITY: 0,
      BUG: 0,
      PERFORMANCE: 0,
      CODE_QUALITY: 0,
    };

    for (const f of filteredFindings) {
      severityCounts[f.severity]++;
      categoryCounts[f.category]++;
    }

    // Determine gatekeeper status
    let status: ReviewSummary['status'] = 'COMMENTED';
    if (filteredFindings.length === 0) {
      status = 'APPROVED';
    } else if (
      config.failOnSeverity &&
      severityHierarchy[config.failOnSeverity] !== undefined &&
      Object.keys(severityCounts).some(
        (sev) =>
          severityHierarchy[sev as SeverityLevel] >= severityHierarchy[config.failOnSeverity!] &&
          severityCounts[sev as SeverityLevel] > 0
      )
    ) {
      status = 'CHANGES_REQUESTED';
    }

    const reviewSummary: ReviewSummary = {
      status,
      totalComments: filteredFindings.length,
      severityCounts,
      categoryCounts,
      summaryMarkdown: '',
      promptInjectionDetected,
      totalRedactions,
    };

    reviewSummary.summaryMarkdown = CommentFormatter.formatReviewSummary(reviewSummary);

    await githubClient.postReviewSummary(
      config.owner,
      config.repo,
      config.pullNumber,
      config.commitSha,
      reviewSummary
    );

    // 7. Set Action outputs
    core.setOutput('total_comments', filteredFindings.length);
    core.setOutput('critical_count', severityCounts.CRITICAL);
    core.setOutput('high_count', severityCounts.HIGH);
    core.setOutput('review_status', status);
    core.setOutput('redactions_count', totalRedactions);

    core.info(`🏁 Review completed successfully with status: ${status}`);

    // If gatekeeper threshold breached, fail the GitHub Action check run
    if (status === 'CHANGES_REQUESTED') {
      core.setFailed(
        `Review check failed: Found findings meeting or exceeding fail threshold '${config.failOnSeverity}'.`
      );
    }
  } catch (error: any) {
    core.setFailed(`Action execution failed: ${error.message}`);
  }
}

// Auto-execute if run directly
if (require.main === module) {
  run();
}
