import dotenv from 'dotenv';
import path from 'path';

// Load .env at the absolute beginning
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { startAllWorkers, stopAllWorkers } from './jobs';
import { globalErrorHandler } from './middleware/errorHandler';
import { webhookLimiter, apiLimiter } from './middleware/rateLimiter';
import { logger } from './utils/logger';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';

// Webhook Routers
import shopifyRouter from './webhooks/shopify.webhook';
import woocommerceRouter from './webhooks/woocommerce.webhook';
import shiprocketRouter from './webhooks/shiprocket.webhook';
import clickpostRouter from './webhooks/clickpost.webhook';
import delhiveryRouter from './webhooks/delhivery.webhook';
import whatsappRouter from './webhooks/whatsapp.webhook';
import razorpayRouter from './webhooks/razorpay.webhook';
import cashfreeRouter from './webhooks/cashfree.webhook';
import customRouter from './webhooks/custom.webhook';

// API Routers
import authRouter from './api/auth.api';
import ordersRouter from './api/orders.api';
import analyticsRouter from './api/analytics.api';
import settingsRouter from './api/settings.api';
import templatesRouter from './api/templates.api';
import billingRouter from './api/billing.api';
import auditLogsRouter from './api/auditlogs.api';

const app = express();
const PORT = process.env.PORT || 3000;

// 🔒 SEC-02 FIX: Strict Reverse Proxy Trust Configuration
// If you are behind Cloudflare, Nginx, or AWS ALB, define their CIDRs in .env:
// TRUSTED_PROXIES=173.245.48.0/20,103.21.244.0/22,10.0.0.0/8
// If deployed directly or behind a local proxy, use loopback/linklocal.
const trustedProxies = process.env.TRUSTED_PROXIES 
  ? process.env.TRUSTED_PROXIES.split(',').map(ip => ip.trim())
  : ['loopback', 'linklocal', 'uniquelocal'];

app.set('trust proxy', trustedProxies);

// Note: If you specifically need the true client IP from Cloudflare for logging 
// (and not for rate limiting), use a custom property like `req.clientIp` instead of overwriting `req.ip`.
app.use((req: any, _res: any, next: any) => {
  req.clientIp = req.headers['cf-connecting-ip'] || req.ip;
  next();
});

// ───────────────────────────────────────────────
// 🔒 1. STRICT SECURITY HEADERS (HELMET + CSP)
// ───────────────────────────────────────────────
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(o => o.trim())
  : ['http://localhost:5173'];

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'", 
          "'unsafe-inline'", // Required for Vite/React hydration
          "https://checkout.razorpay.com", 
          "https://sdk.cashfree.com"
        ],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'", 
          "https://api.razorpay.com", 
          "https://api.cashfree.com",
          "wss:", "ws:" // Required for SSE/WebSocket realtime connections
        ],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        frameAncestors: ["'none'"], // Prevents Clickjacking (replaces X-Frame-Options)
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  })
);

// ───────────────────────────────────────────────
// 🔒 2. DYNAMIC CORS ENFORCEMENT
// ───────────────────────────────────────────────
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (server-to-server, mobile apps, curl, Postman)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      logger.warn(`CORS blocked unauthorized origin: ${origin}`);
      callback(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-Hub-Signature-256',
      'X-Razorpay-Signature',
      'X-WC-Webhook-Signature',
      'X-Shopify-Hmac-Sha256',
      'x-webhook-signature',
      'x-webhook-timestamp',
      'x-api-key',
    ],
  })
);

// Capture raw body for signature verification and parse JSON
app.use(
  express.json({
    limit: '1mb',
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Prevent HTTP Parameter Pollution (must be after express.json)
app.use(hpp());

// NoSQL Injection Sanitizer (Express 5 compatible)
app.use((req: any, _res: any, next: any) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  if (req.query) mongoSanitize.sanitize(req.query);
  next();
});

// Serve Static Dashboard UI
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});

// Mount Webhook Routes (apply webhookLimiter)
app.use('/webhooks/shopify', webhookLimiter, shopifyRouter);
app.use('/webhooks/woocommerce', webhookLimiter, woocommerceRouter);
app.use('/webhooks/shiprocket', webhookLimiter, shiprocketRouter);
app.use('/webhooks/clickpost', webhookLimiter, clickpostRouter);
app.use('/webhooks/delhivery', webhookLimiter, delhiveryRouter);
app.use('/webhooks/whatsapp', webhookLimiter, whatsappRouter);
app.use('/webhooks/razorpay', webhookLimiter, razorpayRouter);
app.use('/webhooks/cashfree', webhookLimiter, cashfreeRouter);
app.use('/webhooks/custom', webhookLimiter, customRouter);

import exportRouter from './api/export.api';
import realtimeRouter from './api/realtime.api';
import connectRouter from './api/connect.api';
import { realtimeService } from './services/realtime.service';
import { standardMerchantLimiter, exportMerchantLimiter } from './middleware/merchant-rate-limiter';

import sandboxRouter from './api/sandbox.api';
import metricsRouter from './api/metrics.api';
import plgRouter from './api/plg.api';
import { featureFlags } from './services/feature-flags.service';
import { startQualityMonitorWorker } from './jobs/quality-monitor.job';
import { startTemplatePollerWorker } from './jobs/template-poller.job';

// Mount API Routes (apply apiLimiter & per-merchant limiter)
app.use('/api/auth', apiLimiter, authRouter);
app.use('/api/connect', apiLimiter, connectRouter);
app.use('/api/sandbox', apiLimiter, sandboxRouter);
app.use('/api/metrics', apiLimiter, metricsRouter);
app.use('/api/plg', apiLimiter, plgRouter);
app.use('/api/orders', apiLimiter, standardMerchantLimiter, ordersRouter);
app.use('/api/analytics', apiLimiter, standardMerchantLimiter, analyticsRouter);
app.use('/api/settings', apiLimiter, standardMerchantLimiter, settingsRouter);
app.use('/api/templates', apiLimiter, standardMerchantLimiter, templatesRouter);
app.use('/api/billing', apiLimiter, standardMerchantLimiter, billingRouter);
app.use('/api/audit-logs', apiLimiter, standardMerchantLimiter, auditLogsRouter);
app.use('/api/realtime', apiLimiter, standardMerchantLimiter, realtimeRouter);

// Export API — stricter per-merchant limit (5 req/min)
app.use('/api/export', apiLimiter, exportMerchantLimiter, exportRouter);

// Global Error Handler
app.use(globalErrorHandler);

import { validateEnvironment } from './config/startup-validator';
import { ensureIndexes } from './models/indexes';

/**
 * Bootstrap connections, start workers and listen to port
 */
async function bootstrap() {
  try {
    // 0. Validate Environment
    validateEnvironment();

    // 1. Connect MongoDB
    await connectDatabase();
    await ensureIndexes();

    // 2. Connect Redis
    await connectRedis();

    // 3. Start BullMQ Workers
    startAllWorkers();
    startQualityMonitorWorker();
    startTemplatePollerWorker();

    // 4. Start Server
    const server = app.listen(PORT, () => {
      logger.info(`🚀  RescueShip Engine started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // Graceful Shutdown Handler
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Starting graceful shutdown…`);
      
      // Stop accepting requests
      server.close(() => {
        logger.info('Express server closed');
      });

      // Stop workers
      await stopAllWorkers();

      // Shutdown SSE Realtime Service
      realtimeService.shutdown();

      // Disconnect connections
      await disconnectRedis();
      await disconnectDatabase();

      logger.info('Graceful shutdown completed successfully');
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err: any) {
    logger.error('Failed to bootstrap application', { error: err.message });
    process.exit(1);
  }
}

bootstrap();
