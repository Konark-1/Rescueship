import { Queue, Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis';
import { Merchant, AuditLog } from '../models';
import { emailService } from '../services/email.service';
import { alertService } from '../services/alert.service';
import { logger } from '../utils/logger';

export const SUBSCRIPTION_LIFECYCLE_QUEUE_NAME = 'subscription-lifecycle';
export const subscriptionLifecycleQueue = new Queue(SUBSCRIPTION_LIFECYCLE_QUEUE_NAME, {
  connection: redisConnection as any,
});

export const setupSubscriptionLifecycleWorker = () => {
  const worker = new Worker(
    SUBSCRIPTION_LIFECYCLE_QUEUE_NAME,
    async (job: Job) => {
      logger.info('Running daily subscription lifecycle watchdog', { jobId: job.id });
      const now = Date.now();
      const appUrl = process.env.FRONTEND_URL || 'https://rescueship.netlify.app';
      const renewUrl = `${appUrl}/billing?renew=true`;

      // Find all merchants with an active or pending subscription
      const merchants = await Merchant.find({
        $or: [
          { 'billing.status': { $in: ['active', 'past_due'] } },
          { licenseStatus: { $in: ['ACTIVE', 'APPROACHING_EXPIRY'] } },
          { 'billing.plan': { $ne: 'free_trial' } },
        ],
      }).select('_id name email billing licenseStatus accessExpiresAt');

      let remindersSent = 0;
      let expiredCount = 0;
      let trialRemindersSent = 0;
      let trialExpiredCount = 0;

      for (const merchant of merchants) {
        try {
          const billing = merchant.billing || {};
          const plan = billing.plan || 'starter';
          const expiryDate = billing.nextInvoiceDate
            ? new Date(billing.nextInvoiceDate).getTime()
            : merchant.accessExpiresAt
            ? new Date(merchant.accessExpiresAt).getTime()
            : null;

          if (!expiryDate) continue;

          const diffMs = expiryDate - now;
          const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
          const mId = merchant._id.toString();

          // ─── 0. Dunning (failed charge, cycle not yet expired) ───
          // payment.failed marked the merchant past_due with the gateway reason.
          // While the paid period still has time, nudge them daily to fix the
          // payment method before access is suspended.
          if (billing.status === 'past_due' && billing.lastPaymentError && daysLeft > 1) {
            const cacheKey = `sub_dunning_${mId}_${new Date().toISOString().slice(0, 10)}`;
            const alreadySent = await (redisConnection as any).get(cacheKey);
            if (!alreadySent) {
              await emailService.sendPaymentFailedAlert(
                merchant.email,
                merchant.name || 'Merchant',
                plan,
                billing.lastPaymentError,
                renewUrl
              );
              await (redisConnection as any).set(cacheKey, '1', 'EX', 86400);
              remindersSent++;
              logger.info('Dunning reminder delivered for failed renewal charge', { merchantId: mId, daysLeft });
            }
          }

          // ─── 1. Pre-Expiry Reminders (7 days, 3 days, 1 day before expiry) ───
          if (daysLeft === 7 || daysLeft === 3 || daysLeft === 1) {
            const cacheKey = `sub_remind_${mId}_${daysLeft}_${new Date().toISOString().slice(0, 10)}`;
            const alreadySent = await (redisConnection as any).get(cacheKey);

            if (!alreadySent) {
              await emailService.sendSubscriptionExpiringReminder(
                merchant.email,
                merchant.name || 'Merchant',
                daysLeft,
                plan,
                renewUrl
              );
              await (redisConnection as any).set(cacheKey, '1', 'EX', 86400); // 24h dedup

              await Merchant.updateOne(
                { _id: merchant._id },
                { $set: { licenseStatus: 'APPROACHING_EXPIRY' } }
              );

              remindersSent++;
              logger.info('Subscription pre-expiry reminder delivered', {
                merchantId: mId,
                daysLeft,
                plan,
              });
            }
          }

          // ─── 2. Grace Period Warning (0 to 3 days overdue) ───
          else if (daysLeft <= 0 && daysLeft >= -3) {
            const cacheKey = `sub_grace_${mId}_${new Date().toISOString().slice(0, 10)}`;
            const alreadySent = await (redisConnection as any).get(cacheKey);

            if (!alreadySent) {
              await emailService.sendSubscriptionExpiringReminder(
                merchant.email,
                merchant.name || 'Merchant',
                0,
                plan,
                renewUrl
              );
              await (redisConnection as any).set(cacheKey, '1', 'EX', 86400);
            }
          }

          // ─── 3. Hard Cutoff (> 3 days overdue) ───
          else if (daysLeft < -3) {
            if (billing.status !== 'past_due' || merchant.licenseStatus !== 'EXPIRED') {
              await Merchant.updateOne(
                { _id: merchant._id },
                {
                  $set: {
                    'billing.status': 'past_due',
                    licenseStatus: 'EXPIRED',
                  },
                }
              );

              await emailService.sendSubscriptionExpiredAlert(
                merchant.email,
                merchant.name || 'Merchant',
                plan,
                renewUrl
              );

              // In-app banner as well (the branded email is already sent above).
              await alertService.sendBillingAlert(
                merchant._id.toString(),
                'subscription.expired',
                'Your subscription expired and automated protection is suspended. Renew from the billing page to restore rescues instantly.',
                { email: false }
              );

              await AuditLog.create({
                merchantId: merchant._id,
                action: 'subscription_auto_expired',
                source: 'subscription_lifecycle_job',
                payload: { plan, expiryDate: new Date(expiryDate), daysOverdue: Math.abs(daysLeft) },
                status: 'success',
              });

              expiredCount++;
              logger.warn('Merchant subscription hard-expired and suspended', {
                merchantId: mId,
                daysOverdue: Math.abs(daysLeft),
              });
            }
          }
        } catch (merchantErr: any) {
          logger.error('Error processing merchant in subscription watchdog', {
            merchantId: merchant._id,
            error: merchantErr.message,
          });
        }
      }

      // No free trial (pay-first + 90-day money-back guarantee): nothing to remind.
      const trialMerchants: unknown[] = [];

      logger.info('Subscription lifecycle watchdog run complete', {
        merchantsChecked: merchants.length,
        remindersSent,
        expiredCount,
        trialMerchantsChecked: trialMerchants.length,
        trialRemindersSent,
        trialExpiredCount,
      });

      return {
        merchantsChecked: merchants.length,
        remindersSent,
        expiredCount,
        trialRemindersSent,
        trialExpiredCount,
      };
    },
    { connection: redisConnection as any, autorun: false }
  );

  worker.on('error', (err) => {
    logger.warn('Subscription lifecycle worker Redis warning', { error: err.message });
  });

  worker.on('failed', (job, err) => {
    logger.error('Subscription lifecycle worker failed', { jobId: job?.id, error: err.message });
  });

  return worker;
};

export const scheduleSubscriptionLifecycle = async () => {
  // Run daily at 04:00 UTC (09:30 AM IST)
  await subscriptionLifecycleQueue.add(
    'daily-subscription-watchdog',
    {},
    {
      repeat: {
        pattern: '0 4 * * *',
      },
    }
  );
  logger.info('Scheduled daily subscription lifecycle watchdog cron job (0 4 * * *)');
};
