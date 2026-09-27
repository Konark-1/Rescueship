import axios from 'axios';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

interface CacheEntry {
  address: string;
  expiresAt: number;
}

export class GeocodingService {
  private static instance: GeocodingService;

  // Tier-2 In-memory cache fallback (key -> address)
  private memoryCache = new Map<string, CacheEntry>();
  private readonly MEMORY_CACHE_MAX_ENTRIES = 2000;
  private readonly CACHE_TTL_SECONDS = 30 * 24 * 60 * 60; // 30 days in seconds
  private readonly MEMORY_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in ms

  // Rate-limiting / queue state for OpenStreetMap Nominatim policy (max 1 req/sec)
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL_MS = 1050; // 1.05s to safely respect 1 req/sec
  private requestQueue: Promise<void> = Promise.resolve();

  private constructor() {}

  public static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  /**
   * Generates a normalized coordinate cache key at 4 decimal places (~11m accuracy).
   */
  private getCacheKey(latitude: number, longitude: number): string {
    return `geo:rev:${latitude.toFixed(4)}:${longitude.toFixed(4)}`;
  }

  /**
   * Reverse geocode latitude/longitude coordinates to a readable address.
   * Utilizes two-tier caching (Redis + In-Memory) and a sequential rate-limiter
   * to strictly honor OpenStreetMap Nominatim usage guidelines (max 1 req/sec)
   * and avoid IP bans during high-volume NDR rescue bursts.
   */
  public async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return `${latitude}, ${longitude}`;
    }

    const fallback = `${latitude}, ${longitude}`;
    const cacheKey = this.getCacheKey(latitude, longitude);

    // ─── 1. CHECK TIER-1 CACHE (Redis) ───────────────────────────────────
    try {
      if (redisConnection && redisConnection.status === 'ready') {
        const cached = await redisConnection.get(cacheKey);
        if (cached) {
          logger.debug('Geocoding cache hit (Redis)', { latitude, longitude, cacheKey });
          return cached;
        }
      }
    } catch (err: any) {
      // Non-blocking: failover gracefully to in-memory cache
      logger.debug('Redis geocoding cache lookup bypassed', { error: err.message });
    }

    // ─── 2. CHECK TIER-2 CACHE (In-Memory) ───────────────────────────────
    const memoryHit = this.memoryCache.get(cacheKey);
    if (memoryHit && memoryHit.expiresAt > Date.now()) {
      logger.debug('Geocoding cache hit (In-Memory)', { latitude, longitude, cacheKey });
      return memoryHit.address;
    }

    // ─── 3. RATE-LIMITED REMOTE NOMINATIM CALL ───────────────────────────
    return this.queueNominatimRequest(latitude, longitude, cacheKey, fallback);
  }

  /**
   * Chains outgoing Nominatim HTTP requests to guarantee at least 1000ms between calls.
   */
  private queueNominatimRequest(
    latitude: number,
    longitude: number,
    cacheKey: string,
    fallback: string
  ): Promise<string> {
    const execute = async (): Promise<string> => {
      // Re-check in-memory cache in case a queued duplicate resolved while waiting
      const existing = this.memoryCache.get(cacheKey);
      if (existing && existing.expiresAt > Date.now()) {
        return existing.address;
      }

      // Enforce rate-limit interval
      const now = Date.now();
      const timeSinceLast = now - this.lastRequestTime;
      if (timeSinceLast < this.MIN_REQUEST_INTERVAL_MS) {
        await new Promise((resolve) => setTimeout(resolve, this.MIN_REQUEST_INTERVAL_MS - timeSinceLast));
      }
      this.lastRequestTime = Date.now();

      try {
        const userAgent =
          process.env.NOMINATIM_USER_AGENT ||
          'RescueShip-Geocoder/1.0 (ops@rescueship.io; https://rescueship.io)';

        const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
          params: {
            lat: latitude,
            lon: longitude,
            format: 'json',
            zoom: 18,
            addressdetails: 1,
          },
          headers: {
            'User-Agent': userAgent,
            Accept: 'application/json',
          },
          timeout: 6000,
        });

        if (response.data && response.data.display_name) {
          const address = response.data.display_name;
          await this.saveToCaches(cacheKey, address);
          return address;
        }

        return fallback;
      } catch (err: any) {
        if (err.response?.status === 429) {
          logger.warn('Nominatim rate-limit reached (HTTP 429). Falling back to raw coordinates.', {
            latitude,
            longitude,
          });
        } else {
          logger.error('Failed reverse geocoding remote call', {
            latitude,
            longitude,
            error: err.message,
          });
        }
        return fallback;
      }
    };

    // Chain to queue promise to preserve strictly serialized outbound dispatch
    const resultPromise = this.requestQueue.then(execute, execute);
    this.requestQueue = resultPromise.then(() => {}, () => {});
    return resultPromise;
  }

  /**
   * Persists geocoded address to both Redis and In-Memory caches.
   */
  private async saveToCaches(cacheKey: string, address: string): Promise<void> {
    // Save to In-Memory Cache
    if (this.memoryCache.size >= this.MEMORY_CACHE_MAX_ENTRIES) {
      const oldestKey = this.memoryCache.keys().next().value;
      if (oldestKey) this.memoryCache.delete(oldestKey);
    }
    this.memoryCache.set(cacheKey, {
      address,
      expiresAt: Date.now() + this.MEMORY_TTL_MS,
    });

    // Save to Redis Cache (30-day TTL)
    try {
      if (redisConnection && redisConnection.status === 'ready') {
        await redisConnection.set(cacheKey, address, 'EX', this.CACHE_TTL_SECONDS);
      }
    } catch (err: any) {
      logger.debug('Failed to write geocoding to Redis cache', { error: err.message });
    }
  }

  /**
   * Clear in-memory cache (primarily for unit tests).
   */
  public clearMemoryCache(): void {
    this.memoryCache.clear();
  }
}

export const geocodingService = GeocodingService.getInstance();
