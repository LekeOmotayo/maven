/**
 * Configuration loader with Zod validation.
 * Extracts settings from GitHub Action inputs and event context.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { ActionConfig, SeverityLevel } from './types';
import { ActionInputSchema } from './validation/schemas';

export function loadActionConfig(): ActionConfig {
  const context = github.context;

  // Resolve repository owner and name safely (context.repo throws if GITHUB_REPOSITORY is missing)
  let owner = process.env.GITHUB_REPOSITORY_OWNER || '';
  let repo = '';

  try {
    if (context.repo) {
      owner = owner || context.repo.owner;
      repo = context.repo.repo;
    }
  } catch {
    if (process.env.GITHUB_REPOSITORY) {
      const parts = process.env.GITHUB_REPOSITORY.split('/');
      owner = owner || parts[0] || 'default-owner';
      repo = parts[1] || 'default-repo';
    } else {
      owner = owner || 'default-owner';
      repo = 'default-repo';
    }
  }

  // Resolve pull request number safely
  let pullNumber = 1;
  try {
    pullNumber =
      context.payload?.pull_request?.number ||
      parseInt(process.env.PULL_REQUEST_NUMBER || '1', 10);
  } catch {
    pullNumber = parseInt(process.env.PULL_REQUEST_NUMBER || '1', 10);
  }

  // Resolve head commit SHA safely
  let commitSha = 'mock-commit-sha-123456';
  try {
    commitSha =
      context.payload?.pull_request?.head?.sha ||
      process.env.COMMIT_SHA ||
      'mock-commit-sha-123456';
  } catch {
    commitSha = process.env.COMMIT_SHA || 'mock-commit-sha-123456';
  }

  const rawInputs = {
    githubToken:
      core.getInput('github_token') ||
      process.env.GITHUB_TOKEN ||
      'mock-github-token',
    owner: owner || 'default-owner',
    repo: repo || 'default-repo',
    pullNumber,
    commitSha,
    openaiApiKey:
      core.getInput('openai_api_key') ||
      process.env.OPENAI_API_KEY ||
      undefined,
    openaiBaseUrl:
      core.getInput('openai_base_url') ||
      process.env.OPENAI_BASE_URL ||
      'https://api.openai.com/v1',
    model: core.getInput('model') || process.env.MODEL || 'gpt-4o',
    maxTokensPerBatch: parseInt(
      core.getInput('max_tokens_per_batch') ||
        process.env.MAX_TOKENS_PER_BATCH ||
        '4000',
      10
    ),
    severityThreshold: (core.getInput('severity_threshold') ||
      process.env.SEVERITY_THRESHOLD ||
      'LOW') as SeverityLevel,
    failOnSeverity: (core.getInput('fail_on_severity') ||
      process.env.FAIL_ON_SEVERITY ||
      undefined) as SeverityLevel | undefined,
    ignorePatterns: (
      core.getInput('ignore_patterns') ||
      process.env.IGNORE_PATTERNS ||
      ''
    )
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    enablePiiScrubbing:
      core.getInput('enable_pii_scrubbing') !== 'false' &&
      process.env.ENABLE_PII_SCRUBBING !== 'false',
    enableInjectionDefense:
      core.getInput('enable_injection_defense') !== 'false' &&
      process.env.ENABLE_INJECTION_DEFENSE !== 'false',
    isMockMode:
      core.getInput('is_mock_mode') === 'true' ||
      process.env.IS_MOCK_MODE === 'true' ||
      !process.env.GITHUB_ACTIONS,
  };

  const parsed = ActionInputSchema.parse(rawInputs);
  return parsed as ActionConfig;
}
