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

// Setup Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Capture raw body for signature verification and parse JSON
app.use(
  express.json({
    verify: (req: any, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Prevent HTTP Parameter Pollution (must be after express.json)
app.use(hpp());

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

// Mount API Routes (apply apiLimiter)
app.use('/api/auth', apiLimiter, authRouter);
app.use('/api/orders', apiLimiter, ordersRouter);
app.use('/api/analytics', apiLimiter, analyticsRouter);
app.use('/api/settings', apiLimiter, settingsRouter);
app.use('/api/templates', apiLimiter, templatesRouter);
app.use('/api/billing', apiLimiter, billingRouter);
app.use('/api/audit-logs', apiLimiter, auditLogsRouter);

// Global Error Handler
app.use(globalErrorHandler);

/**
 * Bootstrap connections, start workers and listen to port
 */
async function bootstrap() {
  try {
    // 1. Connect MongoDB
    await connectDatabase();

    // 2. Connect Redis
    await connectRedis();

    // 3. Start BullMQ Workers
    startAllWorkers();

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
