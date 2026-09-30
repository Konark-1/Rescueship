import axios from 'axios';
import { logisticsService } from '../services/logistics.service';
import { redisConnection } from '../config/redis';
import { config } from '../config/env';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

jest.mock('../config/redis', () => ({
  redisConnection: {
    get: jest.fn(),
    set: jest.fn(),
  },
}));

describe('LogisticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getShiprocketToken', () => {
    it('returns cached Shiprocket token from Redis if present', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce('cached_sr_token_123');

      const token = await logisticsService.getShiprocketToken('test@store.com', 'secret123');
      expect(token).toBe('cached_sr_token_123');
      expect(mockedAxios.post).not.toHaveBeenCalled();
    });

    it('fetches fresh token from Shiprocket API and caches it in Redis', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce(null);
      mockedAxios.post.mockResolvedValueOnce({
        data: { token: 'new_fresh_token_456' },
      });

      const token = await logisticsService.getShiprocketToken('test@store.com', 'secret123');
      expect(token).toBe('new_fresh_token_456');
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://apiv2.shiprocket.in/v1/external/auth/login',
        {
          email: 'test@store.com',
          password: 'secret123',
        }
      );
      expect(redisConnection.set).toHaveBeenCalledWith(
        'shiprocket:token:test@store.com',
        'new_fresh_token_456',
        'EX',
        expect.any(Number)
      );
    });

    it('throws error when Shiprocket credentials are not provided or configured', async () => {
      const origEmail = config.shiprocket.email;
      const origPassword = config.shiprocket.password;
      (config.shiprocket as any).email = '';
      (config.shiprocket as any).password = '';

      try {
        await expect(
          logisticsService.getShiprocketToken('', '')
        ).rejects.toThrow('Shiprocket email and password are not configured');
      } finally {
        (config.shiprocket as any).email = origEmail;
        (config.shiprocket as any).password = origPassword;
      }
    });

    it('throws error on Shiprocket auth API failure', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce(null);
      mockedAxios.post.mockRejectedValueOnce(new Error('Invalid Shiprocket credentials'));

      await expect(
        logisticsService.getShiprocketToken('bad@store.com', 'badpwd')
      ).rejects.toThrow('Shiprocket login failed');
    });
  });

  describe('rescheduleDelivery', () => {
    it('reschedules with Shiprocket successfully', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce('sr_token');
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 200, message: 'NDR Action Submitted' },
      });

      const res = await logisticsService.rescheduleDelivery(
        'shiprocket',
        { awb: 'SR_AWB_101', newDate: '2026-10-02', reason: 'Customer requested' },
        { email: 'e@x.com', password: 'p' }
      );

      expect(res.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://apiv2.shiprocket.in/v1/external/ndr/action',
        expect.objectContaining({
          awb: 'SR_AWB_101',
          action: 'reattempt',
          deferred_date: '2026-10-02',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer sr_token' }),
        })
      );
    });

    it('reschedules with ClickPost successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { meta: { status: 'success', message: 'Action queued' } },
      });

      const res = await logisticsService.rescheduleDelivery(
        'clickpost',
        { awb: 'CP_AWB_202', newDate: '2026-10-02', reason: 'Customer available tomorrow' },
        { apiToken: 'cp_api_token_abc' }
      );

      expect(res.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.clickpost.in/v1/ndr-update/',
        expect.objectContaining({
          awb: 'CP_AWB_202',
          action: 'REATTEMPT',
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer cp_api_token_abc' }),
        })
      );
    });

    it('reschedules with Delhivery successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 'success', data: [{ status: true, message: 'Waybill deferred' }] },
      });

      const res = await logisticsService.rescheduleDelivery(
        'delhivery',
        { awb: 'DLV_AWB_303', newDate: '2026-10-02', reason: 'Customer request' },
        { apiToken: 'dlv_token_xyz' }
      );

      expect(res.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/p/update'),
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({ waybill: 'DLV_AWB_303', act: 'DEFER_DLV' }),
          ]),
        }),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Token dlv_token_xyz' }),
        })
      );
    });

    it('throws error for unsupported carrier', async () => {
      await expect(
        logisticsService.rescheduleDelivery(
          'fedex' as any,
          { awb: '123', reason: 'test' }
        )
      ).rejects.toThrow('Unsupported carrier: fedex');
    });

    it('returns failure when carrier API returns an error', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce('sr_token');
      mockedAxios.post.mockRejectedValueOnce({
        response: { data: { message: 'AWB not eligible for NDR' } },
        message: 'Request failed with status code 400',
      });

      const res = await logisticsService.rescheduleDelivery(
        'shiprocket',
        { awb: 'SR_AWB_FAIL', reason: 'test' },
        { email: 'e@x.com', password: 'p' }
      );

      expect(res.success).toBe(false);
      expect(res.message).toBe('Request failed with status code 400');
    });
  });

  describe('updateDeliveryAddress', () => {
    const addressParams = {
      awb: 'AWB_ADDR_1',
      address: 'Plot 45, Sector 18',
      city: 'Gurugram',
      pincode: '122002',
      phone: '9876543210',
      customerName: 'Aman Deep',
    };

    it('updates address with Shiprocket successfully', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce('sr_token');
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 200, message: 'Address updated' },
      });

      const res = await logisticsService.updateDeliveryAddress('shiprocket', addressParams, {
        email: 'e@x.com',
        password: 'p',
      });

      expect(res.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://apiv2.shiprocket.in/v1/external/ndr/action',
        expect.objectContaining({
          action: 'address_update',
          address1: 'Plot 45, Sector 18',
          city: 'Gurugram',
          pin_code: '122002',
          phone: '9876543210',
        }),
        expect.any(Object)
      );
    });

    it('updates address with ClickPost successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { meta: { status: 'success', message: 'Address change accepted' } },
      });

      const res = await logisticsService.updateDeliveryAddress('clickpost', addressParams, {
        apiToken: 'cp_token',
      });

      expect(res.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.clickpost.in/v1/ndr-update/',
        expect.objectContaining({
          action: 'ADDRESS_UPDATE',
          meta: expect.objectContaining({
            new_address: 'Plot 45, Sector 18',
            new_pincode: '122002',
          }),
        }),
        expect.any(Object)
      );
    });

    it('updates address with Delhivery successfully', async () => {
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 'success', data: [{ status: true }] },
      });

      const res = await logisticsService.updateDeliveryAddress('delhivery', addressParams, {
        apiToken: 'dlv_token',
      });

      expect(res.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/p/update'),
        expect.objectContaining({
          data: expect.arrayContaining([
            expect.objectContaining({
              waybill: 'AWB_ADDR_1',
              act: 'EDIT_DETAILS',
              add: 'Plot 45, Sector 18',
              pin: '122002',
            }),
          ]),
        }),
        expect.any(Object)
      );
    });
  });

  describe('cancelDelivery', () => {
    it('cancels delivery and initiates RTO on Shiprocket', async () => {
      (redisConnection.get as jest.Mock).mockResolvedValueOnce('sr_token');
      mockedAxios.post.mockResolvedValueOnce({
        data: { status: 200, message: 'RTO initiated' },
      });

      const res = await logisticsService.cancelDelivery('shiprocket', {
        awb: 'AWB_CANCEL_1',
        reason: 'Customer declined delivery',
      }, { email: 'e@x.com', password: 'p' });

      expect(res.success).toBe(true);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://apiv2.shiprocket.in/v1/external/ndr/action',
        expect.objectContaining({
          awb: 'AWB_CANCEL_1',
          action: 'rto',
        }),
        expect.any(Object)
      );
    });
  });

  describe('adjustCodAmount', () => {
    it('returns successful COD amendment response', async () => {
      const res = await logisticsService.adjustCodAmount('shiprocket', {
        awb: 'AWB_COD_1',
        newCodAmount: 0,
        reason: 'Converted to prepaid',
      });

      expect(res.success).toBe(true);
      expect(res.carrierResponse.collectable).toBe(0);
    });
  });
});
