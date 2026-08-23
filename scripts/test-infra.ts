import mongoose from 'mongoose';
import Redis from 'ioredis';

async function testConnections() {
  console.log('Testing MongoDB connection...');
  try {
    await mongoose.connect('mongodb://localhost:27017/rescueship', { serverSelectionTimeoutMS: 3000 });
    console.log('✅ MongoDB connection successful!');
    await mongoose.disconnect();
  } catch (e: any) {
    console.log('❌ MongoDB connection failed:', e.message);
  }

  console.log('Testing Redis connection...');
  try {
    const redis = new Redis({ host: 'localhost', port: 6379, connectTimeout: 3000, maxRetriesPerRequest: 1 });
    const pong = await redis.ping();
    console.log('✅ Redis connection successful! PING ->', pong);
    await redis.quit();
  } catch (e: any) {
    console.log('❌ Redis connection failed:', e.message);
  }
  process.exit(0);
}
testConnections();
