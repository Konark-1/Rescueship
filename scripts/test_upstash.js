const Redis = require('ioredis');

async function testUpstash() {
  const url = 'rediss://:gQAAAAAAAncdAAIgcDJiNmUxMGNjYmU3MDg0Y2MwYWFlM2E3OTE1YjcyZGViMg@blessed-bee-161565.upstash.io:6379';
  const redis = new Redis(url, {
    connectTimeout: 5000,
    maxRetriesPerRequest: 1
  });

  try {
    const pong = await redis.ping();
    console.log('Upstash Redis PING SUCCESS:', pong);
    await redis.quit();
  } catch (err) {
    console.error('Upstash Redis PING FAILED:', err.message);
    redis.disconnect();
  }
}

testUpstash();
