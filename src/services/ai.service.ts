import axios from 'axios';
import { logger } from '../utils/logger';

export interface AiTextMessage {
  role: 'user' | 'assistant' | 'system';
  content: string | AiContentPart[];
}

export interface AiContentPart {
  type: 'input_text' | 'input_image';
  text?: string;
  image_url?: string;
}

export interface AiResponse {
  text: string;
  reasoning?: string;
  usage: {
    total_tokens: number;
    output_tokens: number;
    input_tokens: number;
  };
  credits_consumed: number;
}

export interface AiChatOptions {
  messages: AiTextMessage[];
  model?: string;
  reasoning?: 'low' | 'medium' | 'high';
  web_search?: boolean;
}

export class AiService {
  private static instance: AiService;
  private apiUrl: string;
  private apiKey: string;
  private model: string;

  private constructor() {
    this.apiUrl = process.env.KIE_AI_API_URL || 'https://api.kie.ai/codex/v1/responses';
    this.apiKey = process.env.KIE_AI_API_KEY || '';
    this.model = process.env.KIE_AI_MODEL || 'gpt-6-astra';

    if (!this.apiKey) {
      logger.warn('[AiService] KIE_AI_API_KEY not set — AI features disabled');
    }
  }

  public static getInstance(): AiService {
    if (!AiService.instance) {
      AiService.instance = new AiService();
    }
    return AiService.instance;
  }

  public isConfigured(): boolean {
    return !!this.apiKey;
  }

  async chat(options: AiChatOptions): Promise<AiResponse> {
    if (!this.apiKey) {
      throw new Error('KIE AI API key not configured');
    }

    const model = options.model || this.model;

    const tools: Array<{ type: string }> = [];
    if (options.web_search) {
      tools.push({ type: 'web_search' });
    }

    const payload: Record<string, unknown> = {
      model,
      input: options.messages.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
    };

    if (tools.length > 0) {
      payload.tools = tools;
    }

    if (options.reasoning) {
      payload.reasoning = { effort: options.reasoning };
    }

    const { data } = await axios.post(this.apiUrl, payload, {
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120_000,
    });

    const output = data?.output || [];
    let text = '';
    let reasoning: string | undefined;

    for (const item of output) {
      if (item.type === 'reasoning' && item.summary?.length) {
        reasoning = item.summary.map((s: { text: string }) => s.text).join('\n');
      }
      if (item.type === 'message' && item.content) {
        for (const block of item.content) {
          if (block.type === 'output_text') {
            text += block.text;
          }
        }
      }
    }

    return {
      text,
      reasoning,
      usage: data?.usage || { total_tokens: 0, output_tokens: 0, input_tokens: 0 },
      credits_consumed: data?.credits_consumed || 0,
    };
  }

  async ask(question: string, imageUrl?: string): Promise<string> {
    const content: AiContentPart[] = [{ type: 'input_text', text: question }];

    if (imageUrl) {
      content.push({ type: 'input_image', image_url: imageUrl });
    }

    const res = await this.chat({
      messages: [{ role: 'user', content }],
      web_search: false,
      reasoning: 'medium',
    });

    return res.text;
  }

  async askWithWebSearch(question: string): Promise<string> {
    const res = await this.chat({
      messages: [{ role: 'user', content: question }],
      web_search: true,
      reasoning: 'medium',
    });

    return res.text;
  }
}

export const aiService = AiService.getInstance();
