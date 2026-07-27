import { ACCUSATORY } from '../utils/customer-copy-guard';
import { COPY_STRINGS } from '../i18n/customer-copy';

describe('R4 - Customer Copy Boundary Guard', () => {
  it('all customer copy strings in COPY_STRINGS pass the non-accusatory boundary guard', () => {
    for (const str of COPY_STRINGS) {
      expect(ACCUSATORY.test(str)).toBe(false);
    }
  });
});
