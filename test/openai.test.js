import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toOpenAI, openAIChunks } from '../src/openai.js';
import { parseSSE } from '../src/sse.js';
const collect = async iterable => { const items = []; for await (const item of iterable) items.push(item); return items; };
const body = items => new Response(items.map(i => `data: ${JSON.stringify(i)}\r\n\r\n`).join('') + 'data: [DONE]\r\n\r\n').body;
test('UTF8 SSE decoder handles characters split across byte boundaries', async () => {
  const bytes = new TextEncoder().encode('data: {"text":"你好"}\r\n\r\n');
  const stream = new ReadableStream({ start(c) { for (const n of bytes) c.enqueue(Uint8Array.of(n)); c.close(); } });
  assert.deepEqual(await collect(parseSSE(stream)), [{ text: '你好' }]);
});
test('parallel fragmented tool calls stay distinct and replay with matching results', async () => {
  const chunks = await collect(openAIChunks(body([
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'read', arguments: '{"path":' } }, { index: 1, id: 'call_b', function: { name: 'list', arguments: '{}' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: '"a"}' } }] }, finish_reason: 'tool_calls' }] },
  ])));
  const calls = chunks.filter(c => c.block?.type === 'tool-call').map(c => c.block);
  assert.equal(calls[0].arguments, '{"path":"a"}');
  assert.equal(chunks.at(-1).reason.kind, 'tool-calls');
  const req = toOpenAI({ model: 'gemini-3.8-flash-low', messages: [{ role: 'assistant', content: calls }, { role: 'tool', toolCallId: 'call_b', content: [{ type: 'text', text: 'result' }] }] });
  assert.equal(req.messages[1].tool_call_id, 'call_b');
  assert.equal(req.messages[0].tool_calls[0].function.name, 'read');
});
test('incomplete streams and explicit failures never turn into a successful response', async () => {
  await assert.rejects(collect(openAIChunks(body([{ choices: [{ delta: { content: 'partial' } }] }]))), /中断/);
  await assert.rejects(collect(openAIChunks(body([{ error: { message: 'quota exhausted' } }]))), /quota/);
});
test('cached token usage is disjoint and unsupported controls are not falsely forwarded', async () => {
  const chunks = await collect(openAIChunks(body([{ choices: [{ delta: { content: 'OK' }, finish_reason: 'stop' }], usage: { prompt_tokens: 100, completion_tokens: 12, prompt_tokens_details: { cached_tokens: 30 } } }])));
  assert.equal(chunks.find(c => c.type === 'usage').usage.inputTokens, 70);
  const req = toOpenAI({ messages: [], maxTokens: 1, temperature: 0 });
  assert.equal(req.max_tokens, undefined);
  assert.equal(req.temperature, undefined);
});
