import { Types } from 'mongoose';
import { TrialUsage } from '../src/models/TrialUsage';
import { Merchant } from '../src/models/Merchant';
import {
  reserveTestSend,
  getTestStatus,
  trialKeys,
  tryVerifyOwnerPhone,
  buildVerification,
  samePhone,
} from '../src/services/free-test.service';

/** In-memory stand-in for the TrialUsage collection with the same conditional-upsert semantics. */
function fakeTrialStore() {
  const rows = new Map<string, number>();
  jest.spyOn(TrialUsage, 'findOneAndUpdate').mockImplementation(((filter: any, update: any) => {
    const key = filter.key;
    const limit = filter.count?.$lt ?? Infinity;
    const current = rows.get(key);
    if (current !== undefined && current >= limit) {
      const err: any = new Error('E11000 duplicate key');
      err.code = 11000;
      return Promise.reject(err);
    }
    rows.set(key, (current || 0) + (update.$inc?.count || 0));
    return Promise.resolve({ key, count: rows.get(key) });
  }) as any);
  jest.spyOn(TrialUsage, 'find').mockImplementation(((filter: any) => {
    const keys: string[] = filter.key.$in;
    const docs = keys.filter((k) => rows.has(k)).map((k) => ({ key: k, count: rows.get(k) }));
    return { select: () => ({ lean: () => Promise.resolve(docs) }) };
  }) as any);
  jest.spyOn(TrialUsage, 'updateMany').mockImplementation(((filter: any, update: any) => {
    for (const k of filter.key.$in) {
      const c = rows.get(k);
      if (c && c > 0) rows.set(k, c + update.$inc.count);
    }
    return Promise.resolve({});
  }) as any);
  return rows;
}

const unpaidMerchant = (over: any = {}) => ({
  _id: new Types.ObjectId(),
  billing: { plan: 'free_trial' },
  ownerPhone: '+919876543210',
  ownerPhoneVerifiedAt: new Date(),
  whatsappConfig: { phoneNumberId: 'PN1', wabaId: 'WABA1' },
  shopify: { shopDomain: 'Kurta-Co.myshopify.com' },
  ...over,
});

describe('free test rescues', () => {
  const env = { ...process.env };
  afterEach(() => {
    jest.restoreAllMocks();
    process.env = { ...env };
  });

  it('ties the allowance to number, WABA, owner phone and store, not just the account', () => {
    const keys = trialKeys(unpaidMerchant());
    expect(keys).toEqual(expect.arrayContaining(['pnid:PN1', 'waba:WABA1', 'owner:9876543210', 'shop:kurta-co.myshopify.com']));
  });

  it('refuses an unverified owner phone', async () => {
    fakeTrialStore();
    const r = await reserveTestSend(unpaidMerchant({ ownerPhoneVerifiedAt: undefined }));
    expect(r.allowed).toBe(false);
    expect(r.code).toBe('phone_unverified');
  });

  it('allows 3 free sends, then stops', async () => {
    fakeTrialStore();
    const m = unpaidMerchant();
    for (let i = 0; i < 3; i++) expect((await reserveTestSend(m)).allowed).toBe(true);
    const fourth = await reserveTestSend(m);
    expect(fourth.allowed).toBe(false);
    expect(fourth.code).toBe('lifetime_limit');
    expect((await getTestStatus(m)).remaining).toBe(0);
  });

  it('a new account on the same WhatsApp number cannot reset the allowance', async () => {
    fakeTrialStore();
    const first = unpaidMerchant();
    for (let i = 0; i < 3; i++) await reserveTestSend(first);
    const second = unpaidMerchant({ _id: new Types.ObjectId(), shopify: { shopDomain: 'other.myshopify.com' }, ownerPhone: '+919000000001' });
    const r = await reserveTestSend(second);
    expect(r.allowed).toBe(false);
    expect(r.code).toBe('lifetime_limit');
  });

  it('gives the allowance back when the send failed', async () => {
    fakeTrialStore();
    const m = unpaidMerchant();
    const r = await reserveTestSend(m);
    await r.release();
    expect((await getTestStatus(m)).used).toBe(0);
  });

  it('honours the platform-wide daily cap and the kill switch', async () => {
    fakeTrialStore();
    process.env.FREE_TEST_GLOBAL_DAILY_CAP = '1';
    expect((await reserveTestSend(unpaidMerchant())).allowed).toBe(true);
    const r = await reserveTestSend(unpaidMerchant({ _id: new Types.ObjectId(), whatsappConfig: { phoneNumberId: 'PN2' }, ownerPhone: '+919000000002', shopify: {} }));
    expect(r.code).toBe('platform_limit');

    process.env.FREE_TEST_ENABLED = 'false';
    expect((await reserveTestSend(unpaidMerchant())).code).toBe('disabled');
  });

  it('fails closed when the counter store is unavailable', async () => {
    jest.spyOn(TrialUsage, 'find').mockImplementation((() => ({ select: () => ({ lean: () => Promise.resolve([]) }) })) as any);
    jest.spyOn(TrialUsage, 'findOneAndUpdate').mockImplementation((() => Promise.reject(new Error('mongo down'))) as any);
    await expect(reserveTestSend(unpaidMerchant())).rejects.toThrow('mongo down');
  });
});

describe('owner phone verification', () => {
  afterEach(() => jest.restoreAllMocks());

  it('matches phones on the last 10 digits', () => {
    expect(samePhone('919876543210', '+91 98765 43210')).toBe(true);
    expect(samePhone('919876543210', '919876543211')).toBe(false);
  });

  it('verifies only when the right code comes from the pending phone', async () => {
    const update = jest.spyOn(Merchant, 'updateOne').mockResolvedValue({} as any);
    const { code, record } = buildVerification('+919876543210');
    const m = { _id: new Types.ObjectId(), ownerPhoneVerification: record };

    expect(await tryVerifyOwnerPhone(m, '919111111111', `RescueShip verify ${code}`)).toBe(false); // someone else
    expect(update).not.toHaveBeenCalled();

    const wrong = code === '123456' ? '654321' : '123456';
    expect(await tryVerifyOwnerPhone(m, '919876543210', `verify ${wrong}`)).toBe(true);
    expect(update).toHaveBeenLastCalledWith({ _id: m._id }, { $inc: { 'ownerPhoneVerification.attempts': 1 } });

    expect(await tryVerifyOwnerPhone(m, '919876543210', `RescueShip verify ${code}`)).toBe(true);
    const last = update.mock.calls[update.mock.calls.length - 1] as any[];
    expect(last[1].$set.ownerPhone).toBe('+919876543210');
    expect(last[1].$set.ownerPhoneVerifiedAt).toBeInstanceOf(Date);
  });

  it('ignores an expired code', async () => {
    const update = jest.spyOn(Merchant, 'updateOne').mockResolvedValue({} as any);
    const { code, record } = buildVerification('+919876543210');
    const m = { _id: new Types.ObjectId(), ownerPhoneVerification: { ...record, expiresAt: new Date(Date.now() - 1000) } };
    expect(await tryVerifyOwnerPhone(m, '919876543210', code)).toBe(true);
    expect((update.mock.calls[0] as any[])[1]).toEqual({ $unset: { ownerPhoneVerification: 1 } });
  });
});
