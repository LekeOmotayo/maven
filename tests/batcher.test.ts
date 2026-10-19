import { DiffBatcher } from '../src/diff/batcher';
import { DiffFile } from '../src/types';

describe('DiffBatcher', () => {
  it('correctly filters out lockfiles, binary files, and minified code', () => {
    const batcher = new DiffBatcher(4000);

    expect(batcher.isIgnored('package-lock.json')).toBe(true);
    expect(batcher.isIgnored('yarn.lock')).toBe(true);
    expect(batcher.isIgnored('pnpm-lock.yaml')).toBe(true);
    expect(batcher.isIgnored('bundle.min.js')).toBe(true);
    expect(batcher.isIgnored('assets/logo.png')).toBe(true);
    expect(batcher.isIgnored('dist/index.js')).toBe(true);

    expect(batcher.isIgnored('src/services/auth.ts')).toBe(false);
    expect(batcher.isIgnored('src/components/Header.tsx')).toBe(false);
  });

  it('batches small diffs together into a single batch within token limit', () => {
    const batcher = new DiffBatcher(2000);

    const files: DiffFile[] = [
      {
        filename: 'src/a.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        patch: '@@ -1,2 +1,3 @@\n+const a = 1;',
        hunks: [
          {
            header: '@@ -1,2 +1,3 @@',
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 3,
            lines: [{ type: 'add', content: 'const a = 1;', newLineNumber: 1 }],
          },
        ],
        estimatedTokens: 20,
      },
      {
        filename: 'src/b.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        patch: '@@ -1,2 +1,3 @@\n+const b = 2;',
        hunks: [
          {
            header: '@@ -1,2 +1,3 @@',
            oldStart: 1,
            oldLines: 2,
            newStart: 1,
            newLines: 3,
            lines: [{ type: 'add', content: 'const b = 2;', newLineNumber: 1 }],
          },
        ],
        estimatedTokens: 20,
      },
    ];

    const batches = batcher.createBatches(files);
    expect(batches.length).toBe(1);
    expect(batches[0].files.length).toBe(2);
    expect(batches[0].totalEstimatedTokens).toBeGreaterThan(0);
  });

  it('splits diffs across multiple batches when token threshold is reached', () => {
    // Set small token limit to trigger batch splitting
    const batcher = new DiffBatcher(50);

    const files: DiffFile[] = [
      {
        filename: 'src/large1.ts',
        status: 'modified',
        additions: 10,
        deletions: 0,
        patch: '@@ -1,10 +1,20 @@\n' + '+const x = 1;\n'.repeat(15),
        hunks: [
          {
            header: '@@ -1,10 +1,20 @@',
            oldStart: 1,
            oldLines: 10,
            newStart: 1,
            newLines: 20,
            lines: Array(15).fill({ type: 'add', content: 'const x = 1;', newLineNumber: 1 }),
          },
        ],
        estimatedTokens: 40,
      },
      {
        filename: 'src/large2.ts',
        status: 'modified',
        additions: 10,
        deletions: 0,
        patch: '@@ -1,10 +1,20 @@\n' + '+const y = 2;\n'.repeat(15),
        hunks: [
          {
            header: '@@ -1,10 +1,20 @@',
            oldStart: 1,
            oldLines: 10,
            newStart: 1,
            newLines: 20,
            lines: Array(15).fill({ type: 'add', content: 'const y = 2;', newLineNumber: 1 }),
          },
        ],
        estimatedTokens: 40,
      },
    ];

    const batches = batcher.createBatches(files);
    expect(batches.length).toBe(2);
    expect(batches[0].files[0].filename).toBe('src/large1.ts');
    expect(batches[1].files[0].filename).toBe('src/large2.ts');
  });
});
