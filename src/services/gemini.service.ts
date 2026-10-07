import axios from 'axios';
import crypto from 'crypto';
import { redisConnection } from '../config/redis';
import { logger } from '../utils/logger';

export interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export interface GeminiResponse {
  text: string;
  usage: {
    prompt_token_count: number;
    candidates_token_count: number;
    total_token_count: number;
  };
}

export interface GeminiChatOptions {
  parts: GeminiPart[];
  model?: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StructuredIndianAddress {
  flatOrHouseNo?: string;
  societyOrBuilding?: string;
  streetOrGali?: string;
  landmark: string;
  driverNote: string;
  cleanAddress: string; // Normalized single-line address (max 120 chars)
  city?: string;
  pincode?: string;     // 6-digit Indian PIN
  confidence: number;   // 0.0 - 1.0
}

const ADDRESS_SCHEMA = {
  type: 'OBJECT',
  properties: {
    flatOrHouseNo: { type: 'STRING' },
    societyOrBuilding: { type: 'STRING' },
    streetOrGali: { type: 'STRING' },
    landmark: { type: 'STRING', description: 'Extracted landmark, translated to English if needed' },
    driverNote: { type: 'STRING', description: 'Specific courier delivery instruction' },
    cleanAddress: { type: 'STRING', description: 'Normalized single-line address (max 120 chars)' },
    city: { type: 'STRING' },
    pincode: { type: 'STRING', description: '6-digit Indian PIN' },
    confidence: { type: 'NUMBER' },
  },
  required: ['landmark', 'driverNote', 'cleanAddress', 'confidence'],
};

const HINGLISH_PROMPT = `You are an expert Indian logistics address parser. Convert messy WhatsApp text (Hinglish, Hindi Devanagari, English, or mixed) into structured JSON.

Hinglish/Colloquial Dictionary:
- "ke peeche" / "ke piche" → Behind
- "ke samne" / "opposite" → Opposite / In front of
- "ke bagal mein" / "bagal" → Adjacent to / Beside
- "chowk" / "naka" / "tiraha" → Intersection / Circle
- "call karna" / "phone uthana" → Call customer on arrival
- "guard ke paas" / "security" → Leave with security guard
- "gali" / "lane" → Street / Lane
- "makan" / "kotha" → House
- "manzil" / "floor" → Floor

Rules:
- pincode: exactly 6 digits if present, otherwise omit.
- cleanAddress: max 120 characters, formatted for a shipping label.
- confidence: 0.0-1.0 based on completeness.
Return ONLY JSON matching the schema. No prose.`;

const CACHE_TTL_SECONDS = 48 * 3600; // 48 hours

export class GeminiService {
  private static instance: GeminiService;
  private apiUrl: string;
  private apiKey: string | undefined;
  private model: string;

  public constructor() {
    this.apiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-3.8-flash';

    if (!this.getApiKey()) {
      logger.warn('[GeminiService] GEMINI_API_KEY not set — Gemini features disabled');
    }
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  private getApiKey(): string | undefined {
    return process.env.GEMINI_API_KEY !== undefined ? process.env.GEMINI_API_KEY : this.apiKey;
  }

  private getModel(): string {
    return process.env.GEMINI_MODEL || this.model || 'gemini-3.8-flash';
  }

  public isConfigured(): boolean {
    return !!this.getApiKey();
  }

  private getCacheKey(text: string): string {
    const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
    const hash = crypto.createHash('sha256').update(normalized).digest('hex');
    return `gemini_addr:${hash}`;
  }

  async parseAddress(rawText: string): Promise<StructuredIndianAddress | null> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      logger.warn('Gemini API key not configured. Skipping AI parse.');
      return null;
    }

    const text = rawText.trim();
    if (!text) return null;

    // Tier 1: Redis Cache Check
    const cacheKey = this.getCacheKey(text);
    try {
      if (redisConnection && typeof redisConnection.get === 'function') {
        const cached = await redisConnection.get(cacheKey);
        if (cached) {
          logger.debug('Gemini address parse cache hit', { cacheKey });
          return JSON.parse(cached) as StructuredIndianAddress;
        }
      }
    } catch (err) {
      logger.warn('Redis cache read failed for Gemini parse', { error: (err as Error).message });
    }

    // Tier 2: Gemini API Call
    try {
      const model = this.getModel();
      const url = `${this.apiUrl}/models/${model}:generateContent`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'x-goog-api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${HINGLISH_PROMPT}\n\nADDRESS: ${text}` }] }],
          generationConfig: {
            temperature: 0,
            responseMimeType: 'application/json',
            responseSchema: ADDRESS_SCHEMA,
          },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        logger.error(`Gemini API error: ${response.status}`, { body: errText });
        return null;
      }

      const data = await response.json() as any;
      const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawJson) {
        logger.warn('Gemini returned empty response for address parse');
        return null;
      }

      const parsed = JSON.parse(rawJson) as StructuredIndianAddress;

      // Validate required fields
      if (!parsed.cleanAddress || typeof parsed.confidence !== 'number') {
        logger.warn('Gemini response missing required fields', { parsed });
        return null;
      }

      // Save to Redis Cache safely
      if (redisConnection && typeof redisConnection.set === 'function') {
        try {
          const setPromise = redisConnection.set(cacheKey, JSON.stringify(parsed), 'EX', CACHE_TTL_SECONDS);
          if (setPromise && typeof (setPromise as any).catch === 'function') {
            (setPromise as Promise<any>).catch((err: Error) => {
              logger.warn('Failed to cache Gemini parse result', { error: err.message });
            });
          }
        } catch (setErr: any) {
          logger.warn('Failed to invoke Redis set for Gemini cache', { error: setErr?.message });
        }
      }

      return parsed;
    } catch (err) {
      logger.error('Gemini address parse failed', { error: (err as Error).message });
      return null;
    }
  }

  /**
   * Extract landmark and structured address details from raw text instructions
   * using Gemini NLP or structured fallback.
   */
  async extractLandmarksFromText(textInstructions: string): Promise<string> {
    const raw = String(textInstructions || '').trim();
    if (!raw) {
      return 'Customer landmark provided via WhatsApp';
    }

    try {
      const parsed = await this.parseAddress(raw);
      if (parsed?.cleanAddress) {
        if (parsed.landmark && !parsed.cleanAddress.toLowerCase().includes(parsed.landmark.toLowerCase())) {
          return `${parsed.cleanAddress} [Landmark: ${parsed.landmark}]`;
        }
        return parsed.cleanAddress;
      }
    } catch (err: any) {
      logger.warn('Failed in Gemini landmark extraction, returning raw instruction', { error: err?.message });
    }

    return raw;
  }

  async chat(options: GeminiChatOptions): Promise<GeminiResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = options.model || this.getModel();
    const url = `${this.apiUrl}/models/${model}:generateContent?key=${apiKey}`;

    const requestBody: Record<string, unknown> = {
      contents: [{ role: 'user', parts: options.parts }],
    };

    if (options.systemInstruction) {
      requestBody.systemInstruction = {
        parts: [{ text: options.systemInstruction }],
      };
    }

    if (options.temperature !== undefined || options.maxOutputTokens !== undefined) {
      const generationConfig: Record<string, unknown> = {};
      if (options.temperature !== undefined) generationConfig.temperature = options.temperature;
      if (options.maxOutputTokens !== undefined) generationConfig.maxOutputTokens = options.maxOutputTokens;
      requestBody.generationConfig = generationConfig;
    }

    const { data } = await axios.post(url, requestBody, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120_000,
    });

    const candidate = data?.candidates?.[0];
    const textParts = candidate?.content?.parts
      ?.filter((p: { text?: string }) => !!p.text)
      .map((p: { text: string }) => p.text) || [];

    return {
      text: textParts.join(''),
      usage: data?.usageMetadata || {
        prompt_token_count: 0,
        candidates_token_count: 0,
        total_token_count: 0,
      },
    };
  }

  async ask(question: string, imageBase64?: string, mimeType = 'image/png'): Promise<string> {
    const parts: GeminiPart[] = [{ text: question }];

    if (imageBase64) {
      parts.push({ inlineData: { mimeType, data: imageBase64 } });
    }

    const res = await this.chat({ parts });
    return res.text;
  }

  async askWithImage(question: string, imageBase64: string, mimeType = 'image/png'): Promise<string> {
    return this.ask(question, imageBase64, mimeType);
  }
}

export const geminiService = GeminiService.getInstance();
