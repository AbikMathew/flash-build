import { AIProvider } from '@/types';

type MessagePart = Record<string, unknown>;

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
}

export interface AIResult {
  text: string;
  usage: AIUsage;
}

interface CallAIOptions {
  provider: AIProvider;
  apiKey: string;
  model: string;
  systemPrompt: string;
  userContent: MessagePart[] | string;
  maxTokens: number;
  jsonSchema?: Record<string, unknown>;
}

const PRICE_PER_MILLION: Record<AIProvider, { input: number; output: number }> = {
  openai: { input: 5, output: 15 },
  anthropic: { input: 3, output: 15 },
};

export const DEFAULT_MODELS: Record<AIProvider, string> = {
  anthropic: 'claude-sonnet-4-20250514',
  openai: 'gpt-4o',
};

export function getProviderLabel(provider: AIProvider): string {
  return provider === 'anthropic' ? 'Claude' : 'GPT-4o';
}

function estimateTokens(text: string): number {
  if (!text.trim()) return 0;
  return Math.ceil(text.length / 4);
}

function estimateCost(provider: AIProvider, inputTokens: number, outputTokens: number): number {
  const pricing = PRICE_PER_MILLION[provider];
  const inputCost = (inputTokens / 1_000_000) * pricing.input;
  const outputCost = (outputTokens / 1_000_000) * pricing.output;
  return Number((inputCost + outputCost).toFixed(4));
}

function normalizeUserMessage(userContent: MessagePart[] | string): MessagePart[] {
  if (typeof userContent === 'string') {
    return [{ type: 'text', text: userContent }];
  }
  return userContent;
}

export async function callAI(options: CallAIOptions): Promise<AIResult> {
  const userMessage = normalizeUserMessage(options.userContent);

  if (options.provider === 'anthropic') {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': options.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: options.model,
        max_tokens: options.maxTokens,
        system: options.systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as {
      content?: Array<{ type?: string; text?: string }>;
      usage?: { input_tokens?: number; output_tokens?: number };
    };

    const text = data.content?.find((entry) => entry.type === 'text')?.text ?? '';
    const inputTokens = data.usage?.input_tokens ?? estimateTokens(options.systemPrompt + JSON.stringify(userMessage));
    const outputTokens = data.usage?.output_tokens ?? estimateTokens(text);

    return {
      text,
      usage: {
        inputTokens,
        outputTokens,
        estimatedCostUsd: estimateCost(options.provider, inputTokens, outputTokens),
      },
    };
  }

  const openAIBody: Record<string, unknown> = {
    model: options.model,
    max_tokens: options.maxTokens,
    messages: [
      { role: 'system', content: options.systemPrompt },
      { role: 'user', content: userMessage },
    ],
  };

  if (options.jsonSchema) {
    openAIBody.response_format = {
      type: 'json_schema',
      json_schema: {
        name: 'structured_output',
        strict: true,
        schema: options.jsonSchema,
      },
    };
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.apiKey}`,
    },
    body: JSON.stringify(openAIBody),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API error (${response.status}): ${await response.text()}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number };
  };
  const text = data.choices?.[0]?.message?.content ?? '';
  const inputTokens = data.usage?.prompt_tokens ?? estimateTokens(options.systemPrompt + JSON.stringify(userMessage));
  const outputTokens = data.usage?.completion_tokens ?? estimateTokens(text);

  return {
    text,
    usage: {
      inputTokens,
      outputTokens,
      estimatedCostUsd: estimateCost(options.provider, inputTokens, outputTokens),
    },
  };
}

export function safeJsonParse<T>(raw: string): T | null {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const stripped = raw.replace(/```(?:json)?\n?/gi, '').replace(/```\s*$/g, '').trim();
    try {
      return JSON.parse(stripped) as T;
    } catch {
      const match = stripped.match(/\{[\s\S]*\}/);
      if (!match) return null;
      try {
        return JSON.parse(match[0]) as T;
      } catch {
        return null;
      }
    }
  }
}

