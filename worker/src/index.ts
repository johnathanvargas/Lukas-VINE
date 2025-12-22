import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// Create Redis connection
const connection = new IORedis(REDIS_URL, {
  maxRetriesPerRequest: null,
});

// Create a queue for reminders
const reminderQueue = new Queue('reminders', { connection });

// Create a worker to process reminder jobs
const reminderWorker = new Worker(
  'reminders',
  async (job) => {
    console.log(`Processing reminder job ${job.id}:`, job.data);
    
    // In a real implementation, this would:
    // 1. Fetch the task and reminder details from the database
    // 2. Send a notification (email, push, SMS, etc.)
    // 3. Mark the reminder as sent
    
    const { taskId, reminderId, message } = job.data;
    
    console.log(`[REMINDER] Task ID: ${taskId}`);
    console.log(`[REMINDER] Reminder ID: ${reminderId}`);
    console.log(`[REMINDER] Message: ${message}`);
    console.log(`[REMINDER] Would send notification here...`);
    
    // Simulate some processing time
    await new Promise((resolve) => setTimeout(resolve, 1000));
    
    return { success: true, processedAt: new Date().toISOString() };
  },
  { connection }
);

// Event handlers
reminderWorker.on('completed', (job) => {
  console.log(`✅ Job ${job.id} completed successfully`);
});

reminderWorker.on('failed', (job, err) => {
  console.error(`❌ Job ${job?.id} failed:`, err);
});

reminderWorker.on('error', (err) => {
  console.error('Worker error:', err);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing worker gracefully...');
  await reminderWorker.close();
  await connection.quit();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing worker gracefully...');
  await reminderWorker.close();
  await connection.quit();
  process.exit(0);
});

console.log('🚀 Worker started and listening for jobs...');
console.log(`Connected to Redis at ${REDIS_URL}`);

// Add a sample job for testing (optional, can be removed)
async function addSampleJob() {
  await reminderQueue.add('test-reminder', {
    taskId: 'sample-task-123',
    reminderId: 'sample-reminder-456',
    message: 'This is a test reminder',
  });
  console.log('Added sample reminder job');
}

// Uncomment to add a sample job on startup
// addSampleJob();
