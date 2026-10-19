/**
 * Core type definitions for the Enterprise Deep Code Review Action.
 */

export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

export type ReviewCategory = 'SECURITY' | 'BUG' | 'PERFORMANCE' | 'CODE_QUALITY';

export interface DiffLine {
  type: 'add' | 'del' | 'context';
  content: string;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  filename: string;
  oldFilename?: string;
  status: 'added' | 'modified' | 'removed' | 'renamed';
  additions: number;
  deletions: number;
  patch: string;
  hunks: DiffHunk[];
  estimatedTokens: number;
}

export interface CodeSnippetBatch {
  batchId: string;
  files: {
    filename: string;
    hunkHeaders: string[];
    content: string;
    lineMappings: {
      relativeLineIndex: number;
      actualNewLineNumber: number;
    }[];
  }[];
  totalEstimatedTokens: number;
}

export interface RedactionRecord {
  type: 'API_KEY' | 'SECRET' | 'EMAIL' | 'SSN' | 'PHONE' | 'PRIVATE_KEY' | 'IP_ADDRESS';
  placeholder: string;
  occurrenceCount: number;
}

export interface ReviewComment {
  path: string;
  line: number;
  startLine?: number;
  severity: SeverityLevel;
  severityScore: number; // 1.0 to 10.0
  category: ReviewCategory;
  title: string;
  description: string;
  suggestion?: string; // Optional replacement code for GitHub suggestion block
  cweId?: string; // e.g. "CWE-89", "CWE-79"
}

export interface ReviewSummary {
  status: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED';
  totalComments: number;
  severityCounts: Record<SeverityLevel, number>;
  categoryCounts: Record<ReviewCategory, number>;
  summaryMarkdown: string;
  promptInjectionDetected: boolean;
  totalRedactions: number;
}

export interface ActionConfig {
  githubToken: string;
  owner: string;
  repo: string;
  pullNumber: number;
  commitSha: string;
  openaiApiKey?: string;
  openaiBaseUrl: string;
  model: string;
  maxTokensPerBatch: number;
  severityThreshold: SeverityLevel;
  failOnSeverity?: SeverityLevel;
  ignorePatterns: string[];
  enablePiiScrubbing: boolean;
  enableInjectionDefense: boolean;
  isMockMode: boolean;
}
