import { LlmAdapter } from '@deepseek-ai/dsh-llm';
import { Bridge } from './bridge.js';
import { PROVIDER, toOpenAI, openAIChunks } from './openai.js';
export const name = 'gemini-subscription';
export const inject = ['llm'];

export class GeminiAdapter extends LlmAdapter {
  constructor(client) { super(); this.client = client; }
  providerInfo(provider) { return { id: provider, name: 'Gemini · Google AI 订阅' }; }
  async listModels(provider) {
    const result = await (await this.client.request('/v1/models')).json();
    return result.data.map(m => ({ provider, id: m.id, name: m.id, inputModalities: ['text'], description: '使用官方 Antigravity CLI 的 Google AI 订阅额度' }));
  }
  async resolveModel(provider, id) {
    return { provider, id, name: id, inputModalities: ['text'], context: { contextWindow: id.startsWith('gemini-') ? 1048576 : id.startsWith('gpt-oss-') ? 131072 : 200000 } };
  }
  async *stream(options) {
    const response = await this.client.request('/v1/chat/completions', {
      method: 'POST', body: JSON.stringify(toOpenAI(options)), signal: options.signal,
      headers: options.sessionId ? { 'X-Session-Id': options.sessionId } : {},
    });
    yield* openAIChunks(response.body);
  }
}
export function apply(ctx, config = {}) {
  const client = new Bridge(config);
  const adapter = new GeminiAdapter(client);
  ctx.effect(() => {
    const dispose = ctx.llm.registerAdapter([PROVIDER], adapter);
    return () => { dispose(); client.stop(); };
  });
}
