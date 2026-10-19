import { DiffParser } from '../src/diff/parser';

describe('DiffParser', () => {
  let parser: DiffParser;

  beforeEach(() => {
    parser = new DiffParser();
  });

  it('correctly parses a unified diff patch with additions and deletions', () => {
    const patch = [
      '@@ -10,4 +10,6 @@ function calculateTotal(items) {',
      '   let total = 0;',
      '-  for (let i = 0; i < items.length; i++) {',
      '+  for (const item of items) {',
      '+    // Add price check',
      '     total += item.price;',
      '   }',
    ].join('\n');

    const result = parser.parsePatch('src/utils/calc.ts', patch);

    expect(result.filename).toBe('src/utils/calc.ts');
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);
    expect(result.hunks.length).toBe(1);

    const hunk = result.hunks[0];
    expect(hunk.oldStart).toBe(10);
    expect(hunk.newStart).toBe(10);

    // Verify addition line mapping
    const addedLines = hunk.lines.filter((l) => l.type === 'add');
    expect(addedLines.length).toBe(2);
    expect(addedLines[0].newLineNumber).toBe(11);
    expect(addedLines[0].content).toBe('  for (const item of items) {');
    expect(addedLines[1].newLineNumber).toBe(12);
  });

  it('handles empty or whitespace-only patch gracefully', () => {
    const result = parser.parsePatch('empty.txt', '');
    expect(result.filename).toBe('empty.txt');
    expect(result.hunks.length).toBe(0);
    expect(result.additions).toBe(0);
    expect(result.deletions).toBe(0);
    expect(result.estimatedTokens).toBe(0);
  });

  it('accurately parses multiple hunks within a single file patch', () => {
    const multiHunkPatch = [
      '@@ -1,3 +1,3 @@',
      ' const a = 1;',
      '-const b = 2;',
      '+const b = 3;',
      ' const c = 4;',
      '@@ -20,3 +20,4 @@',
      ' function run() {',
      '+  console.log("running");',
      '   return true;',
      ' }',
    ].join('\n');

    const result = parser.parsePatch('src/app.ts', multiHunkPatch);
    expect(result.hunks.length).toBe(2);
    expect(result.additions).toBe(2);
    expect(result.deletions).toBe(1);
  });
});
