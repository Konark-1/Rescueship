import axios from 'axios';
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

export class GeminiService {
  private static instance: GeminiService;
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  private constructor() {
    this.apiUrl = process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta';
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

    if (!this.apiKey) {
      logger.warn('[GeminiService] GEMINI_API_KEY not set — Gemini features disabled');
    }
  }

  public static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(options: GeminiChatOptions): Promise<GeminiResponse> {
    if (!this.apiKey) {
      throw new Error('Gemini API key not configured');
    }

    const model = options.model || this.model;
    const url = `${this.apiUrl}/models/${model}:generateContent?key=${this.apiKey}`;

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
