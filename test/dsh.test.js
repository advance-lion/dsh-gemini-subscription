import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Context } from '@deepseek-ai/cordis';
import { LlmRuntime, BlockAssembler, createUserMessage } from '@deepseek-ai/dsh-llm';
import * as plugin from '../src/index.js';
test('plugin registers and disposes on the actual DSH 0.2.2 LLM runtime', async () => {
  const ctx = new Context();
  const runtime = new LlmRuntime(ctx);
  let dispose;
  plugin.apply({ llm: runtime, effect(fn) { dispose = fn(); } });
  const providers = await runtime.listProviders();
  assert.equal(providers.find(p => p.id === 'gemini-subscription').name, 'Gemini · Google AI 订阅');
  dispose();
  assert.equal((await runtime.listProviders()).length, 0);
});
test('actual DSH runtime assembles bridge text', async () => {
  const ctx = new Context();
  const runtime = new LlmRuntime(ctx);
  const client = { async request() { return new Response('data: {"choices":[{"delta":{"content":"OK"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'); } };
  runtime.registerAdapter(['gemini-subscription'], new plugin.GeminiAdapter(client));
  const assembler = new BlockAssembler();
  for await (const chunk of runtime.stream({ provider: 'gemini-subscription', model: 'gemini-2.5-flash', messages: [createUserMessage({ content: [{ type: 'text', text: 'test' }], source: { kind: 'user' } })] })) assembler.push(chunk);
  assert.equal(assembler.blocks()[0].text, 'OK');
  assert.equal(assembler.finish.kind, 'stop');
});
