import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bridge } from '../src/bridge.js';
test('cancellation during bridge startup returns before startup finishes', async () => {
  const bridge = new Bridge();
  bridge.start = () => new Promise(() => {});
  const controller = new AbortController();
  const request = bridge.request('/v1/chat/completions', { signal: controller.signal });
  controller.abort(new Error('cancelled during startup'));
  await assert.rejects(request, /cancelled during startup/);
});
