export async function* parseSSE(body) {
  const reader = body.getReader(), decoder = new TextDecoder();
  let buffer = '', data = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let at;
      while ((at = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, at).replace(/\r$/, ''); buffer = buffer.slice(at + 1);
        if (line.startsWith('data:')) data.push(line.slice(5).trimStart());
        else if (!line && data.length) {
          const raw = data.join('\n'); data = [];
          if (raw !== '[DONE]') yield JSON.parse(raw);
        }
      }
      if (done) {
        if (buffer.startsWith('data:')) data.push(buffer.slice(5).trim());
        if (data.length && data.join('\n') !== '[DONE]') yield JSON.parse(data.join('\n'));
        break;
      }
    }
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
