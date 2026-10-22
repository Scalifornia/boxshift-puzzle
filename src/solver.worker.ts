import { solve } from './solver';
import type { Level, State } from './engine';

self.onmessage = (event: MessageEvent<{ id: string | number; level: Level; state: State }>) => {
  const { id, level, state } = event.data;
  try {
    const solution = solve(level, state, { maxNodes: 100_000, timeoutMs: 2500 });
    self.postMessage({ id, solution });
  } catch {
    self.postMessage({ id, solution: null });
  }
};
