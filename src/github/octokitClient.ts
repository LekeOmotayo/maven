/**
 * GitHub Octokit Client Wrapper.
 * Asynchronously retrieves PR file changes and posts structured inline comments
 * and top-level review decisions.
 */

import { Octokit } from '@octokit/rest';
import { DiffParser } from '../diff/parser';
import { CommentFormatter } from '../formatters/commentFormatter';
import { DiffFile, ReviewComment, ReviewSummary } from '../types';

export class GitHubClient {
  private octokit: Octokit;
  private parser: DiffParser;
  private isMockMode: boolean;

  constructor(token: string, isMockMode: boolean = false) {
    this.octokit = new Octokit({ auth: token });
    this.parser = new DiffParser();
    this.isMockMode = isMockMode;
  }

  /**
   * Fetch all modified and added files for a pull request with unified diffs.
   */
  public async fetchPullRequestFiles(
    owner: string,
    repo: string,
    pullNumber: number
  ): Promise<DiffFile[]> {
    if (this.isMockMode) {
      return [
        this.parser.parsePatch(
          'src/controllers/userController.ts',
          `@@ -10,6 +10,8 @@ export async function getUser(req, res) {
   const { id } = req.params;
-  const user = await db.query('SELECT * FROM users WHERE id = $1', [id]);
+  // Vulnerable query concatenation
+  const query = "SELECT * FROM users WHERE id = " + id;
+  const user = await db.query(query);
   return res.json(user);
 }`
        ),
      ];
    }

    const files = await this.octokit.paginate(this.octokit.rest.pulls.listFiles, {
      owner,
      repo,
      pull_number: pullNumber,
      per_page: 100,
    });

    const diffFiles: DiffFile[] = [];

    for (const file of files) {
      // Only process files with patch data
      if (file.patch) {
        const parsed = this.parser.parsePatch(file.filename, file.patch);
        parsed.status = file.status as DiffFile['status'];
        diffFiles.push(parsed);
      }
    }

    return diffFiles;
  }

  /**
   * Post a structured inline review comment anchored to the exact line in PR diff.
   */
  public async postInlineComment(
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha: string,
    comment: ReviewComment
  ): Promise<boolean> {
    const formattedBody = CommentFormatter.formatInlineComment(comment);

    if (this.isMockMode) {
      console.log(`[MOCK GitHub] Inline Comment posted to ${comment.path}:${comment.line}:\n${formattedBody}\n`);
      return true;
    }

    try {
      await this.octokit.rest.pulls.createReviewComment({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitSha,
        path: comment.path,
        line: comment.line,
        side: 'RIGHT',
        body: formattedBody,
      });
      return true;
    } catch (err: any) {
      console.warn(
        `Failed to post inline comment at ${comment.path}:${comment.line} (${err.message}). Falling back to general note.`
      );
      return false;
    }
  }

  /**
   * Submit top-level pull request review with decision and executive summary.
   */
  public async postReviewSummary(
    owner: string,
    repo: string,
    pullNumber: number,
    commitSha: string,
    summary: ReviewSummary
  ): Promise<void> {
    const body = CommentFormatter.formatReviewSummary(summary);

    if (this.isMockMode) {
      console.log(`[MOCK GitHub] PR Review Summary posted (${summary.status}):\n${body}\n`);
      return;
    }

    try {
      const event =
        summary.status === 'CHANGES_REQUESTED'
          ? 'REQUEST_CHANGES'
          : summary.status === 'APPROVED'
          ? 'APPROVE'
          : 'COMMENT';

      await this.octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: pullNumber,
        commit_id: commitSha,
        event,
        body,
      });
    } catch (err: any) {
      console.error(`Failed to post review summary: ${err.message}`);
    }
  }
}
