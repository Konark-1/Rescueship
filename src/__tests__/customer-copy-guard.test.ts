import { scanCustomerCopy } from '../utils/customer-copy-guard';
import { COPY_STRINGS } from '../i18n/customer-copy';

describe('customer-copy guard (L-6)', () => {
  it('no customer-facing string accuses the courier', () => {
    const violations = scanCustomerCopy(COPY_STRINGS);
    expect(violations).toEqual([]);
  });
});
