const Redis = require('ioredis');
require('dotenv').config();

async function testRedis() {
  const redis = new Redis(process.env.REDIS_URL, {
    tls: { rejectUnauthorized: false }
  });

  try {
    const pong = await redis.ping();
    console.log('Render Redis PING SUCCESS:', pong);
    await redis.quit();
  } catch (err) {
    console.error('Render Redis PING FAILED:', err.message);
  }
}

testRedis();
