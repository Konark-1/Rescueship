import { metricsService } from './metrics.service';
import { logger } from '../utils/logger';

class FeatureFlagsService {
  private cachedPLG: boolean | null = null;
  private lastCheck: number = 0;
  private readonly CACHE_TTL = 3600_000; // 1 hour

  /**
   * Is the public PLG signup flow enabled?
   * Returns true only after pilot proves aggregate rescue rate ≥ 30%.
   */
  async isPLGEnabled(): Promise<boolean> {
    if (process.env.FORCE_PLG === 'true') return true;
    if (process.env.FORCE_PLG === 'false') return false;

    if (this.cachedPLG !== null && Date.now() - this.lastCheck < this.CACHE_TTL) {
      return this.cachedPLG;
    }

    try {
      const gate = await metricsService.isPhase4Ready();
      this.cachedPLG = gate.ready;
      this.lastCheck = Date.now();

      if (gate.ready) {
        logger.info(`[FeatureFlags] PLG ENABLED — rescue rate ${(gate.rate * 100).toFixed(1)}% ≥ 30%`);
      }

      return gate.ready;
    } catch {
      return false;
    }
  }

  invalidate(): void {
    this.cachedPLG = null;
    this.lastCheck = 0;
  }
}

export const featureFlags = new FeatureFlagsService();
