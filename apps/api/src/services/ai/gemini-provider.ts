import { AiCompleteParams, AiCompleteResult, AiProvider } from './types';

export class GeminiProvider implements AiProvider {
  name = 'gemini' as const;
  private apiKey: string;
  private defaultModel: string;

  constructor(apiKey: string, defaultModel: string) {
    this.apiKey = apiKey;
    this.defaultModel = defaultModel;
  }

  async complete(params: AiCompleteParams): Promise<AiCompleteResult> {
    const model = this.defaultModel.includes('gemini') ? this.defaultModel : 'gemini-1.5-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${params.system}\n\n${params.user}` }] }],
        generationConfig: {
          maxOutputTokens: params.maxTokens ?? 1024,
          temperature: params.temperature ?? 0.3,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Gemini API error: ${res.status} ${err}`);
    }

    const data = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
    return { text, model, provider: 'gemini' };
  }
}
