# Express API Example

This example demonstrates how to use Backline with a typical Express REST API.

## What This Example Tests

This example shows Backline testing a simple Express API with:
- **Health check endpoint** - Verifies the service is running
- **User CRUD operations** - GET all users, GET user by ID, POST create user
- **Search endpoint** - POST with query parameters

## What Backline Catches

Backline will detect runtime behavior changes such as:
- Changes to response structure (new/removed fields)
- Different response status codes
- Changes in business logic (different search results, filtering logic)
- Dependency upgrades that alter behavior
- Configuration changes affecting API responses

## Configuration

The [.backline.yml](.backline.yml) file defines 3 probes:

1. **health check** - Simple GET request to verify the service
2. **user endpoints** - Tests multiple user-related endpoints
3. **search endpoint** - Tests POST endpoint with request body

### Ignored Fields

The config ignores fields that change on every run:
- `timestamp` - Always different between runs
- `user.id` - Random ID generated for new users

These are expected to vary and aren't true behavior changes.

## Running Locally

Test Backline without CI:

```bash
# From the example directory
npm install

# Run Backline (requires backline CLI installed globally)
npx backline test --config .backline.yml --head-ref HEAD --base-ref main
```

This will:
1. Deploy your current branch
2. Deploy the base branch (main)
3. Run all probes against both
4. Show the diff in your terminal

## GitHub Actions Setup

The example includes [.github/workflows/backline.yml](.github/workflows/backline.yml).

Copy this workflow to your repo's `.github/workflows/` directory to run Backline on every PR.

## Use Cases

This pattern works for:
- REST APIs with Express, Fastify, Koa
- Microservices with multiple endpoints
- APIs that integrate with databases or external services
- Any HTTP-based backend

## Common Modifications

### Add Authentication
```yaml
probes:
  - type: api
    name: "authenticated endpoints"
    requests:
      - method: GET
        path: /api/profile
        headers:
          Authorization: "Bearer ${{ secrets.TEST_TOKEN }}"
```

### Test Error Cases
```yaml
probes:
  - type: api
    name: "error handling"
    requests:
      - method: GET
        path: /api/users/99999  # Non-existent user
      - method: POST
        path: /api/users
        body: {}  # Invalid - missing required fields
```

### Add Query Parameters
```yaml
probes:
  - type: api
    name: "pagination"
    requests:
      - method: GET
        path: /api/users?page=1&limit=10
```

## Next Steps

- See [examples/02-nextjs-api-routes](../02-nextjs-api-routes) for Next.js usage
- See [examples/03-cli-tool](../03-cli-tool) for CLI testing
- Read the [full config reference](../../docs/config-reference.md)
