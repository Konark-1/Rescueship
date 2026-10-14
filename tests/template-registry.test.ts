import { resolveTemplate, DEFAULT_TEMPLATE_MAP, TEMPLATE_DEFS, bodyParamCount } from '../src/services/whatsapp/template-registry';
import { templateMapperService, NDRCategory } from '../src/services/whatsapp/template-mapper.service';

const body = (...vals: string[]) => ({ type: 'body', parameters: vals.map((text) => ({ type: 'text', text })) });

describe('WhatsApp template registry', () => {
  const registered = new Set(TEMPLATE_DEFS.map((d) => d.name));

  it('every default mapping points at a template we actually submit', () => {
    for (const [logical, name] of Object.entries(DEFAULT_TEMPLATE_MAP)) {
      expect({ logical, ok: registered.has(name) }).toEqual({ logical, ok: true });
    }
  });

  it('every NDR dispatcher category resolves to a submitted template with matching parameter count (en + hi)', () => {
    const cats: NDRCategory[] = ['CUSTOMER_NOT_AVAILABLE', 'CUSTOMER_REFUSED', 'ADDRESS_ISSUE', 'PREMISES_LOCKED', 'RESCHEDULE_REQUEST', 'COD_COLLECTION_ISSUE', 'CANCELLATION_RISK', 'RTO_ARREST', 'UNKNOWN_FAILURE'];
    for (const lang of ['en', 'hi']) {
      for (const c of cats) {
        const m = templateMapperService.getMappingForCategory(c, lang);
        const comps = templateMapperService.buildTemplateComponents(m, { customerName: 'Asha', externalOrderId: '1001', codAmount: '499' });
        const r = resolveTemplate(m.templateName, m.language, comps);
        expect({ c, lang, error: r.error, registered: registered.has(r.name) }).toEqual({ c, lang, error: undefined, registered: true });
        expect(r.language).toBe('en');
      }
    }
  });

  it('trims extra body params and keeps a required URL button', () => {
    const pre = resolveTemplate('ndr_predelivery_en', 'hi', [body('Asha', '1001', 'Store', 'DELHIVERY')]);
    expect(pre.name).toBe('predelivery_confirm_v2_en');
    expect(pre.components[0].parameters).toHaveLength(2);

    const btn = { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: 'plink_1' }] };
    const cod = resolveTemplate('cod_confirm_en', 'en', [body('Asha', '1001'), btn]);
    expect(cod.error).toBeUndefined();
    expect(cod.components).toHaveLength(2);

    const noBtn = resolveTemplate('cod_confirm_en', 'en', [body('Asha', '1001')]);
    expect(noBtn.error).toMatch(/URL button/);
  });

  it('merchant overrides win and unknown names pass through unchanged', () => {
    expect(resolveTemplate('ndr_rescue_en', 'en', [body('a', 'b')], { ndr_rescue_en: 'custom_rescue' }).name).toBe('custom_rescue');
    expect(resolveTemplate('hello_world', 'en_US', []).name).toBe('hello_world');
  });

  it('bodyParamCount reads the highest placeholder', () => {
    expect(bodyParamCount({ name: 'x', category: 'UTILITY', language: 'en', body: 'Hi {{1}} {{3}} {{2}}' })).toBe(3);
  });
});
