/**
 * The single boundary between Backline and however previews actually
 * get hosted.
 *
 * @remarks
 * Backline never knows or cares whether the implementation is Docker
 * Compose, PullPreview, Uffizzi, or a hand-rolled script — it only
 * ever calls these three methods. Adding a new deploy target means
 * implementing this interface; nothing else needs to change.
 */
export interface DeployAdapter {
  /**
   * Stand up a running instance of the given ref and return a URL.
   *
   * @param ref - A git ref (branch name or SHA) to deploy.
   * @param envFile - Optional path to a local env file, passed through
   * untouched — Backline never reads or stores its contents itself.
   * @returns The preview URL, and the working directory the ref's
   * code actually lives in, if the adapter provides one (used by CLI
   * probes so they run that ref's actual binary, not whatever happens
   * to be on the shared top-level checkout).
   */
  deploy(ref: string, envFile?: string): Promise<{ previewUrl: string; workingDirectory: string }>;

  /** Tear down whatever `deploy` stood up for this ref. */
  teardown(ref: string): Promise<void>;

  /**
   * Poll `previewUrl + path` until it responds successfully, or throw
   * once `timeoutMs` has elapsed.
   */
  healthCheck(previewUrl: string, path: string, timeoutMs: number): Promise<void>;
}

/** Thrown by {@link DeployAdapter.healthCheck} implementations on timeout. */
export class DeployTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Preview at ${url} did not become healthy within ${timeoutMs}ms`);
    this.name = "DeployTimeoutError";
  }
}
