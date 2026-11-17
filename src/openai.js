import { parseSSE } from './sse.js';
export const PROVIDER = 'gemini-subscription';
const blocks = content => typeof content === 'string' ? [{ type: 'text', text: content }] : content || [];
const text = content => blocks(content).filter(b => b.type === 'text').map(b => b.text).join('\n');
export function toOpenAI(options) {
  const messages = options.system ? [{ role: 'system', content: options.system }] : [];
  for (const m of options.messages) {
    if (m.role === 'tool') { messages.push({ role: 'tool', tool_call_id: m.toolCallId, content: text(m.content) }); continue; }
    const calls = blocks(m.content).filter(b => b.type === 'tool-call');
    if (blocks(m.content).some(b => b.type === 'image')) throw new Error('此版本暂不支持图片输入。');
    const content = text(m.content);
    if (!content && !calls.length) continue;
    messages.push({ role: m.role === 'developer' ? 'user' : m.role, content: content || null,
      ...(calls.length ? { tool_calls: calls.map(b => ({ id: b.id, type: 'function', function: { name: b.name, arguments: b.arguments } })) } : {}),
    });
  }
  return { model: options.model, messages, stream: true, stream_options: { include_usage: true },
    ...(options.tools?.length ? { tools: options.tools.map(t => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } })) } : {}),
  };
}
export async function* openAIChunks(body) {
  let nextIndex = 0, textBlock, finish, usage;
  const calls = new Map();
  for await (const event of parseSSE(body)) {
    if (event.error) throw new Error(event.error.message || 'Gemini bridge error');
    if (event.usage) usage = event.usage;
    const choice = event.choices?.[0];
    if (choice?.finish_reason) finish = choice.finish_reason;
    const delta = choice?.delta;
    if (delta?.content) {
      if (!textBlock) { textBlock = { index: nextIndex++, text: '' }; yield { type: 'block-start', index: textBlock.index, blockType: 'text' }; }
      textBlock.text += delta.content;
      yield { type: 'text-delta', index: textBlock.index, text: delta.content };
    }
    for (const call of delta?.tool_calls || []) {
      let entry = calls.get(call.index);
      if (!entry) {
        entry = { index: nextIndex++, id: call.id, name: '', arguments: '' }; calls.set(call.index, entry);
        yield { type: 'block-start', index: entry.index, blockType: 'tool-call' };
      }
      if (call.id) entry.id = call.id;
      entry.name += call.function?.name || '';
      entry.arguments += call.function?.arguments || '';
    }
  }
  if (!finish) throw new Error('Gemini 连接中断，未收到完整结束事件。');
  if (!['stop', 'tool_calls', 'length'].includes(finish)) throw new Error(`Gemini 停止生成：${finish}`);
  if (textBlock) yield { type: 'block-end', index: textBlock.index, block: { type: 'text', text: textBlock.text } };
  for (const c of calls.values()) {
    if (!c.id || !c.name) throw new Error('Gemini 工具调用不完整');
    if (finish !== 'length') JSON.parse(c.arguments || '{}');
    yield { type: 'tool-call-delta', index: c.index, id: c.id, name: c.name, argumentsDelta: c.arguments || '{}' };
    yield { type: 'block-end', index: c.index, block: { type: 'tool-call', id: c.id, name: c.name, arguments: c.arguments || '{}' } };
  }
  if (usage) yield { type: 'usage', usage: { inputTokens: Math.max(0, (usage.prompt_tokens || 0) - (usage.prompt_tokens_details?.cached_tokens || 0)), outputTokens: usage.completion_tokens || 0, cacheReadTokens: usage.prompt_tokens_details?.cached_tokens || 0 } };
  yield { type: 'finish', reason: { kind: finish === 'length' ? 'max-tokens' : calls.size ? 'tool-calls' : 'stop' } };
}
