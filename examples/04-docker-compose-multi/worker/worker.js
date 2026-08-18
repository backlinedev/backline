const redis = require('redis');

const redisClient = redis.createClient({
  url: process.env.REDIS_URL || 'redis://redis:6379'
});

async function processJob(jobId) {
  console.log(`Processing job: ${jobId}`);

  const jobData = await redisClient.get(jobId);
  if (!jobData) {
    console.error(`Job ${jobId} not found`);
    return;
  }

  const job = JSON.parse(jobData);

  // Update status to processing
  job.status = 'processing';
  job.startedAt = Date.now();
  await redisClient.set(jobId, JSON.stringify(job));

  // Simulate work
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Process based on type
  let result;
  switch (job.type) {
    case 'uppercase':
      result = job.data.toUpperCase();
      break;
    case 'lowercase':
      result = job.data.toLowerCase();
      break;
    case 'reverse':
      result = job.data.split('').reverse().join('');
      break;
    case 'count':
      result = { length: job.data.length, words: job.data.split(' ').length };
      break;
    default:
      result = job.data;
  }

  // Update status to completed
  job.status = 'completed';
  job.completedAt = Date.now();
  job.result = result;
  await redisClient.set(jobId, JSON.stringify(job));

  console.log(`Completed job: ${jobId}`);
}

async function worker() {
  console.log('Worker started, waiting for jobs...');

  while (true) {
    try {
      // Block and wait for a job (BRPOP with 5 second timeout)
      const result = await redisClient.brPop('job_queue', 5);

      if (result) {
        const jobId = result.element;
        await processJob(jobId);
      }
    } catch (error) {
      console.error('Worker error:', error);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

async function main() {
  await redisClient.connect();
  console.log('Connected to Redis');
  await worker();
}

main().catch(console.error);
