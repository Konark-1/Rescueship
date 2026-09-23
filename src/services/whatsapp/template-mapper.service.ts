/**
 * template-mapper.service.ts
 * Category-deterministic Meta WhatsApp template mapping, variable extraction, and validation engine.
 */

import { normalizeIndianPhone } from '../../utils/phoneNormalizer';
import { logger } from '../../utils/logger';

export type NDRCategory =
  | 'CUSTOMER_NOT_AVAILABLE'
  | 'CUSTOMER_REFUSED'
  | 'ADDRESS_ISSUE'
  | 'PREMISES_LOCKED'
  | 'RESCHEDULE_REQUEST'
  | 'COD_COLLECTION_ISSUE'
  | 'CANCELLATION_RISK'
  | 'UNKNOWN_FAILURE';

export interface TemplateMapping {
  category: NDRCategory;
  templateName: string;
  language: string;
  requiredVariables: string[];
  fallbackTemplateName: string;
  fallbackLanguage: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class TemplateMapperService {
  private static instance: TemplateMapperService;

  private readonly defaultCategoryMap: Record<NDRCategory, { template: string; requiredVars: string[] }> = {
    CUSTOMER_NOT_AVAILABLE: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
    CUSTOMER_REFUSED: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
    ADDRESS_ISSUE: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
    PREMISES_LOCKED: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
    RESCHEDULE_REQUEST: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
    COD_COLLECTION_ISSUE: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
    CANCELLATION_RISK: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
    UNKNOWN_FAILURE: { template: 'ndr_rescue_en', requiredVars: ['customerName', 'externalOrderId'] },
  };

  private constructor() {}

  public static getInstance(): TemplateMapperService {
    if (!TemplateMapperService.instance) {
      TemplateMapperService.instance = new TemplateMapperService();
    }
    return TemplateMapperService.instance;
  }

  /**
   * Resolve template mapping for a specific category, checking merchant overrides.
   */
  public getMappingForCategory(
    category: NDRCategory,
    preferredLanguage: string = 'en',
    merchantTemplateMap?: Record<string, string>
  ): TemplateMapping {
    const base = this.defaultCategoryMap[category] || this.defaultCategoryMap.UNKNOWN_FAILURE;
    const lang = preferredLanguage === 'hi' ? 'hi' : 'en';

    // Suffix language if standard template naming convention
    let templateName = base.template;
    if (lang === 'hi') {
      templateName = templateName.replace('_en', '_hi');
    }

    // Check merchant custom overrides (e.g. { "CUSTOMER_NOT_AVAILABLE": "my_custom_ndr" } or { "ndr_rescue_en": "custom_rescue" })
    if (merchantTemplateMap) {
      if (merchantTemplateMap[category]) {
        templateName = merchantTemplateMap[category];
      } else if (merchantTemplateMap[base.template]) {
        templateName = merchantTemplateMap[base.template];
      }
    }

    return {
      category,
      templateName,
      language: lang,
      requiredVariables: base.requiredVars,
      fallbackTemplateName: 'ndr_rescue_en',
      fallbackLanguage: 'en',
    };
  }

  /**
   * Pre-send validation. If validation fails, message MUST NOT be sent.
   */
  public validateTemplatePayload(
    mapping: TemplateMapping,
    variables: Record<string, string>,
    phone: string
  ): ValidationResult {
    const errors: string[] = [];

    // 1. Phone validation
    const normalized = normalizeIndianPhone(phone);
    if (!normalized || normalized.length < 10) {
      errors.push(`Invalid phone number: ${phone}`);
    }

    // 2. Required variables validation
    for (const varName of mapping.requiredVariables) {
      const val = variables[varName];
      if (val === undefined || val === null || String(val).trim() === '') {
        errors.push(`Missing required template variable: ${varName}`);
      } else if (String(val).length > 200) {
        errors.push(`Variable ${varName} exceeds length limit: ${String(val).length} chars`);
      }
    }

    // 3. Template name validation
    if (!mapping.templateName || mapping.templateName.trim() === '') {
      errors.push('Template name is empty');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Build Meta Cloud API components array for template sending.
   */
  public buildTemplateComponents(
    mapping: TemplateMapping,
    variables: Record<string, string>
  ): any[] {
    const parameters = mapping.requiredVariables.map((v) => ({
      type: 'text',
      text: String(variables[v] || ''),
    }));

    return [
      {
        type: 'body',
        parameters,
      },
    ];
  }
}

export const templateMapperService = TemplateMapperService.getInstance();
