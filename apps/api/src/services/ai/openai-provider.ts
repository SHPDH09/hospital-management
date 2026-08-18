import { AiCompleteParams, AiCompleteResult, AiProvider } from './types';

export class OpenAiProvider implements AiProvider {
  name = 'openai' as const;
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    const model = this.defaultModel;
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        max_tokens: params.maxTokens ?? 1024,
        temperature: params.temperature ?? 0.3,
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`OpenAI API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      model?: string;
    };
    const text = data.choices?.[0]?.message?.content?.trim() || '';
    return { text, model: data.model || model, provider: 'openai' };
  }
}
