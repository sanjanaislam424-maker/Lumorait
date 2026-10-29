export interface StreamOptions {
  endpoint: string;
  anonKey: string;
  messages: { role: string; content: string }[];
  sessionId: string | null;
  onText: (delta: string) => void;
  onDone: (savedId: string | null) => void;
}

export type StreamResult = { ok: true } | { ok: false; partial: boolean };

type StreamEvent =
  | { type: 'text'; delta: string }
  | { type: 'done'; id: string | null }
  | { type: 'error'; message: string };

const IDLE_TIMEOUT_MS = 45_000;
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1_000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runAttempt(opts: StreamOptions, onFirstText: () => void): Promise<boolean> {
  const controller = new AbortController();
  let idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  const resetIdle = () => {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => controller.abort(), IDLE_TIMEOUT_MS);
  };

  try {
    const res = await fetch(opts.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${opts.anonKey}`,
      },
      body: JSON.stringify({ messages: opts.messages, sessionId: opts.sessionId }),
      signal: controller.signal,
    });
    if (!res.ok || !res.body) return false;

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let receivedDone = false;

    while (!receivedDone) {
      const { value, done } = await reader.read();
      if (done) break;
      resetIdle();
      buffer += decoder.decode(value, { stream: true });

      let newline: number;
      while ((newline = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, newline).trim();
        buffer = buffer.slice(newline + 1);
        if (!line) continue;
        const event = JSON.parse(line) as StreamEvent;
        if (event.type === 'text') {
          onFirstText();
          opts.onText(event.delta);
        } else if (event.type === 'done') {
          opts.onDone(event.id);
          receivedDone = true;
          break;
        } else {
          await reader.cancel();
          return false;
        }
      }
    }
    return receivedDone;
  } catch {
    return false;
  } finally {
    clearTimeout(idleTimer);
  }
}

export async function streamAiReply(opts: StreamOptions): Promise<StreamResult> {
  let receivedText = false;
  const onFirstText = () => { receivedText = true; };

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) await wait(RETRY_DELAY_MS);
    const ok = await runAttempt(opts, onFirstText);
    if (ok) return { ok: true };
    if (receivedText) break;
  }
  return { ok: false, partial: receivedText };
}
