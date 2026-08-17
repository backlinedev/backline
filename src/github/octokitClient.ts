import { Octokit } from "@octokit/rest";

export interface PrMeta {
  number: number;
  headRef: string;
  headSha: string;
  baseRef: string;
  baseSha: string;
}

/** A marker embedded invisibly in every comment Backline posts, used to find it again later. */
const COMMENT_MARKER = "<!-- backline-comment -->";

export class GitHubClient {
  private readonly octokit: Octokit;

  constructor(token: string) {
    this.octokit = new Octokit({ auth: token });
  }

  async getPrMeta(owner: string, repo: string, prNumber: number): Promise<PrMeta> {
    const { data } = await this.octokit.rest.pulls.get({ owner, repo, pull_number: prNumber });
    return {
      number: data.number,
      headRef: data.head.ref,
      headSha: data.head.sha,
      baseRef: data.base.ref,
      baseSha: data.base.sha,
    };
  }

  /**
   * Posts a new comment, or edits Backline's own prior comment on this
   * PR if one already exists — so pushing new commits updates the
   * same comment instead of the conversation filling up with a fresh
   * one every run.
   */
  async upsertComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
    const markedBody = `${COMMENT_MARKER}\n${body}`;

    const { data: comments } = await this.octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: prNumber,
    });

    const existing = comments.find((c) => c.body?.includes(COMMENT_MARKER));

    if (existing) {
      await this.octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existing.id,
        body: markedBody,
      });
    } else {
      await this.octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body: markedBody,
      });
    }
  }

  get rest() {
    return this.octokit.rest;
  }
}
