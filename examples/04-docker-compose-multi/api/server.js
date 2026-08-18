const express = require('express');
const redis = require('redis');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

// Redis client for job queue
const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

redisClient.connect().catch(console.error);

// Health check
app.get('/health', async (req, res) => {
  try {
    await redisClient.ping();
    res.json({
      status: 'healthy',
      redis: 'connected',
      timestamp: Date.now()
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      redis: 'disconnected',
      error: error.message,
      timestamp: Date.now()
    });
  }
});

// Submit a job
app.post('/api/jobs', async (req, res) => {
  const { type, data } = req.body;

  if (!type || !data) {
    return res.status(400).json({
      error: 'Type and data are required',
      timestamp: Date.now()
    });
  }

  const jobId = `job:${Date.now()}:${Math.random().toString(36).substr(2, 9)}`;
  const job = {
    id: jobId,
    type,
    data,
    status: 'pending',
    createdAt: Date.now()
  };

  await redisClient.set(jobId, JSON.stringify(job));
  await redisClient.lPush('job_queue', jobId);

  res.status(201).json({
    job: {
      id: jobId,
      type,
      status: 'pending'
    },
    message: 'Job submitted successfully',
    timestamp: Date.now()
  });
});

// Get job status
app.get('/api/jobs/:id', async (req, res) => {
  const jobId = req.params.id;

  const jobData = await redisClient.get(jobId);

  if (!jobData) {
    return res.status(404).json({
      error: 'Job not found',
      timestamp: Date.now()
    });
  }

  const job = JSON.parse(jobData);

  res.json({
    job,
    timestamp: Date.now()
  });
});

// List all jobs
app.get('/api/jobs', async (req, res) => {
  const keys = await redisClient.keys('job:*');
  const jobs = [];

  for (const key of keys) {
    const jobData = await redisClient.get(key);
    if (jobData) {
      jobs.push(JSON.parse(jobData));
    }
  }

  res.json({
    jobs: jobs.sort((a, b) => b.createdAt - a.createdAt),
    total: jobs.length,
    timestamp: Date.now()
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`API server listening at http://0.0.0.0:${port}`);
});
