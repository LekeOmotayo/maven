/**
 * Zod schemas for runtime input/output validation.
 */

import { z } from 'zod';
import { SeverityLevel, ReviewCategory } from '../types';

export const SeverityLevelEnum = z.enum([
  'CRITICAL',
  'HIGH',
  'MEDIUM',
  'LOW',
  'INFO',
]);

export const ReviewCategoryEnum = z.enum([
  'SECURITY',
  'BUG',
  'PERFORMANCE',
  'CODE_QUALITY',
]);

export const ReviewCommentSchema = z.object({
  path: z.string().min(1, 'File path must not be empty'),
  line: z.number().int().positive('Target line must be a positive integer'),
  startLine: z.number().int().positive().optional(),
  severity: SeverityLevelEnum,
  severityScore: z.number().min(1.0).max(10.0),
  category: ReviewCategoryEnum,
  title: z.string().min(3, 'Title is too short'),
  description: z.string().min(10, 'Description must provide actionable context'),
  suggestion: z.string().optional(),
  cweId: z.string().optional(),
});

export const LLMReviewResponseSchema = z.object({
  batchSummary: z.string().default(''),
  findings: z.array(ReviewCommentSchema).default([]),
});

export const ActionInputSchema = z.object({
  githubToken: z.string().min(1, 'GitHub Token is required'),
  owner: z.string().min(1, 'Repository owner is required'),
  repo: z.string().min(1, 'Repository name is required'),
  pullNumber: z.number().int().positive('Pull Request number must be positive'),
  commitSha: z.string().min(1, 'Commit SHA is required'),
  openaiApiKey: z.string().optional(),
  openaiBaseUrl: z.string().url().default('https://api.openai.com/v1'),
  model: z.string().default('gpt-4o'),
  maxTokensPerBatch: z.number().int().min(500).max(128000).default(4000),
  severityThreshold: SeverityLevelEnum.default('LOW'),
  failOnSeverity: SeverityLevelEnum.optional(),
  ignorePatterns: z.array(z.string()).default([
    '*.lock',
    '*-lock.json',
    '*.min.js',
    '*.min.css',
    'dist/**',
    'build/**',
    '*.svg',
    '*.png',
    '*.jpg',
    '*.pdf',
  ]),
  enablePiiScrubbing: z.boolean().default(true),
  enableInjectionDefense: z.boolean().default(true),
  isMockMode: z.boolean().default(false),
});

/**
 * Clean and parse potentially markdown-wrapped JSON output from LLM.
 */
export function parseLLMJsonResponse(rawText: string) {
  let cleaned = rawText.trim();
  // Strip ```json and ``` markdown code blocks if present
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '');
  }

  const parsed = JSON.parse(cleaned);
  return LLMReviewResponseSchema.parse(parsed);
}
