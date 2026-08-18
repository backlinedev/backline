# Next.js API Routes Example

This example demonstrates how to use Backline with Next.js 14 App Router API routes.

## What This Example Tests

This example shows Backline testing a Next.js application with:
- **App Router API routes** - Using the new Next.js 14 route handlers
- **Dynamic routes** - Testing parameterized routes like `/api/users/[id]`
- **Multiple HTTP methods** - GET and POST requests
- **Error handling** - Testing 404 and validation errors

## What Backline Catches

Backline will detect changes such as:
- API route behavior changes after dependency updates
- Middleware modifications affecting responses
- Changes to business logic in route handlers
- Different error handling behavior
- Response structure modifications

## Next.js Specifics

### App Router vs Pages Router

This example uses the **App Router** (Next.js 13+). If you're using Pages Router, your API routes will be in `pages/api/` instead of `app/api/`.

The Backline configuration works identically for both - just update the paths if needed.

### Build Configuration

The `next.config.js` includes:
```js
output: 'standalone'
```

This is required for Docker deployment. It creates a minimal standalone build that includes only necessary dependencies.

### Long Build Times

Next.js builds can take 60+ seconds. The `.backline.yml` sets:
```yaml
wait_for:
  timeout_seconds: 60
```

Adjust this if your build takes longer.

## Configuration

The [.backline.yml](.backline.yml) file defines 3 probes:

1. **hello endpoint** - Simple GET request health check
2. **user API routes** - Tests all user-related routes including error cases
3. **search endpoint** - Tests POST with request body

### Testing Dynamic Routes

Dynamic routes like `/api/users/[id]` are tested by calling them with specific IDs:

```yaml
requests:
  - method: GET
    path: /api/users/1      # Existing user
  - method: GET
    path: /api/users/999    # Non-existent (tests 404)
```

## Running Locally

```bash
# Install dependencies
npm install

# Development mode
npm run dev

# Test with Backline (requires backline CLI)
npx backline test --config .backline.yml --head-ref HEAD --base-ref main
```

## Docker Build

The example includes a multi-stage Dockerfile optimized for Next.js standalone builds:

```bash
docker build -t nextjs-example .
docker run -p 3000:3000 nextjs-example
```

## Common Next.js Testing Patterns

### Environment Variables

```yaml
target:
  base_url: "http://localhost:3000"
  environment:
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    API_KEY: ${{ secrets.API_KEY }}
```

### Testing with Authentication

```yaml
probes:
  - type: api
    name: "protected routes"
    requests:
      - method: GET
        path: /api/profile
        headers:
          Cookie: "session=${{ secrets.TEST_SESSION_TOKEN }}"
```

### Server Actions

If you're using Server Actions, Backline can test them by calling the underlying API routes they generate.

### Middleware

Next.js middleware runs before API routes. Changes to middleware will be caught by Backline since it tests the actual HTTP responses.

## Vercel Deployment

If you deploy to Vercel, you can use Backline with the webhook adapter instead of Docker Compose:

```yaml
target:
  adapter: webhook
  # Vercel creates preview deployments automatically
```

See the Backline documentation for Vercel integration details.

## Troubleshooting

### Build Fails in Docker

Make sure you have a `.dockerignore`:
```
node_modules
.next
.git
```

### Timeout Waiting for Health

Increase the timeout:
```yaml
wait_for:
  timeout_seconds: 120
```

### Port Already in Use

Change the port in `docker-compose.yml`:
```yaml
ports:
  - "3001:3000"  # Use port 3001 on host
```

## Next Steps

- See [examples/01-express-api](../01-express-api) for Express usage
- See [examples/03-cli-tool](../03-cli-tool) for CLI testing
- Read the [full config reference](../../docs/config-reference.md)
