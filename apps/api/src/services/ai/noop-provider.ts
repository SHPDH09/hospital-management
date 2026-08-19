import { AiCompleteParams, AiCompleteResult, AiProvider } from './types';

export class NoopAiProvider implements AiProvider {
  name = 'none' as const;

  async complete(_params: AiCompleteParams): Promise<AiCompleteResult> {
    return { text: '', model: 'none', provider: 'none' };
  }
}
