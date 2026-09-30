/**
 * health.api.test.ts
 *
 * Tests for deep health check endpoint /health.
 */

import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { redisConnection } from '../config/redis';

jest.mock('../config/redis', () => ({
  redisConnection: {
    status: 'ready',
    ping: jest.fn().mockResolvedValue('PONG'),
  },
}));

let mockReadyState = 1;

jest.mock('mongoose', () => {
  const actual = jest.requireActual('mongoose');
  return {
    __esModule: true,
    ...actual,
    default: {
      ...actual,
      connection: {
        ...actual.connection,
        get readyState() {
          return mockReadyState;
        },
      },
    },
    connection: {
      ...actual.connection,
      get readyState() {
        return mockReadyState;
      },
    },
  };
});

describe('GET /health', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.get('/health', async (_req, res) => {
      const mongoOk = mongoose.connection.readyState === 1;
      let redisOk = false;
      try {
        const { redisConnection: rc } = await import('../config/redis');
        redisOk = rc ? (rc as any).status === 'ready' || (rc as any).status === 'connect' : false;
      } catch {
        redisOk = false;
      }

      const isHealthy = mongoOk && redisOk;
      res.status(mongoOk ? 200 : 503).json({
        status: isHealthy ? 'healthy' : mongoOk ? 'degraded' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        checks: {
          mongodb: mongoOk ? 'ok' : 'disconnected',
          redis: redisOk ? 'ok' : 'disconnected',
        },
      });
    });
  });

  beforeEach(() => {
    mockReadyState = 1;
    (redisConnection as any).status = 'ready';
  });

  it('returns healthy status when services are connected', async () => {
    mockReadyState = 1;

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('healthy');
    expect(res.body.checks.mongodb).toBe('ok');
    expect(res.body.checks.redis).toBe('ok');
  });

  it('returns degraded status when Redis is disconnected but MongoDB is connected', async () => {
    mockReadyState = 1;
    (redisConnection as any).status = 'disconnected';

    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.mongodb).toBe('ok');
    expect(res.body.checks.redis).toBe('disconnected');
    (redisConnection as any).status = 'ready';
  });

  it('returns 503 unhealthy when MongoDB is disconnected', async () => {
    mockReadyState = 0;

    const res = await request(app).get('/health');
    expect(res.status).toBe(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.mongodb).toBe('disconnected');
  });
});
