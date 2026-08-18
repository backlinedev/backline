# Configuration Reference

Complete reference for `.backline.yml` configuration.

## File Structure

```yaml
version: 1

target:
  # Deployment configuration

probes:
  # List of probes to run

lifecycle:
  # Optional lifecycle configuration
```

## `version`

**Required.** Schema version. Currently only `1` is supported.

```yaml
version: 1
```

## `target`

Configuration for deploying and accessing the preview instance.

### `target.base_url`

**Required for API probes.** Base URL where the deployed service will be accessible.

```yaml
target:
  base_url: "http://localhost:3000"
```

For CLI-only testing, this can be omitted.

### `target.wait_for`

**Required for API probes.** Health check configuration.

```yaml
target:
  wait_for:
    path: /health
    timeout_seconds: 30
```

#### `wait_for.path`

Endpoint to poll for health. Should return 2xx status when healthy.

#### `wait_for.timeout_seconds`

Maximum time to wait for the service to become healthy, in seconds.

**Default:** 30

**Recommendations:**
- Simple APIs: 15-30 seconds
- APIs with dependencies: 45-60 seconds
- Next.js with build: 60-90 seconds

### `target.adapter`

**Required.** Deployment adapter to use.

```yaml
target:
  adapter: compose  # or webhook
```

#### Available Adapters

| Adapter | Description | Use Case |
|---------|-------------|----------|
| `compose` | Docker Compose (default) | Local development, self-hosted CI |
| `webhook` | Custom webhook | Vercel, Netlify, existing deploy pipeline |

#### Compose Adapter

Deploys using your existing `docker-compose.yml`.

```yaml
target:
  adapter: compose
```

No additional configuration needed.

#### Webhook Adapter

For platforms that deploy via webhook (Vercel, Netlify, etc).

```yaml
target:
  adapter: webhook
```

Requires passing `--deploy-webhook-url` or setting the GitHub Action input.

## `probes`

Array of probes to run against the deployed instance.

```yaml
probes:
  - type: api
    name: "health check"
    # ...probe-specific config

  - type: cli
    name: "version test"
    # ...probe-specific config
```

## API Probe Type

Tests HTTP endpoints.

```yaml
- type: api
  name: "user endpoints"
  requests:
    - method: GET
      path: /api/users
    - method: POST
      path: /api/users
      body:
        name: "Test"
        email: "test@example.com"
  diff:
    against: base_branch
    ignore_fields:
      - "requests[*].response.body.timestamp"
```

### `type`

Must be `"api"`.

### `name`

**Required.** Unique name for this probe. Used in results and PR comments.

### `openapi_spec`

**Optional.** Path to OpenAPI/Swagger spec file.

```yaml
openapi_spec: "./openapi.yaml"
```

**Note:** Auto-generation from OpenAPI spec is planned but not yet implemented.

### `requests`

**Required.** Array of HTTP requests to execute.

#### Request Object

```yaml
- method: POST
  path: /api/search
  body:
    query: "test"
```

##### `method`

HTTP method. One of: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`.

##### `path`

Request path (relative to `target.base_url`).

##### `body`

**Optional.** Request body for POST/PUT/PATCH requests.

Can be any JSON value:

```yaml
body: "raw string"
body: 123
body:
  nested:
    object: true
  array: [1, 2, 3]
```

### `diff`

Configuration for comparing results.

```yaml
diff:
  against: base_branch
  ignore_fields:
    - "requests[*].response.body.timestamp"
    - "requests[*].response.body.user.id"
```

#### `diff.against`

Comparison target. Currently only `"base_branch"` is supported.

#### `diff.ignore_fields`

**Optional.** JSON paths to ignore when comparing.

**Path syntax:**
- Dot notation: `response.body.timestamp`
- Array wildcard: `requests[*].response.body.timestamp`
- Nested: `user.profile.created_at`

**Example:**

```yaml
ignore_fields:
  # Ignore timestamps
  - "requests[*].response.body.timestamp"
  - "requests[*].response.body.created_at"
  - "requests[*].response.body.updated_at"
  
  # Ignore request IDs
  - "requests[*].response.body.request_id"
  - "requests[*].response.headers.x-request-id"
  
  # Ignore user IDs (generated randomly)
  - "requests[*].response.body.user.id"
```

## CLI Probe Type

Tests command-line tools.

```yaml
- type: cli
  name: "version check"
  binary: ./dist/cli.js
  commands:
    - args: ["--version"]
    - args: ["process", "--input", "fixtures/data.csv"]
      stdin: "optional input data"
  diff:
    against: base_branch
    normalize:
      - strip_ansi
      - strip_timestamps
    ignore_fields:
      - "uptime"
```

### `type`

Must be `"cli"`.

### `name`

**Required.** Unique name for this probe.

### `binary`

**Required.** Path to the executable (relative to container working directory).

```yaml
binary: ./dist/cli.js
binary: ./build/myapp
binary: /usr/local/bin/tool
```

### `commands`

**Required.** Array of command invocations.

#### Command Object

```yaml
- args: ["process", "--input", "data.csv", "--format", "json"]
  stdin: "optional input"
```

##### `args`

Array of command-line arguments.

```yaml
# No arguments
args: []

# Simple flags
args: ["--version"]

# Multiple arguments
args: ["process", "--input", "file.csv", "--output", "result.json"]
```

##### `stdin`

**Optional.** String to pipe to the command's stdin.

```yaml
stdin: "input data"
stdin: |
  multi-line
  input data
```

### `diff`

Configuration for comparing results.

```yaml
diff:
  against: base_branch
  normalize:
    - strip_ansi
    - strip_timestamps
  ignore_fields:
    - "uptime"
    - "cwd"
```

#### `diff.normalize`

**Optional.** Normalization steps applied before diffing.

Available normalizers:

| Normalizer | Description |
|------------|-------------|
| `strip_ansi` | Remove ANSI color codes |
| `strip_timestamps` | Remove common timestamp patterns |

```yaml
normalize:
  - strip_ansi
  - strip_timestamps
```

**Planned (not yet implemented):**
- `strip_paths` - Remove absolute file paths
- `strip_uuids` - Remove UUIDs

#### `diff.ignore_fields`

Same as API probes, but applies to parsed JSON output.

If your CLI outputs JSON, you can ignore specific fields:

```yaml
# CLI outputs: {"result": "ok", "timestamp": 123456}
ignore_fields:
  - "timestamp"
```

## `lifecycle` (Optional)

Controls teardown behavior and failure conditions.

```yaml
lifecycle:
  teardown_on: [closed]
  idle_timeout_minutes: 60
  fail_on: never
```

### `lifecycle.teardown_on`

**Optional.** When to tear down deployments.

```yaml
teardown_on: [closed]
```

**Options:**
- `closed` - Tear down when PR is closed

**Default:** `[closed]`

### `lifecycle.idle_timeout_minutes`

**Optional.** Tear down if no new commits for this many minutes.

```yaml
idle_timeout_minutes: 60
```

**Default:** No timeout (deployments persist until PR closes)

### `lifecycle.fail_on`

**Optional.** Make the CI check fail based on probe results.

```yaml
fail_on: never  # or diff_detected, or error
```

**Options:**
- `never` - Never fail (default). Diffs are informational.
- `diff_detected` - Fail if any probe detects a diff
- `error` - Fail only on probe errors (not diffs)

**Default:** `never`

**Use case for `diff_detected`:**

```yaml
# Block merge if behavior changes
fail_on: diff_detected
```

This makes Backline a **blocking check** rather than informational.

**Recommendation:** Start with `never` until your probes are well-tuned, then consider `diff_detected` for critical paths.

## Full Example

```yaml
version: 1

target:
  base_url: "http://localhost:4000"
  wait_for:
    path: /health
    timeout_seconds: 45
  adapter: compose

probes:
  # API probes
  - type: api
    name: "core API endpoints"
    requests:
      - method: GET
        path: /health
      - method: GET
        path: /api/users
      - method: GET
        path: /api/users/1
      - method: POST
        path: /api/users
        body:
          name: "Test User"
          email: "test@example.com"
      - method: POST
        path: /api/search
        body:
          query: "test"
          limit: 10
    diff:
      against: base_branch
      ignore_fields:
        - "requests[*].response.body.timestamp"
        - "requests[*].response.body.request_id"
        - "requests[*].response.body.user.id"

  # CLI probes
  - type: cli
    name: "CLI version and help"
    binary: ./dist/cli
    commands:
      - args: ["--version"]
      - args: ["--help"]
    diff:
      against: base_branch
      normalize:
        - strip_ansi

  - type: cli
    name: "data processing"
    binary: ./dist/cli
    commands:
      - args: ["process", "--input", "fixtures/sample.csv", "--format", "json"]
    diff:
      against: base_branch
      normalize:
        - strip_ansi
        - strip_timestamps

lifecycle:
  teardown_on: [closed]
  fail_on: never
```

## Environment Variables

Backline supports environment variables in config values:

```yaml
target:
  base_url: "${BASE_URL}"

probes:
  - type: api
    requests:
      - method: GET
        path: /api/data
        headers:
          Authorization: "Bearer ${API_TOKEN}"
```

Variables are resolved from:
1. GitHub Actions secrets (in CI)
2. Environment variables (local testing)

## Schema Validation

Backline validates your config on load. Common errors:

### "Unknown probe type"

```yaml
probes:
  - type: http  # Wrong, should be 'api'
```

Use `api` or `cli`.

### "Missing required field"

```yaml
probes:
  - type: api
    # Missing 'name' and 'requests'
```

All probes need `name` and type-specific required fields.

### "Invalid path syntax"

```yaml
ignore_fields:
  - requests[*].body  # Wrong syntax
```

Use quotes:
```yaml
ignore_fields:
  - "requests[*].body"
```

## Best Practices

### 1. Always Ignore Timestamps

```yaml
ignore_fields:
  - "requests[*].response.body.timestamp"
  - "requests[*].response.body.created_at"
```

### 2. Test Both Happy and Error Paths

```yaml
requests:
  - method: GET
    path: /api/users/1      # Exists
  - method: GET
    path: /api/users/99999  # 404 error
  - method: POST
    path: /api/users
    body: {}                # Validation error
```

### 3. Use Descriptive Probe Names

```yaml
# Good
- name: "user CRUD operations"

# Bad
- name: "test 1"
```

### 4. Start with a Health Check

```yaml
probes:
  - type: api
    name: "health check"
    requests:
      - method: GET
        path: /health
```

This verifies the deployment is working before running complex probes.

### 5. Group Related Requests

```yaml
# Good - one probe for auth flow
- name: "authentication flow"
  requests:
    - method: POST
      path: /auth/register
    - method: POST
      path: /auth/login
    - method: GET
      path: /auth/profile

# Bad - separate probes for each
- name: "register"
  requests: [...]
- name: "login"
  requests: [...]
```

## Next Steps

- See [quick-start.md](./quick-start.md) for setup guide
- Browse `examples/` directory for working configurations
- Read the [architecture documentation](../README.md#architecture) for how Backline works
