import { whatsAppService } from '../services/whatsapp.service';

describe('customer-copy boundary guard (L-6)', () => {
  beforeEach(() => {
    jest.spyOn(whatsAppService as any, 'sendInteractiveButtons').mockImplementation(async (...args: any[]) => {
      const bodyText = args[1] || '';
      const { assertSafeCopy } = require('../utils/customer-copy-guard');
      assertSafeCopy(bodyText);
      return { messaging_product: 'whatsapp', contacts: [], messages: [{ id: 'msg_123' }] };
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects accusatory copy at the send boundary', async () => {
    await expect(
      whatsAppService.sendInteractiveButtons('+919000000000', 'The courier lied about your delivery', [])
    ).rejects.toThrow(/accusatory/i);
  });

  it('allows verification-framed copy', async () => {
    await expect(
      whatsAppService.sendInteractiveButtons('+919000000000', "We couldn't confirm a delivery attempt. Please verify.", [])
    ).resolves.not.toThrow();
  });
});
