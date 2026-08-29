import { redisConnection } from '../config/redis';
import { logger } from './logger';
import { SecurityAlertService } from '../services/security-alert.service';

/**
 * TenantCircuitBreaker
 *
 * Implements per-tenant failure tracking and circuit breaking in BullMQ workers.
 * If a tenant enters invalid credentials or causes repeated outbound API errors,
 * the circuit breaker trips for a cooldown window (default: 15 minutes) to protect
 * Redis queues from being starved by failing jobs.
 */
export class TenantCircuitBreaker {
  private static readonly FAILURE_THRESHOLD = 5; // 5 failures within window
  private static readonly WINDOW_SECONDS = 3600; // 1 hour failure counting window
  private static readonly TRIP_DURATION_SECONDS = 900; // 15 minutes cooldown if tripped

  /**
   * Checks if the tenant's circuit breaker is open (tripped).
   */
  public static async isCircuitOpen(merchantId: string): Promise<boolean> {
    if (!merchantId) return false;
    try {
      const tripped = await redisConnection.get(`circuit_breaker:${merchantId}`);
      return tripped === '1';
    } catch (err: any) {
      logger.error('Circuit breaker check error in Redis', { merchantId, error: err.message });
      return false; // Fail-open so a Redis glitch doesn't block innocent tenants
    }
  }

  /**
   * Records a job success for the tenant, resetting their failure counter.
   */
  public static async recordSuccess(merchantId: string): Promise<void> {
    if (!merchantId) return;
    try {
      await redisConnection.del(`api_failures:${merchantId}`);
    } catch (err: any) {
      logger.warn('Failed to reset circuit breaker counter', { merchantId, error: err.message });
    }
  }

  /**
   * Records a job failure for the tenant. If failure count >= threshold, trips the circuit.
   */
  public static async recordFailure(merchantId: string, context?: Record<string, any>): Promise<boolean> {
    if (!merchantId) return false;
    try {
      const key = `api_failures:${merchantId}`;
      const failures = await redisConnection.incr(key);
      if (failures === 1) {
        await redisConnection.expire(key, this.WINDOW_SECONDS);
      }

      if (failures >= this.FAILURE_THRESHOLD) {
        await redisConnection.set(`circuit_breaker:${merchantId}`, '1', 'EX', this.TRIP_DURATION_SECONDS);
        logger.error('CRITICAL: Tenant circuit breaker tripped due to repeated failures', {
          merchantId,
          failures,
          tripDurationSeconds: this.TRIP_DURATION_SECONDS,
          ...context,
        });

        // Out-of-band ops notification
        await SecurityAlertService.sendCriticalAlert('CIRCUIT_BREAKER_TRIPPED', {
          merchantId,
          failures,
          tripDurationSeconds: this.TRIP_DURATION_SECONDS,
          ...context,
        }).catch(() => {});

        return true;
      }
      return false;
    } catch (err: any) {
      logger.error('Failed to record failure in circuit breaker', { merchantId, error: err.message });
      return false;
    }
  }
}
