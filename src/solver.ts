import { analyzeBoard, createState, deadlocks, DIRECTIONS, isWon, move, neighbor, reachable, type Direction, type Level, type State } from './engine';

export type SolverOptions = { maxNodes?: number; timeoutMs?: number; useStoredSolution?: boolean };
type SearchNode = { player: number; boxes: number[]; g: number; f: number; parent: number; segment: Direction[] };
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };
const sameBoxes = (a: number[], b: number[]) => {
  const sortedA = [...a].sort((x, y) => x - y);
  const sortedB = [...b].sort((x, y) => x - y);
  return sortedA.length === sortedB.length && sortedA.every((cell, i) => cell === sortedB[i]);
};

/** Push-space A* with player-region canonicalisation and a reverse-distance assignment heuristic. */
export function solve(level: Level, state: State = createState(level), options: SolverOptions = {}): Direction[] | null {
  if (isWon(level, state)) return [];
  if (options.useStoredSolution !== false) {
    let replay = createState(level);
    let match = -1;
    let valid = true;
    for (let i = 0; i <= level.solution.length; i++) {
      if (state.player === replay.player && sameBoxes(state.boxes, replay.boxes)) match = i;
      if (i < level.solution.length) {
        const result = move(level, replay, level.solution[i]);
        if (!result.moved) { valid = false; break; }
        replay = result.state;
      }
    }
    if (valid && match >= 0 && isWon(level, replay)) return level.solution.slice(match);
  }
  if (deadlocks(level, state).length) return null;
  const started = performance.now();
  const maxNodes = options.maxNodes ?? 70_000;
  const timeout = options.timeoutMs ?? 1800;
  const { floor, dead, goalDistances } = analyzeBoard(level);
  const heuristicCache = new Map<string, number>();
  const heuristic = (boxes: number[]): number => {
    const key = boxes.join(',');
    const cached = heuristicCache.get(key);
    if (cached !== undefined) return cached;
    // Exact minimum bipartite distance assignment for small Sokoban boards.
    let costs = new Map<number, number>([[0, 0]]);
    for (const box of boxes) {
      const next = new Map<number, number>();
      for (const [mask, cost] of costs) for (let i = 0; i < goalDistances.length; i++) {
        const distance = goalDistances[i].get(box);
        if (!(mask & 1 << i) && distance !== undefined) {
          const newMask = mask | 1 << i;
          next.set(newMask, Math.min(next.get(newMask) ?? Infinity, cost + distance));
        }
      }
      costs = next;
    }
    const value = costs.get((1 << boxes.length) - 1) ?? Infinity;
    heuristicCache.set(key, value);
    return value;
  };
  const nodes: SearchNode[] = [{ player: state.player, boxes: [...state.boxes].sort((a, b) => a - b), g: 0, f: heuristic(state.boxes), parent: -1, segment: [] }];
  const heap = [0];
  const better = (a: number, b: number) => nodes[a].f < nodes[b].f || nodes[a].f === nodes[b].f && nodes[a].g > nodes[b].g;
  const push = (id: number) => {
    heap.push(id);
    let i = heap.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      if (!better(heap[i], heap[parent])) break;
      [heap[i], heap[parent]] = [heap[parent], heap[i]];
      i = parent;
    }
  };
  const pop = () => {
    const value = heap[0];
    const tail = heap.pop()!;
    if (heap.length) {
      heap[0] = tail;
      let i = 0;
      for (;;) {
        const left = i * 2 + 1;
        const right = left + 1;
        let best = i;
        if (left < heap.length && better(heap[left], heap[best])) best = left;
        if (right < heap.length && better(heap[right], heap[best])) best = right;
        if (best === i) break;
        [heap[i], heap[best]] = [heap[best], heap[i]];
        i = best;
      }
    }
    return value;
  };
  const visited = new Map<string, number>();
  while (heap.length && nodes.length <= maxNodes) {
    if (performance.now() - started > timeout) return null;
    const id = pop();
    const current = nodes[id];
    if (isWon(level, { ...current, moves: 0, pushes: 0 })) {
      const segments: Direction[][] = [];
      let cursor = id;
      while (nodes[cursor].parent >= 0) { segments.push(nodes[cursor].segment); cursor = nodes[cursor].parent; }
      return segments.reverse().flat();
    }
    const paths = reachable(level, current);
    const key = `${current.boxes.join(',')}|${Math.min(...paths.keys())}`;
    if ((visited.get(key) ?? Infinity) <= current.g) continue;
    visited.set(key, current.g);
    const occupied = new Set(current.boxes);
    for (const box of current.boxes) for (const direction of DIRECTIONS) {
      const behind = neighbor(level, box, opposite[direction]);
      const destination = neighbor(level, box, direction);
      const walk = paths.get(behind);
      if (!walk || !floor.has(destination) || occupied.has(destination) || dead.has(destination)) continue;
      const boxes = current.boxes.map(cell => cell === box ? destination : cell).sort((a, b) => a - b);
      if (deadlocks(level, { player: box, boxes, moves: 0, pushes: 0 }).length) continue;
      const h = heuristic(boxes);
      if (!Number.isFinite(h)) continue;
      const g = current.g + 1;
      nodes.push({ player: box, boxes, g, f: g + h, parent: id, segment: [...walk, direction] });
      push(nodes.length - 1);
    }
  }
  return null;
}
