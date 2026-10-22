import { afterEach, describe, expect, it, vi } from 'vitest';
import { createState, type Level } from '../src/engine';
import { BoardRenderer } from '../src/renderer';

const level: Level = {
  id: 1, name: 'Canvas fixture', difficulty: 'easy', width: 8, height: 6,
  walls: [], floor: Array.from({ length: 48 }, (_, i) => i),
  boxes: [18], goals: [20], player: 26, solution: [], par: 3,
};

function environment() {
  const queued = new Map<number, FrameRequestCallback>();
  const listeners = new Map<string, () => void>();
  let nextFrame = 0;
  let onResize = () => {};
  let rect = { left: 30, top: 40, width: 800, height: 600 };
  const disconnected = vi.fn();
  const gradient = { addColorStop: vi.fn() };
  const noop = () => {};
  const context = new Proxy<Record<string, unknown>>({}, {
    get(target, property: string) {
      if (property === 'createLinearGradient' || property === 'createRadialGradient') return () => gradient;
      return target[property] ?? noop;
    },
    set(target, property: string, value: unknown) { target[property] = value; return true; },
  });
  const canvas = {
    width: 0, height: 0,
    getContext: () => context,
    getBoundingClientRect: () => rect,
  } as unknown as HTMLCanvasElement;
  const document = {
    hidden: false,
    addEventListener: (name: string, listener: () => void) => listeners.set(name, listener),
    removeEventListener: (name: string) => listeners.delete(name),
  };
  vi.stubGlobal('window', { devicePixelRatio: 3 });
  vi.stubGlobal('document', document);
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { onResize = callback; }
    observe() {}
    disconnect = disconnected;
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    queued.set(++nextFrame, callback);
    return nextFrame;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => queued.delete(id));
  const renderer = new BoardRenderer(canvas);
  renderer.setLevel(level, createState(level));
  return {
    renderer, canvas, queued, listeners, document, disconnected,
    resize(width: number, height: number) { rect = { ...rect, width, height }; onResize(); },
  };
}

afterEach(() => vi.unstubAllGlobals());

describe('Canvas sizing and animation lifecycle', () => {
  it('keeps input aligned to the centered board after a portrait resize and caps DPR', () => {
    const { renderer, canvas, resize } = environment();
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(1200);
    expect(renderer.cellAt(430, 340)).toBe(28);
    expect(renderer.cellAt(31, 41)).toBeNull();
    resize(400, 900);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(1800);
    expect(renderer.cellAt(230, 490)).toBe(28);
    expect(renderer.cellAt(230, 60)).toBeNull();
    renderer.destroy();
  });

  it('stops animation when paused, hidden or reduced motion is enabled, and cleans up', () => {
    const { renderer, queued, listeners, document, disconnected } = environment();
    expect(queued.size).toBe(1);
    renderer.setPaused(true);
    expect(queued.size).toBe(0);
    renderer.setPaused(false);
    expect(queued.size).toBe(1);
    document.hidden = true;
    listeners.get('visibilitychange')!();
    expect(queued.size).toBe(0);
    document.hidden = false;
    listeners.get('visibilitychange')!();
    expect(queued.size).toBe(1);
    renderer.setReducedMotion(true);
    expect(queued.size).toBe(0);
    renderer.update({ player: 27, boxes: [19], moves: 1, pushes: 1 }, 'right', true);
    renderer.celebrate();
    expect(queued.size).toBe(0);
    renderer.setReducedMotion(false);
    expect(queued.size).toBe(1);
    renderer.destroy();
    expect(queued.size).toBe(0);
    expect(disconnected).toHaveBeenCalledOnce();
    expect(listeners.size).toBe(0);
  });
});
