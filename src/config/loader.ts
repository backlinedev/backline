/**
 * Reads and validates `.backline.yml` from either local disk or a
 * specific GitHub ref.
 *
 * @remarks
 * Both loading paths funnel through the same {@link parseConfig}
 * function, so the actual YAML-parsing and schema-validation logic
 * only exists once — the only thing that differs between "local" and
 * "GitHub" is how the raw text gets fetched in the first place.
 */
import { readFile } from "node:fs/promises";
import yaml from "js-yaml";
import { BacklineConfigSchema, type BacklineConfig } from "./schema.js";

/**
 * Thrown for any problem with `.backline.yml` — invalid YAML syntax,
 * a schema validation failure, or the file simply not being found.
 *
 * @remarks
 * Kept distinct from a generic `Error` so calling code (the CLI, the
 * Action entrypoint) can catch config problems specifically and show
 * a clean message, rather than a raw stack trace.
 */
export class ConfigError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ConfigError";
  }
}

/**
 * Parses a raw YAML string and validates it against
 * {@link BacklineConfigSchema}.
 *
 * @remarks
 * This is the one function that actually knows what a valid
 * `.backline.yml` looks like. Both {@link loadConfigFromFile} and
 * {@link loadConfigFromGitHub} are just different ways of getting a
 * raw string to hand to this function — neither one duplicates any
 * validation logic itself.
 *
 * @param rawYaml - The unparsed contents of a `.backline.yml` file.
 * @returns A fully validated, defaults-applied {@link BacklineConfig}.
 * @throws {@link ConfigError} if the YAML is malformed, or if it
 * doesn't match the schema.
 */
export function parseConfig(rawYaml: string): BacklineConfig {
  let parsed: unknown;
  try {
    parsed = yaml.load(rawYaml);
  } catch (err) {
    throw new ConfigError(`.backline.yml is not valid YAML: ${(err as Error).message}`, err);
  }

  const result = BacklineConfigSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new ConfigError(`.backline.yml failed schema validation:\n${issues}`);
  }
  return result.data;
}

/**
 * Reads `.backline.yml` from local disk.
 *
 * @remarks
 * Used by the local CLI path (`backline test --local`) and by tests —
 * anywhere there's no GitHub ref involved, just a real file on disk.
 *
 * @param path - Path to the config file, e.g. `.backline.yml`.
 * @throws {@link ConfigError} if the file can't be read, or fails
 * validation once parsed.
 */
export async function loadConfigFromFile(path: string): Promise<BacklineConfig> {
  let raw: string;
  try {
    raw = await readFile(path, "utf-8");
  } catch (err) {
    throw new ConfigError(`Could not read config file at ${path}`, err);
  }
  return parseConfig(raw);
}

/**
 * The minimal shape of an Octokit client this module actually needs.
 *
 * @remarks
 * Deliberately narrow — accepting a full Octokit instance here would
 * make this function harder to unit test (you'd need a real client,
 * or a much heavier mock). This interface only asks for the one
 * method actually used, so a test can pass in a trivial fake object
 * instead of a real GitHub connection.
 */
export interface MinimalOctokit {
  rest: {
    repos: {
      getContent(params: {
        owner: string;
        repo: string;
        path: string;
        ref: string;
      }): Promise<{ data: { content?: string; encoding?: string } }>;
    };
  };
}

/**
 * Reads `.backline.yml` from a specific ref via GitHub's Contents API.
 *
 * @remarks
 * Reads from the PR's own head ref specifically — not whatever
 * happens to be on `main` — so validation reflects the config as it
 * actually exists on the branch being tested, including any changes
 * that branch itself made to `.backline.yml`.
 *
 * @param octokit - Anything satisfying {@link MinimalOctokit}.
 * @param params.owner - Repository owner.
 * @param params.repo - Repository name.
 * @param params.ref - The git ref to read the file from.
 * @param params.path - Defaults to `.backline.yml`.
 * @throws {@link ConfigError} if the file doesn't exist on that ref,
 * isn't a plain file, or fails validation once parsed.
 */
export async function loadConfigFromGitHub(
  octokit: MinimalOctokit,
  params: { owner: string; repo: string; ref: string; path?: string },
): Promise<BacklineConfig> {
  const path = params.path ?? ".backline.yml";
  const { data } = await octokit.rest.repos.getContent({
    owner: params.owner,
    repo: params.repo,
    path,
    ref: params.ref,
  });

  if (!data.content || data.encoding !== "base64") {
    throw new ConfigError(`${path} not found on ref ${params.ref}, or is not a plain file`);
  }

  const raw = Buffer.from(data.content, "base64").toString("utf-8");
  return parseConfig(raw);
}
