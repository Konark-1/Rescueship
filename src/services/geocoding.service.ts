import axios from 'axios';
import { logger } from '../utils/logger';

export class GeocodingService {
  private static instance: GeocodingService;

  private constructor() {}

  public static getInstance(): GeocodingService {
    if (!GeocodingService.instance) {
      GeocodingService.instance = new GeocodingService();
    }
    return GeocodingService.instance;
  }

  public async reverseGeocode(latitude: number, longitude: number): Promise<string> {
    try {
      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          lat: latitude,
          lon: longitude,
          format: 'json',
        },
        headers: {
          'User-Agent': 'RescueShip-Geocoder/1.0',
        },
        timeout: 5000,
      });

      if (response.data && response.data.display_name) {
        return response.data.display_name;
      }
      return `${latitude}, ${longitude}`;
    } catch (err: any) {
      logger.error('Failed reverse geocoding', { latitude, longitude, error: err.message });
      return `${latitude}, ${longitude}`;
    }
  }
}

export const geocodingService = GeocodingService.getInstance();
