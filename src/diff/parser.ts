/**
 * Unified Git Diff Parser.
 * Converts raw unified patch strings into structured hunks with accurate
 * line numbering for GitHub inline review comment anchoring.
 */

import { DiffFile, DiffHunk, DiffLine } from '../types';

export class DiffParser {
  /**
   * Parse a raw unified diff patch into structured file objects.
   */
  public parsePatch(filename: string, patchText: string): DiffFile {
    const hunks: DiffHunk[] = [];
    let additions = 0;
    let deletions = 0;

    if (!patchText || !patchText.trim()) {
      return {
        filename,
        status: 'modified',
        additions: 0,
        deletions: 0,
        patch: '',
        hunks: [],
        estimatedTokens: 0,
      };
    }

    const lines = patchText.split('\n');
    let currentHunk: DiffHunk | null = null;
    let oldLineCursor = 0;
    let newLineCursor = 0;

    const hunkHeaderRegex = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(?:(.*))?$/;

    for (const line of lines) {
      const match = line.match(hunkHeaderRegex);

      if (match) {
        if (currentHunk) {
          hunks.push(currentHunk);
        }

        const oldStart = parseInt(match[1], 10);
        const oldLines = match[2] !== undefined ? parseInt(match[2], 10) : 1;
        const newStart = parseInt(match[3], 10);
        const newLines = match[4] !== undefined ? parseInt(match[4], 10) : 1;

        oldLineCursor = oldStart;
        newLineCursor = newStart;

        currentHunk = {
          header: line,
          oldStart,
          oldLines,
          newStart,
          newLines,
          lines: [],
        };
        continue;
      }

      if (!currentHunk) {
        continue;
      }

      if (line.startsWith('+')) {
        additions++;
        currentHunk.lines.push({
          type: 'add',
          content: line.substring(1),
          newLineNumber: newLineCursor,
        });
        newLineCursor++;
      } else if (line.startsWith('-')) {
        deletions++;
        currentHunk.lines.push({
          type: 'del',
          content: line.substring(1),
          oldLineNumber: oldLineCursor,
        });
        oldLineCursor++;
      } else if (line.startsWith(' ') || line === '') {
        currentHunk.lines.push({
          type: 'context',
          content: line.startsWith(' ') ? line.substring(1) : '',
          oldLineNumber: oldLineCursor,
          newLineNumber: newLineCursor,
        });
        oldLineCursor++;
        newLineCursor++;
      } else if (line.startsWith('\\ No newline at end of file')) {
        // Skip metadata marker
        continue;
      }
    }

    if (currentHunk) {
      hunks.push(currentHunk);
    }

    const estimatedTokens = Math.max(1, Math.ceil(patchText.length / 3.8));

    return {
      filename,
      status: 'modified',
      additions,
      deletions,
      patch: patchText,
      hunks,
      estimatedTokens,
    };
  }
}
