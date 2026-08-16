/**
 * Cheap insurance, applied unconditionally before anything reaches
 * prComment.ts. Even a well-configured preview environment can leak
 * a token in an error message body — this doesn't try to be
 * exhaustive, just catches the common, high-damage patterns.
 */
const SECRET_PATTERNS: RegExp[] = [
  /sk_(live|test)_[a-zA-Z0-9]{16,}/g, // Stripe-style secret keys
  /AKIA[0-9A-Z]{16}/g, // AWS access key IDs
  /ghp_[a-zA-Z0-9]{36}/g, // GitHub personal access tokens
  /Bearer\s+[a-zA-Z0-9\-._~+/]+=*/g, // Bearer tokens in headers/bodies
  /eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, // JWTs
];

const REDACTED = "[redacted]";

/**
 * Recursively walks any JSON-like value (string, number, array, object)
 * and redacts matches wherever it finds a string. Returns a new value —
 * never mutates the input, so callers can't accidentally scrub a value
 * they still needed unredacted for something else.
 */
export function scrubSecrets<T>(value: T): T {
  if (typeof value === "string") {
    let scrubbed: string = value;
    for (const pattern of SECRET_PATTERNS) {
      scrubbed = scrubbed.replace(pattern, REDACTED);
    }
    return scrubbed as unknown as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => scrubSecrets(item)) as unknown as T;
  }

  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = scrubSecrets(val);
    }
    return out as unknown as T;
  }

  return value;
}
