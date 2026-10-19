/**
 * Token-Aware Diff Batcher.
 * Filters ignored files and chunks large git diffs into batches
 * that fit strictly within LLM context windows.
 */

import { CodeSnippetBatch, DiffFile } from '../types';

export class DiffBatcher {
  private maxTokens: number;
  private ignorePatterns: string[];

  constructor(maxTokens: number = 4000, ignorePatterns: string[] = []) {
    this.maxTokens = maxTokens;
    this.ignorePatterns = ignorePatterns;
  }

  /**
   * Check if a filename matches ignore criteria (lockfiles, binary files, minified code).
   */
  public isIgnored(filename: string): boolean {
    const defaultIgnores = [
      /package-lock\.json$/i,
      /yarn\.lock$/i,
      /pnpm-lock\.yaml$/i,
      /Cargo\.lock$/i,
      /poetry\.lock$/i,
      /composer\.lock$/i,
      /\.min\.(?:js|css)$/i,
      /\.(?:png|jpg|jpeg|gif|svg|ico|pdf|zip|tar|gz|woff|woff2|ttf|eot)$/i,
      /^(?:dist|build|coverage|\.next|\.nuxt)\//i,
    ];

    if (defaultIgnores.some((regex) => regex.test(filename))) {
      return true;
    }

    // Check user-configured patterns
    for (const pattern of this.ignorePatterns) {
      const cleanPattern = pattern.replace(/\*/g, '.*');
      if (new RegExp(`^${cleanPattern}$`, 'i').test(filename)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Group parsed diff files and hunks into token-bounded batches.
   */
  public createBatches(files: DiffFile[]): CodeSnippetBatch[] {
    const batches: CodeSnippetBatch[] = [];
    let currentBatchFiles: CodeSnippetBatch['files'] = [];
    let currentBatchTokens = 0;
    let batchIndex = 1;

    for (const file of files) {
      if (this.isIgnored(file.filename) || file.hunks.length === 0) {
        continue;
      }

      for (const hunk of file.hunks) {
        const hunkLinesText = hunk.lines.map((l) => `${l.type === 'add' ? '+' : l.type === 'del' ? '-' : ' '}${l.content}`).join('\n');
        const hunkEstimatedTokens = Math.max(1, Math.ceil(hunkLinesText.length / 3.8));

        // Build line mappings for GitHub anchoring
        const lineMappings = hunk.lines
          .filter((l) => l.type === 'add' && l.newLineNumber !== undefined)
          .map((l, idx) => ({
            relativeLineIndex: idx,
            actualNewLineNumber: l.newLineNumber!,
          }));

        // If adding this hunk exceeds token window, flush current batch
        if (currentBatchTokens + hunkEstimatedTokens > this.maxTokens && currentBatchFiles.length > 0) {
          batches.push({
            batchId: `batch-${batchIndex++}`,
            files: currentBatchFiles,
            totalEstimatedTokens: currentBatchTokens,
          });
          currentBatchFiles = [];
          currentBatchTokens = 0;
        }

        // Add to current batch
        const existingFile = currentBatchFiles.find((f) => f.filename === file.filename);
        if (existingFile) {
          existingFile.hunkHeaders.push(hunk.header);
          existingFile.content += `\n${hunk.header}\n${hunkLinesText}`;
          existingFile.lineMappings.push(...lineMappings);
        } else {
          currentBatchFiles.push({
            filename: file.filename,
            hunkHeaders: [hunk.header],
            content: `${hunk.header}\n${hunkLinesText}`,
            lineMappings,
          });
        }

        currentBatchTokens += hunkEstimatedTokens;
      }
    }

    // Flush remaining items
    if (currentBatchFiles.length > 0) {
      batches.push({
        batchId: `batch-${batchIndex}`,
        files: currentBatchFiles,
        totalEstimatedTokens: currentBatchTokens,
      });
    }

    return batches;
  }
}
