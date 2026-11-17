// Uses a real signed-in account and consumes subscription quota.
import { Context } from '@deepseek-ai/cordis';
import { LlmRuntime, BlockAssembler, createUserMessage, createAssistantMessage, createToolResultMessage } from '@deepseek-ai/dsh-llm';
import { Bridge } from '../src/bridge.js';
import { GeminiAdapter } from '../src/index.js';
const bridge = new Bridge();
const runtime = new LlmRuntime(new Context());
runtime.registerAdapter(['gemini-subscription'], new GeminiAdapter(bridge));
const sessionId = crypto.randomUUID();
const messages = [createUserMessage({ source: { kind: 'user' }, content: [{ type: 'text', text: 'Call the client_echo tool once with value "ping". Then quote the complete tool result in your final answer. Do not use any other tools.' }] })];
const tools = [{ name: 'client_echo', description: 'Echo a test value through the client.', parameters: { type: 'object', properties: { value: { type: 'string' } }, required: ['value'] } }];
async function turn() {
  const assembled = new BlockAssembler();
  for await (const chunk of runtime.stream({ provider: 'gemini-subscription', model: 'gemini-3.8-flash-low', sessionId, messages, tools, signal: AbortSignal.timeout(180000) })) assembled.push(chunk);
  if (assembled.finish.kind === 'error' || assembled.finish.kind === 'aborted') throw new Error(JSON.stringify(assembled.finish));
  return assembled;
}
try {
  const first = await turn();
  const call = first.blocks().find(b => b.type === 'tool-call');
  if (!call || call.name !== 'client_echo' || JSON.parse(call.arguments).value !== 'ping') throw new Error('Expected client_echo tool call');
  console.log('PASS: real Gemini tool call reached DSH');
  messages.push(createAssistantMessage({ source: { provider: 'gemini-subscription', model: 'gemini-3.8-flash-low' }, content: first.blocks() }));
  const marker = `CLIENT_TOOL_OK_${crypto.randomUUID()}`;
  messages.push(createToolResultMessage({ callId: call.id, content: [{ type: 'text', text: marker }], isError: false }));
  const second = await turn();
  const answer = second.blocks().filter(b => b.type === 'text').map(b => b.text).join('');
  if (!answer.includes(marker)) throw new Error('Model did not receive the actual client result');
  console.log('PASS: real DSH tool result returned to Gemini and appeared in final text');
} finally { bridge.stop(); }
