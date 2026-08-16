import { Octokit } from "@octokit/rest";

export interface PrMeta {
  number: number;
  headRef: string;
  headSha: string;
  baseRef: string;
  baseSha: string;
}

/**
 * The only file in the codebase that imports @octokit/rest directly.
 * If GitHub's API ever changes, or this needs to move to GraphQL,
 * there's exactly one file to touch.
 */
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

  async postComment(owner: string, repo: string, prNumber: number, body: string): Promise<void> {
    await this.octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body,
    });
  }

  /** Exposed for config/loader.ts's loadConfigFromGitHub, which only needs getContent. */
  get rest() {
    return this.octokit.rest;
  }
}
