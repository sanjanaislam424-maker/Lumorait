const TICK_MS = 30;
const WORD = /^\s*\S+\s*/;

export interface Typewriter {
  push: (text: string) => void;
  drain: () => Promise<void>;
  stop: () => void;
}

export function createTypewriter(onReveal: (text: string) => void): Typewriter {
  let pending = '';
  let timer: ReturnType<typeof setInterval> | null = null;
  let waiters: (() => void)[] = [];

  const settle = () => {
    if (timer !== null) clearInterval(timer);
    timer = null;
    const done = waiters;
    waiters = [];
    done.forEach((resolve) => resolve());
  };

  const tick = () => {
    if (!pending) {
      settle();
      return;
    }
    const wordsThisTick = Math.max(1, Math.ceil(pending.length / 160));
    let chunk = '';
    for (let i = 0; i < wordsThisTick; i++) {
      const match = WORD.exec(pending);
      if (!match) break;
      chunk += match[0];
      pending = pending.slice(match[0].length);
    }
    if (chunk) onReveal(chunk);
  };

  const ensureRunning = () => {
    if (timer === null) timer = setInterval(tick, TICK_MS);
  };

  return {
    push(text) {
      pending += text;
      ensureRunning();
    },
    drain() {
      if (!pending && timer === null) return Promise.resolve();
      ensureRunning();
      return new Promise<void>((resolve) => { waiters.push(resolve); });
    },
    stop() {
      pending = '';
      settle();
    },
  };
}
