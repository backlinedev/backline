/**
 * Everything Backline needs from "however this project gets deployed
 * for preview," reduced to three methods. Backline never knows or
 * cares whether the implementation is Docker Compose, PullPreview,
 * Uffizzi, or a hand-rolled script — it only ever calls these three.
 *
 * Adding support for a new deploy target means implementing this
 * interface. Nothing in orchestrator.ts, probes/, or diff/ needs to
 * change.
 */
export interface DeployAdapter {
  /**
   * Stand up a running instance of the given ref and return a URL
   * Backline can send requests to. `envFile`, if provided, points at
   * a local file of environment variables to pass through untouched —
   * Backline never reads or stores the contents itself.
   */
  deploy(ref: string, envFile?: string): Promise<{ previewUrl: string }>;

  /** Tear down whatever `deploy` stood up for this ref. */
  teardown(ref: string): Promise<void>;

  /**
   * Poll `previewUrl + path` until it responds successfully, or throw
   * once `timeoutMs` has elapsed. Exists because a freshly deployed
   * container isn't instantly ready to receive probe traffic.
   */
  healthCheck(previewUrl: string, path: string, timeoutMs: number): Promise<void>;
}

export class DeployTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(`Preview at ${url} did not become healthy within ${timeoutMs}ms`);
    this.name = "DeployTimeoutError";
  }
}
