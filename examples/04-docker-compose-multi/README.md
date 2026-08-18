# Multi-Service Docker Compose Example

This example demonstrates how to use Backline with a multi-service architecture using Docker Compose.

## Architecture

This example includes three services:

1. **API** (Express) - HTTP API for job submission
2. **Worker** (Node.js) - Background worker that processes jobs
3. **Redis** - Job queue and storage

```
┌─────────┐      ┌───────┐      ┌────────┐
│   API   │─────▶│ Redis │◀─────│ Worker │
└─────────┘      └───────┘      └────────┘
    HTTP           Queue         Background
```

## What This Example Tests

Backline tests the **API layer** while the worker and Redis run in the background:

- Job submission endpoints
- Job retrieval and listing
- Different job processing types
- Error handling
- Multi-service integration

## What Backline Catches

This setup detects:
- Changes to API response structure
- Different job processing logic
- Redis integration issues
- Queue behavior changes
- Worker processing changes (reflected in API responses)

## How It Works

### Job Flow

1. Client POSTs to `/api/jobs` with job data
2. API stores job in Redis and adds to queue
3. Worker picks up job from queue
4. Worker processes job and updates status
5. Client GETs `/api/jobs/:id` to check status

### Testing the Full Stack

Even though Backline only calls the API, it tests the entire stack:

```yaml
probes:
  - type: api
    name: "job submission"
    requests:
      - method: POST
        path: /api/jobs
        body:
          type: "uppercase"
          data: "hello"
```

This tests:
- API handling ✓
- Redis connectivity ✓
- Queue insertion ✓
- Worker picks up job (eventually)

## Configuration

### Docker Compose

The [docker-compose.yml](docker-compose.yml) defines all three services:

```yaml
services:
  redis:
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      
  api:
    depends_on:
      redis:
        condition: service_healthy
        
  worker:
    depends_on:
      redis:
        condition: service_healthy
```

**Key points:**
- Redis has a healthcheck
- API and worker wait for Redis to be healthy
- Services can talk to each other by service name (`redis://redis:6379`)

### Backline Config

The [.backline.yml](.backline.yml) only needs to know about the API:

```yaml
target:
  base_url: "http://localhost:3000"
  wait_for:
    path: /health
```

Backline doesn't need to know about Redis or the worker - it just tests the API surface.

## Running Locally

```bash
# Start all services
docker-compose up

# In another terminal, test the API
curl http://localhost:3000/health
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"type": "uppercase", "data": "hello"}'

# Run Backline
npx backline test --config .backline.yml --head-ref HEAD --base-ref main
```

## Use Cases

This pattern applies to:
- **Microservices** - Multiple services behind an API gateway
- **Job queues** - API + background workers
- **Real-time apps** - WebSocket server + Redis + workers
- **Data pipelines** - API + ETL workers + database
- **E-commerce** - API + payment processor + email worker

## Common Multi-Service Patterns

### Database Integration

Add a PostgreSQL service:

```yaml
services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: password
    healthcheck:
      test: ["CMD", "pg_isready"]
      
  api:
    depends_on:
      postgres:
        condition: service_healthy
```

Then test database-backed endpoints:

```yaml
probes:
  - type: api
    requests:
      - method: POST
        path: /api/users
        body: { "name": "Test" }
      - method: GET
        path: /api/users
```

### Message Queues

Replace Redis with RabbitMQ or Kafka:

```yaml
services:
  rabbitmq:
    image: rabbitmq:3-management-alpine
    
  api:
    environment:
      - RABBITMQ_URL=amqp://rabbitmq:5672
```

### External Services

Mock external APIs in Docker Compose:

```yaml
services:
  mock-stripe:
    image: stripemock/stripe-mock
    ports:
      - "12111:12111"
      
  api:
    environment:
      - STRIPE_API_URL=http://mock-stripe:12111
```

## Debugging Multi-Service Issues

### Check Logs

```bash
docker-compose logs api
docker-compose logs worker
docker-compose logs redis
```

### Verify Service Communication

```bash
# Exec into API container
docker-compose exec api sh

# Test Redis connection
wget -O- http://redis:6379
```

### Health Check Failures

If Backline times out waiting for health:

1. Check Redis is actually healthy:
   ```bash
   docker-compose ps
   ```

2. Increase timeout:
   ```yaml
   wait_for:
     timeout_seconds: 60
   ```

3. Check API logs:
   ```bash
   docker-compose logs api
   ```

## Ignored Fields

Multi-service setups often have non-deterministic data:

```yaml
ignore_fields:
  - "requests[*].response.body.timestamp"
  - "requests[*].response.body.job.id"        # Random job IDs
  - "requests[*].response.body.job.createdAt" # Timestamps
```

These change on every run and aren't true behavior changes.

## Advanced: Cross-Service Timing

If your test needs to wait for worker processing:

```yaml
# Currently, Backline tests the API immediately
# Worker might still be processing

# Workaround: Add a delay in your test fixture
requests:
  - method: POST
    path: /api/jobs
    body: { "type": "uppercase", "data": "hello" }
  # Add another request that gives worker time
  - method: GET
    path: /health
  - method: GET
    path: /api/jobs  # Now worker has likely completed
```

Future Backline versions may support explicit wait conditions.

## Comparison to Single-Service

### Single Service
```yaml
services:
  api:
    build: .
```
Simple, fast builds, easy debugging.

### Multi-Service
```yaml
services:
  api: ...
  worker: ...
  redis: ...
```
More realistic, tests integration, catches inter-service issues.

**Use multi-service when:**
- Your app has multiple components
- You want to test realistic behavior
- Integration bugs are a concern

**Use single-service when:**
- Testing a standalone API
- Build speed matters
- Debugging complexity is a concern

## Next Steps

- See [examples/01-express-api](../01-express-api) for simple API setup
- See [examples/03-cli-tool](../03-cli-tool) for CLI testing
- Read the [full config reference](../../docs/config-reference.md)
