import axios from 'axios';
import { GeocodingService } from '../src/services/geocoding.service';
import { redisConnection } from '../src/config/redis';

jest.mock('axios');
jest.mock('../src/config/redis', () => ({
  redisConnection: {
    get: jest.fn(),
    set: jest.fn().mockResolvedValue('OK'),
    status: 'ready',
  },
}));

describe('GeocodingService Caching & Rate-Limiting', () => {
  let geocoder: GeocodingService;

  beforeEach(() => {
    jest.clearAllMocks();
    geocoder = GeocodingService.getInstance();
    geocoder.clearMemoryCache();
  });

  it('should return cached address from Redis if available without calling Nominatim', async () => {
    const lat = 19.076;
    const lon = 72.8777;
    (redisConnection.get as jest.Mock).mockResolvedValueOnce('Cached Marine Lines, Mumbai');

    const address = await geocoder.reverseGeocode(lat, lon);

    expect(address).toBe('Cached Marine Lines, Mumbai');
    expect(redisConnection.get).toHaveBeenCalledWith('geo:rev:19.0760:72.8777');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('should fetch from Nominatim and cache to Redis and memory when cache misses', async () => {
    const lat = 28.6139;
    const lon = 77.209;
    (redisConnection.get as jest.Mock).mockResolvedValueOnce(null);
    (axios.get as jest.Mock).mockResolvedValueOnce({
      data: { display_name: 'Connaught Place, New Delhi, 110001' },
    });

    const address = await geocoder.reverseGeocode(lat, lon);

    expect(address).toBe('Connaught Place, New Delhi, 110001');
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(redisConnection.set).toHaveBeenCalledWith(
      'geo:rev:28.6139:77.2090',
      'Connaught Place, New Delhi, 110001',
      'EX',
      expect.any(Number)
    );

    // Second call with same coordinates should hit in-memory cache
    const secondCall = await geocoder.reverseGeocode(lat, lon);
    expect(secondCall).toBe('Connaught Place, New Delhi, 110001');
    expect(axios.get).toHaveBeenCalledTimes(1); // Still 1, did not call remote API again
  });

  it('should gracefully fallback to lat, lon string on HTTP 429 rate-limit without throwing', async () => {
    const lat = 12.9716;
    const lon = 77.5946;
    (redisConnection.get as jest.Mock).mockResolvedValueOnce(null);
    (axios.get as jest.Mock).mockRejectedValueOnce({
      response: { status: 429 },
      message: 'Too Many Requests',
    });

    const address = await geocoder.reverseGeocode(lat, lon);

    expect(address).toBe('12.9716, 77.5946');
  });

  it('should handle invalid non-finite coordinates gracefully', async () => {
    const address = await geocoder.reverseGeocode(NaN, Infinity);
    expect(address).toBe('NaN, Infinity');
    expect(axios.get).not.toHaveBeenCalled();
  });
});
