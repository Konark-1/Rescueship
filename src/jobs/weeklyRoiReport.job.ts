import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant, AuditLog } from '../models';
import { roiCalculatorService } from '../services/analytics/roi-calculator.service';
import { whatsAppService } from '../services/whatsapp.service';
import { encryptionService } from '../services/encryption.service';
import { logger } from '../utils/logger';

export const WEEKLY_ROI_REPORT_QUEUE_NAME = 'weekly-roi-report';

export const weeklyRoiReportQueue = new Queue(WEEKLY_ROI_REPORT_QUEUE_NAME, {
  connection: redisConnection as any,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 500,
  },
});

/**
 * Weekly Sunday automated ROI report job processor.
 * Aggregates weekly NDR rescues, location pins, and RTO fees saved,
 * then dispatches a WhatsApp summary to the merchant owner's phone.
 */
export function setupWeeklyRoiReportWorker(): Worker {
  const worker = new Worker(
    WEEKLY_ROI_REPORT_QUEUE_NAME,
    async (job: Job) => {
      logger.info('Running weekly Sunday ROI report job...', { jobId: job.id });

      const now = new Date();
      const startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const endDate = now;

      const activeMerchants = await Merchant.find({
        $or: [
          { licenseStatus: { $in: ['ACTIVE', 'TRIAL', 'APPROACHING_EXPIRY'] } },
          { licenseStatus: { $exists: false }, 'billing.status': 'active' },
        ],
      }).lean();

      logger.info(`Found ${activeMerchants.length} active merchants for weekly ROI report`);

      let dispatchedCount = 0;
      let skippedCount = 0;

      for (const merchant of activeMerchants) {
        const phone = merchant.ownerPhone || (merchant as any).phone;
        if (!phone) {
          logger.warn('Skipping weekly ROI report: merchant has no owner phone configured', {
            merchantId: merchant._id,
          });
          skippedCount++;
          continue;
        }

        try {
          const metrics = await roiCalculatorService.getWeeklyReportMetrics(
            merchant._id.toString(),
            startDate,
            endDate
          );

          if (!metrics) {
            skippedCount++;
            continue;
          }

          let waConfig: any = undefined;
          if (merchant.whatsappConfig?.phoneNumberId && merchant.whatsappConfig?.accessToken) {
            let token = merchant.whatsappConfig.accessToken;
            try {
              token = encryptionService.decrypt(token);
            } catch (decErr: any) {
              logger.warn('Could not decrypt merchant WhatsApp token, falling back to raw/platform', {
                merchantId: merchant._id,
              });
            }
            waConfig = {
              phoneNumberId: merchant.whatsappConfig.phoneNumberId,
              accessToken: token,
              businessAccountId: merchant.whatsappConfig.businessAccountId,
            };
          }

          await whatsAppService.sendText(phone, metrics.summaryMessage, waConfig);
          dispatchedCount++;

          await AuditLog.create({
            merchantId: merchant._id,
            action: 'weekly_roi_report_dispatched',
            source: 'weekly_roi_job',
            payload: {
              phone,
              interceptedCount: metrics.interceptedCount,
              rtoFeesSaved: metrics.rtoFeesSaved,
              message: metrics.summaryMessage,
            },
            status: 'success',
          });

          logger.info('Weekly ROI report successfully sent to merchant', {
            merchantId: merchant._id,
            phone,
            rtoFeesSaved: metrics.rtoFeesSaved,
          });
        } catch (merchantErr: any) {
          logger.error('Failed to send weekly ROI report to merchant', {
            merchantId: merchant._id,
            error: merchantErr.message,
          });
        }
      }

      logger.info('Weekly ROI report job completed', {
        totalMerchants: activeMerchants.length,
        dispatchedCount,
        skippedCount,
      });

      return { total: activeMerchants.length, dispatchedCount, skippedCount };
    },
    { connection: redisConnection as any, autorun: false }
  );

  worker.on('error', (err: Error) => {
    logger.warn('Weekly ROI report worker Redis warning', { error: err.message });
  });

  worker.on('failed', (job: Job | undefined, err: Error) => {
    logger.error('Weekly ROI report job failed', { jobId: job?.id, error: err.message });
  });

  return worker;
}

/**
 * Schedule repeatable job for every Sunday at 9:00 AM (0 9 * * 0)
 */
export const scheduleWeeklyRoiReport = async (): Promise<void> => {
  await weeklyRoiReportQueue.add(
    'send-weekly-roi-reports',
    {},
    {
      repeat: {
        pattern: '0 9 * * 0',
      },
    }
  );
  logger.info('Scheduled weekly Sunday ROI report cron job (0 9 * * 0)');
};
