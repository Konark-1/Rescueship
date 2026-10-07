import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load .env at the absolute beginning
dotenv.config({ path: path.resolve(__dirname, '../.env') });

import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { connectDatabase, disconnectDatabase } from './config/database';
import { connectRedis, disconnectRedis } from './config/redis';
import { startAllWorkers, stopAllWorkers } from './jobs';
import { globalErrorHandler, AppError } from './middleware/errorHandler';
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
import bluedartRouter from './webhooks/bluedart.webhook';
import xpressbeesRouter from './webhooks/xpressbees.webhook';
import shadowfaxRouter from './webhooks/shadowfax.webhook';
import ecomexpressRouter from './webhooks/ecomexpress.webhook';
import dtdcRouter from './webhooks/dtdc.webhook';
import whatsappRouter from './webhooks/whatsapp.webhook';
import razorpayRouter from './webhooks/razorpay.webhook';
import cashfreeRouter from './webhooks/cashfree.webhook';
import paymentRouter from './webhooks/payment.webhook';
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
const configuredOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map((o) => o.trim()).filter(Boolean)
  : [];

const defaultOrigins = [
  'http://localhost:5173',
  'http://localhost:5174',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:5174',
  'http://127.0.0.1:3000',
];

const allowedOrigins = Array.from(
  new Set([
    ...defaultOrigins,
    ...configuredOrigins,
  ])
);

const isOriginAllowed = (origin: string): boolean => {
  if (allowedOrigins.includes(origin)) return true;
  // Allow all Netlify deployments (*.netlify.app)
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)?netlify\.app$/.test(origin)) return true;
  // Allow Render deployments (*.onrender.com)
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)?onrender\.com$/.test(origin)) return true;
  // Allow Cloudflare tunnels
  if (/^https:\/\/([a-zA-Z0-9_-]+\.)?trycloudflare\.com$/.test(origin)) return true;
  return false;
};

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
      
      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }
      
      logger.warn(`CORS blocked unauthorized origin: ${origin}`);
      callback(new AppError(`CORS: origin ${origin} not allowed`, 403));
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

// NoSQL Injection Sanitizer (Express 5 compatible).
// Express 5 re-parses req.query on every access, so in-place mutation is lost; we
// override the getter with the sanitised copy instead. Keep the simple query parser
// (default) — never switch to 'extended', which can produce nested $-operators.
app.set('query parser', 'simple');
app.use((req: any, _res: any, next: any) => {
  if (req.body) mongoSanitize.sanitize(req.body);
  if (req.params) mongoSanitize.sanitize(req.params);
  // allowDots: query strings are flat key/value pairs under the 'simple' parser, so a
  // dotted key (e.g. Meta's `hub.verify_token`) can never become a nested Mongo path.
  // Only `$`-prefixed keys are dangerous here and they are still stripped.
  const q = mongoSanitize.sanitize({ ...req.query }, { allowDots: true });
  Object.defineProperty(req, 'query', { value: q, writable: true, configurable: true, enumerable: true });
  next();
});

// Legacy static demo pages (auto-create accounts on load). Local development only.
if (process.env.NODE_ENV !== 'production' && process.env.ENABLE_DEMO_MODE === 'true') {
  app.use(express.static(path.join(__dirname, 'public')));
}

// Root welcome endpoint
app.get('/', (_req, res) => {
  res.status(200).json({
    service: 'RescueShip Core API',
    status: 'online',
    health: '/health',
    version: '1.0.0',
  });
});

// Health check endpoint (deep health probe for keepalive and monitoring)
app.get('/health', async (_req, res) => {
  const { default: mongoose } = await import('mongoose');
  const mongoOk = mongoose.connection.readyState === 1;
  let redisOk = false;
  try {
    const { redisConnection } = await import('./config/redis');
    redisOk = redisConnection ? (redisConnection as any).status === 'ready' || (redisConnection as any).status === 'connect' : false;
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

// Payment link redirector. WhatsApp URL buttons must carry a FIXED host for Meta
// approval; the dynamic Razorpay/Cashfree short link is passed as the trailing
// variable. Resolve that id back to the real URL and 302 the customer.
app.get('/r/pay/:id', async (req, res) => {
  const linkId = String(req.params.id || '');
  if (!linkId || linkId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(linkId)) {
    res.status(400).send('Invalid payment link');
    return;
  }
  try {
    const { Order } = await import('./models');
    const order = await Order.findOne({ paymentLinkId: linkId }).select('paymentLinkUrl').lean();
    if (!order?.paymentLinkUrl) {
      res.status(404).send('Payment link not found or expired');
      return;
    }
    res.redirect(302, order.paymentLinkUrl);
  } catch (err: any) {
    logger.error('Payment redirect failed', { linkId, error: err?.message });
    res.status(500).send('Payment redirect unavailable');
  }
});

// Mount Webhook Routes (apply webhookLimiter)
app.use('/webhooks/shopify', webhookLimiter, shopifyRouter);
app.use('/webhooks/woocommerce', webhookLimiter, woocommerceRouter);
app.use('/webhooks/shiprocket', webhookLimiter, shiprocketRouter);
app.use('/webhooks/clickpost', webhookLimiter, clickpostRouter);
app.use('/webhooks/delhivery', webhookLimiter, delhiveryRouter);
app.use('/webhooks/bluedart', webhookLimiter, bluedartRouter);
app.use('/webhooks/xpressbees', webhookLimiter, xpressbeesRouter);
app.use('/webhooks/shadowfax', webhookLimiter, shadowfaxRouter);
app.use('/webhooks/ecomexpress', webhookLimiter, ecomexpressRouter);
app.use('/webhooks/dtdc', webhookLimiter, dtdcRouter);
app.use('/webhooks/whatsapp', webhookLimiter, whatsappRouter);
app.use('/webhooks/razorpay', webhookLimiter, razorpayRouter);
app.use('/webhooks/cashfree', webhookLimiter, cashfreeRouter);
app.use('/webhooks/payment', webhookLimiter, paymentRouter);
app.use('/webhooks/custom', webhookLimiter, customRouter);

import exportRouter from './api/export.api';
import realtimeRouter from './api/realtime.api';
import connectRouter from './api/connect.api';
import { realtimeService } from './services/realtime.service';
import { standardMerchantLimiter, exportMerchantLimiter } from './middleware/merchant-rate-limiter';

import sandboxRouter from './api/sandbox.api';
import metricsRouter from './api/metrics.api';
import plgRouter from './api/plg.api';
import aiRouter from './api/ai.api';
import dashboardRouter from './api/dashboard.api';
import liveopsRouter from './api/liveops.api';
import { startQualityMonitorWorker } from './jobs/quality-monitor.job';
import { startTemplatePollerWorker } from './jobs/template-poller.job';
import { authenticateToken } from './middleware/auth';
import { requireActiveSubscription } from './middleware/planGating.middleware';

// ─── Subscription enforcement at the API surface ───
// Every router below carries only authenticated merchant routes, so gating at
// the router level blocks expired/past-due/cancelled merchants from the
// product (orders, analytics, realtime, AI, templates, exports, metrics, audit
// logs) while keeping /api/billing, /api/settings, /api/auth and /api/connect
// reachable for renewal, account access and onboarding (trial merchants pass
// the guard via the 14-day trial fallback in subscription-guard).
for (const gatedRouter of [
  ordersRouter,
  analyticsRouter,
  aiRouter,
  templatesRouter,
  realtimeRouter,
  auditLogsRouter,
  metricsRouter,
  exportRouter,
  dashboardRouter,
]) {
  gatedRouter.use(authenticateToken, requireActiveSubscription);
}

// Mount API Routes (apply apiLimiter & per-merchant limiter)
app.use('/api/auth', apiLimiter, authRouter);
app.use('/api/connect', apiLimiter, connectRouter);
app.use('/api/sandbox', apiLimiter, sandboxRouter);
app.use('/api/metrics', apiLimiter, metricsRouter);
app.use('/api/plg', apiLimiter, plgRouter);
app.use('/api/ai', apiLimiter, standardMerchantLimiter, aiRouter);
app.use('/api/orders', apiLimiter, standardMerchantLimiter, ordersRouter);
app.use('/api/dashboard', apiLimiter, standardMerchantLimiter, dashboardRouter);
app.use('/api/analytics', apiLimiter, standardMerchantLimiter, analyticsRouter);
app.use('/api/settings', apiLimiter, standardMerchantLimiter, settingsRouter);
app.use('/api/templates', apiLimiter, standardMerchantLimiter, templatesRouter);
app.use('/api/billing', apiLimiter, standardMerchantLimiter, billingRouter);
app.use('/api/audit-logs', apiLimiter, standardMerchantLimiter, auditLogsRouter);
app.use('/api/realtime', apiLimiter, standardMerchantLimiter, realtimeRouter);
app.use('/api/liveops', apiLimiter, liveopsRouter);


// Export API — stricter per-merchant limit (5 req/min)
app.use('/api/export', apiLimiter, exportMerchantLimiter, exportRouter);

// Serve frontend static assets in production if available
const frontendDistPath = path.resolve(__dirname, '../frontend/dist');
if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));

  app.use((req, res, next) => {
    if (
      req.method !== 'GET' ||
      req.path.startsWith('/api') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/webhooks')
    ) {
      return next();
    }
    res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

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

    // 1. Start Server immediately so health check and port detection pass instantly
    const server = app.listen(Number(PORT), '0.0.0.0', () => {
      logger.info(`🚀  RescueShip Engine started on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    });

    // 2. Connect MongoDB
    await connectDatabase();
    await ensureIndexes();

    // 3. Connect Redis
    const redisHealthy = await connectRedis();

    // 4. Start BullMQ Workers only when Redis is healthy and under quota (unless running in a dedicated worker process)
    if (process.env.DISABLE_INLINE_WORKERS === 'true') {
      logger.info('ℹ️  Inline BullMQ workers disabled via DISABLE_INLINE_WORKERS=true (handled by dedicated worker process)');
    } else if (redisHealthy) {
      startAllWorkers();
      startQualityMonitorWorker();
      startTemplatePollerWorker();
    } else {
      logger.warn('⚠️  Redis is currently unavailable or has exceeded quota. Core API is running, BullMQ background queues are safely paused.');
    }

    // 5. Enterprise Graceful Shutdown Handler (SIGTERM / SIGINT)
    let isShuttingDown = false;
    const shutdown = async (signal: string) => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      logger.info(`[SHUTDOWN] Received ${signal}. Initiating graceful teardown of RescueShip…`);

      // Set emergency fallback watchdog (force exit after 10s if tasks hang)
      const forceExitTimer = setTimeout(() => {
        logger.error('[SHUTDOWN] Teardown exceeded 10s timeout, forcing process termination');
        process.exit(1);
      }, 10000);
      forceExitTimer.unref();

      try {
        // 1. Stop accepting new incoming HTTP connections
        await new Promise<void>((resolve) => {
          server.close((err) => {
            if (err) logger.warn('[SHUTDOWN] Warning while closing HTTP server', { error: err.message });
            else logger.info('[SHUTDOWN] Express HTTP server stopped');
            resolve();
          });
        });

        // 2. Gracefully drain and stop all BullMQ background workers
        try {
          await stopAllWorkers();
        } catch (workerErr: any) {
          logger.warn('[SHUTDOWN] Error stopping BullMQ workers', { error: workerErr.message });
        }

        // 3. Stop carrier dispatch & DLQ workers if active
        try {
          const { carrierDispatchWorker, carrierDlqWorker } = await import('./workers/carrier-dispatch.worker');
          await Promise.all([
            carrierDispatchWorker?.close(),
            carrierDlqWorker?.close(),
          ]);
        } catch {}

        // 4. Teardown SSE Realtime connections
        try {
          realtimeService.shutdown();
        } catch {}

        // 5. Close Redis connection
        try {
          await disconnectRedis();
        } catch (redisErr: any) {
          logger.warn('[SHUTDOWN] Error disconnecting Redis', { error: redisErr.message });
        }

        // 6. Close MongoDB connection
        try {
          await disconnectDatabase();
        } catch (dbErr: any) {
          logger.warn('[SHUTDOWN] Error disconnecting MongoDB', { error: dbErr.message });
        }

        logger.info('✅ [SHUTDOWN] Graceful teardown complete. Goodbye.');
        clearTimeout(forceExitTimer);
        process.exit(0);
      } catch (fatalShutdownErr: any) {
        logger.error('[SHUTDOWN] Fatal error during shutdown sequence', { error: fatalShutdownErr.message });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (err: any) {
    logger.error('Failed to bootstrap application', { error: err.message });
    process.exit(1);
  }
}

bootstrap();
