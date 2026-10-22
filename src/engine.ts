/** The simulation is independent from rendering, storage and input devices. */
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Position = { x: number; y: number };
export type Level = {
  id: number;
  name: string;
  difficulty: 'easy' | 'medium' | 'hard';
  width: number;
  height: number;
  walls: number[];
  floor: number[];
  goals: number[];
  boxes: number[];
  player: number;
  solution: Direction[];
  par: number;
  inspired?: boolean;
};
export type State = { player: number; boxes: number[]; moves: number; pushes: number };
export const DIRECTIONS: Direction[] = ['up', 'down', 'left', 'right'];
const VECTORS: Record<Direction, Position> = {
  up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 },
};

export function neighbor(level: Pick<Level, 'width' | 'height'>, cell: number, direction: Direction): number {
  const delta = VECTORS[direction];
  const x = cell % level.width + delta.x;
  const y = Math.floor(cell / level.width) + delta.y;
  return x >= 0 && x < level.width && y >= 0 && y < level.height ? y * level.width + x : -1;
}

export function createState(level: Level): State {
  return { player: level.player, boxes: [...level.boxes].sort((a, b) => a - b), moves: 0, pushes: 0 };
}

export function isWon(level: Level, state: State): boolean {
  return state.boxes.length > 0 && state.boxes.length === level.goals.length &&
    state.boxes.every(cell => level.goals.includes(cell));
}

type BoardAnalysis = { floor: Set<number>; dead: Set<number>; goalDistances: Map<number, number>[] };
const analysisCache = new WeakMap<Level, BoardAnalysis>();
const OPPOSITE: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

/** Reverse box reachability identifies corners and wall strips without a goal. */
export function analyzeBoard(level: Level): BoardAnalysis {
  const cached = analysisCache.get(level);
  if (cached) return cached;
  const floor = new Set(level.floor);
  const useful = new Set<number>();
  const goalDistances = level.goals.map(goal => {
    const distances = new Map<number, number>([[goal, 0]]);
    const queue = [goal];
    for (let i = 0; i < queue.length; i++) {
      const current = queue[i];
      useful.add(current);
      for (const direction of DIRECTIONS) {
        const previous = neighbor(level, current, OPPOSITE[direction]);
        const standing = neighbor(level, previous, OPPOSITE[direction]);
        if (previous >= 0 && standing >= 0 && floor.has(previous) && floor.has(standing) && !distances.has(previous)) {
          distances.set(previous, distances.get(current)! + 1);
          queue.push(previous);
        }
      }
    }
    return distances;
  });
  const result = { floor, dead: new Set(level.floor.filter(cell => !useful.has(cell))), goalDistances };
  analysisCache.set(level, result);
  return result;
}

/** Only certain deadlocks are flagged; this is deliberately not a complete solver. */
export function deadlocks(level: Level, state: State): number[] {
  const { floor, dead } = analyzeBoard(level);
  const boxes = new Set(state.boxes);
  const goals = new Set(level.goals);
  const blocked = new Set(state.boxes.filter(cell => dead.has(cell) && !goals.has(cell)));
  // A solid 2 × 2 block cannot be moved. Boxes already on goals are harmless.
  for (const box of state.boxes) {
    const x = box % level.width;
    const y = Math.floor(box / level.width);
    for (const ox of [-1, 0]) for (const oy of [-1, 0]) {
      const cells = [0, 1].flatMap(dy => [0, 1].map(dx => {
        const cx = x + ox + dx;
        const cy = y + oy + dy;
        return cx < 0 || cx >= level.width || cy < 0 || cy >= level.height ? -1 : cy * level.width + cx;
      }));
      if (cells.every(cell => !floor.has(cell) || boxes.has(cell))) {
        for (const cell of cells) if (boxes.has(cell) && !goals.has(cell)) blocked.add(cell);
      }
    }
  }
  return [...blocked].sort((a, b) => a - b);
}

export type MoveResult = {
  state: State; moved: boolean; pushed: boolean; from?: number; to?: number; deadlocked: boolean;
};

export function move(level: Level, state: State, direction: Direction): MoveResult {
  const floor = analyzeBoard(level).floor;
  const next = neighbor(level, state.player, direction);
  const fail = (): MoveResult => ({ state, moved: false, pushed: false, deadlocked: deadlocks(level, state).length > 0 });
  if (!floor.has(next)) return fail();
  const box = state.boxes.indexOf(next);
  if (box < 0) {
    return { state: { ...state, player: next, boxes: [...state.boxes], moves: state.moves + 1 }, moved: true, pushed: false, deadlocked: deadlocks(level, state).length > 0 };
  }
  const destination = neighbor(level, next, direction);
  if (!floor.has(destination) || state.boxes.includes(destination)) return fail();
  const boxes = [...state.boxes];
  boxes[box] = destination;
  boxes.sort((a, b) => a - b);
  const nextState = { player: next, boxes, moves: state.moves + 1, pushes: state.pushes + 1 };
  return { state: nextState, moved: true, pushed: true, from: next, to: destination, deadlocked: deadlocks(level, nextState).length > 0 };
}

export function reachable(level: Level, state: Pick<State, 'player' | 'boxes'>): Map<number, Direction[]> {
  const floor = analyzeBoard(level).floor;
  const boxes = new Set(state.boxes);
  const paths = new Map<number, Direction[]>([[state.player, []]]);
  const queue = [state.player];
  for (let i = 0; i < queue.length; i++) {
    const cell = queue[i];
    for (const direction of DIRECTIONS) {
      const next = neighbor(level, cell, direction);
      if (floor.has(next) && !boxes.has(next) && !paths.has(next)) {
        paths.set(next, [...paths.get(cell)!, direction]);
        queue.push(next);
      }
    }
  }
  return paths;
}

/** Tap-to-walk never moves or crosses a box. */
export function findPath(level: Level, state: State, target: number): Direction[] | null {
  return reachable(level, state).get(target) ?? null;
}

export function validateLevel(level: Level): string[] {
  const errors: string[] = [];
  const size = level.width * level.height;
  if (!Number.isInteger(level.width) || !Number.isInteger(level.height) || level.width < 3 || level.height < 3 || level.width > 24 || level.height > 24) errors.push('Invalid map dimensions');
  const inBounds = (cell: number) => Number.isInteger(cell) && cell >= 0 && cell < size;
  for (const [name, cells] of Object.entries({ walls: level.walls, floor: level.floor, goals: level.goals, boxes: level.boxes })) {
    if (cells.some(cell => !inBounds(cell))) errors.push(`Invalid ${name} positions`);
    if (new Set(cells).size !== cells.length) errors.push(`Duplicate ${name} positions`);
  }
  const floor = new Set(level.floor);
  if (!inBounds(level.player) || !floor.has(level.player) || level.boxes.includes(level.player)) errors.push('Invalid player position');
  if (level.boxes.length === 0 || level.boxes.length !== level.goals.length) errors.push('Box and goal counts must match and be nonzero');
  if (level.boxes.some(cell => !floor.has(cell)) || level.goals.some(cell => !floor.has(cell))) errors.push('Boxes and goals must stand on floor');
  if (level.walls.some(cell => floor.has(cell))) errors.push('Walls overlap floor');
  if (new Set([...level.floor, ...level.walls]).size !== size) errors.push('Map must describe every cell');
  if (errors.length === 0) {
    let state = createState(level);
    for (const direction of level.solution) {
      if (!DIRECTIONS.includes(direction)) { errors.push('Solution contains an invalid direction'); break; }
      const result = move(level, state, direction);
      if (!result.moved) { errors.push('Stored solution makes an illegal move'); break; }
      state = result.state;
    }
    if (!isWon(level, state)) errors.push('Stored solution does not solve the level');
    if (!Number.isFinite(level.par) || level.par < level.solution.length) errors.push('Par must accommodate the verified solution');
  }
  return errors;
}
