import { DIRECTIONS, neighbor, type Direction, type Level, type State } from './engine';

/** An original adventure ruleset. Classic Sokoban remains entirely separate. */
export type InfernoLevel = Level & {
  exit: number;
  key?: number;
  doors: number[];
  hazards: { cell: number; phase: 0 | 1 }[];
  enemies: number[];
  budget: number;
};

export type InfernoState = State & {
  hasKey: boolean;
  /** Only doors that are still closed are retained. */
  doors: number[];
  /** Only sentinels that are still present are retained. */
  enemies: number[];
  phase: 0 | 1;
  spent: number;
  status: 'playing' | 'won' | 'failed';
  failure?: 'budget';
};

export type InfernoEvent = 'walk' | 'kick' | 'strike' | 'key' | 'escape' | 'trap' | 'blocked' | 'exhausted';
export type InfernoMoveResult = {
  state: InfernoState;
  /** True for every accepted action, including a stationary kick or strike. */
  moved: boolean;
  pushed: boolean;
  from?: number;
  to?: number;
  event: InfernoEvent;
  cost: number;
};

export function createInfernoState(level: InfernoLevel): InfernoState {
  return {
    player: level.player, boxes: [...level.boxes].sort((a, b) => a - b), moves: 0, pushes: 0,
    hasKey: level.key === undefined, doors: [...level.doors], enemies: [...level.enemies],
    phase: 0, spent: 0, status: 'playing',
  };
}

/** Every accepted action costs one turn and flips the phase. Only ENTERING a
 * currently active hazard adds two turns; standing still to kick or strike does
 * not retrigger it. Blocked inputs change neither the clock nor the phase. */
export function infernoMove(level: InfernoLevel, state: InfernoState, direction: Direction): InfernoMoveResult {
  const blocked = (): InfernoMoveResult => ({ state, moved: false, pushed: false, event: 'blocked', cost: 0 });
  if (state.status !== 'playing') return blocked();
  const next = neighbor(level, state.player, direction);
  if (!level.floor.includes(next) || state.doors.includes(next)) return blocked();
  let player = state.player;
  let boxes = [...state.boxes];
  let enemies = [...state.enemies];
  let event: InfernoEvent = 'walk';
  let from: number | undefined;
  let to: number | undefined;
  let cost = 1;
  const pushed = boxes.includes(next);
  if (pushed) {
    const destination = neighbor(level, next, direction);
    if (!level.floor.includes(destination) || boxes.includes(destination) || enemies.includes(destination) || state.doors.includes(destination)) return blocked();
    boxes = boxes.map(cell => cell === next ? destination : cell).sort((a, b) => a - b);
    event = 'kick'; from = next; to = destination;
  } else if (enemies.includes(next)) {
    enemies = enemies.filter(cell => cell !== next);
    event = 'strike'; from = next; to = next;
  } else {
    player = next;
    if (level.hazards.some(hazard => hazard.cell === next && hazard.phase === state.phase)) {
      cost += 2;
      event = 'trap';
    }
  }
  const collectedKey = player === level.key && !state.hasKey;
  const hasKey = state.hasKey || collectedKey;
  const spent = state.spent + cost;
  const escaped = player === level.exit && hasKey && spent <= level.budget;
  const exhausted = !escaped && spent >= level.budget;
  const nextState: InfernoState = {
    player, boxes, enemies, hasKey, doors: hasKey ? [] : [...state.doors],
    moves: state.moves + 1, pushes: state.pushes + (pushed ? 1 : 0),
    phase: state.phase === 0 ? 1 : 0, spent,
    status: escaped ? 'won' : exhausted ? 'failed' : 'playing',
    ...(exhausted ? { failure: 'budget' as const } : {}),
  };
  if (escaped) event = 'escape';
  else if (exhausted) event = 'exhausted';
  else if (collectedKey) event = 'key';
  return { state: nextState, moved: true, pushed, from, to, event, cost };
}

export type InfernoSolverOptions = { maxNodes?: number; timeoutMs?: number };
type SearchNode = { state: InfernoState; parent: number; direction?: Direction };
const stateKey = (state: InfernoState) => `${state.player}|${state.boxes.join(',')}|${state.enemies.join(',')}|${state.hasKey ? 1 : 0}|${state.phase}`;

/** Cost-layer breadth-first search (Dial's algorithm): accepted actions cost
 * either 1 or 3, so small integer buckets find the least spent-turn route.
 * Nodes, wall time and the room's strict turn budget bound every hint search. */
export function findInfernoSolution(level: InfernoLevel, initial: InfernoState = createInfernoState(level), options: InfernoSolverOptions = {}): Direction[] | null {
  if (initial.status === 'won') return [];
  if (initial.status !== 'playing' || initial.spent >= level.budget) return null;
  const started = performance.now();
  const timeout = options.timeoutMs ?? 90;
  const maximum = options.maxNodes ?? 20_000;
  const nodes: SearchNode[] = [{ state: initial, parent: -1 }];
  const buckets = new Map<number, number[]>([[initial.spent, [0]]]);
  const best = new Map<string, number>([[stateKey(initial), initial.spent]]);
  let expanded = 0;
  for (let cost = initial.spent; cost <= level.budget; cost++) {
    const bucket = buckets.get(cost);
    if (!bucket) continue;
    for (const id of bucket) {
      if (expanded++ >= maximum || performance.now() - started > timeout) return null;
      const current = nodes[id];
      if ((best.get(stateKey(current.state)) ?? Infinity) < current.state.spent) continue;
      if (current.state.status === 'won') {
        const route: Direction[] = [];
        let cursor = id;
        while (nodes[cursor].parent >= 0) {
          route.push(nodes[cursor].direction!);
          cursor = nodes[cursor].parent;
        }
        return route.reverse();
      }
      for (const direction of DIRECTIONS) {
        const result = infernoMove(level, current.state, direction);
        if (!result.moved || result.state.status === 'failed') continue;
        const key = stateKey(result.state);
        if ((best.get(key) ?? Infinity) <= result.state.spent) continue;
        best.set(key, result.state.spent);
        nodes.push({ state: result.state, parent: id, direction });
        const nextBucket = buckets.get(result.state.spent) ?? [];
        nextBucket.push(nodes.length - 1);
        buckets.set(result.state.spent, nextBucket);
      }
    }
  }
  return null;
}

type InfernoBlueprint = { name: string; rows: string[]; route: string; budget: number };
const blueprints: InfernoBlueprint[] = [
  {
    "name": "Threshold",
    "rows": [
      "#######",
      "#@#   #",
      "#S# # #",
      "# $   #",
      "####  #",
      "#    E#",
      "#######"
    ],
    "route": "DDDRRRRRRDDR",
    "budget": 14
  },
  {
    "name": "Broken oath",
    "rows": [
      "#######",
      "# # @ #",
      "#E#   #",
      "# # #$#",
      "# ##  #",
      "# S   #",
      "#######"
    ],
    "route": "DRDDDDLDLLLLUUU",
    "budget": 17
  },
  {
    "name": "The jailer",
    "rows": [
      "#######",
      "# # S #",
      "#   # #",
      "#$#K#@#",
      "#E##SD#",
      "#     #",
      "#######"
    ],
    "route": "UULLLDDULLDDDD",
    "budget": 16
  },
  {
    "name": "Twin embers",
    "rows": [
      "#########",
      "#  a    #",
      "# $ # # #",
      "#D# E # #",
      "# b ###S#",
      "# # #   #",
      "# #@# #a#",
      "# S #  K#",
      "#########"
    ],
    "route": "UUUULURRRRDDDDDDDUUUUUULLDDL",
    "budget": 29
  },
  {
    "name": "Iron chapel",
    "rows": [
      "#########",
      "#    SK #",
      "# ### #S#",
      "#  b# # #",
      "#  $###$#",
      "#D# #  @#",
      "#  a#a# #",
      "#   E   #",
      "#########"
    ],
    "route": "DDLLLLUUUULULUURRRRRRRDDDDDDDLLDDL",
    "budget": 37
  },
  {
    "name": "Ash crossing",
    "rows": [
      "#########",
      "#     #K#",
      "### #baS#",
      "#  $ a  #",
      "#$ #### #",
      "#     D #",
      "#  ######",
      "# S @  E#",
      "#########"
    ],
    "route": "LLLUUUURRRUURRDRRRUDDDDLLLLLDDRRRRR",
    "budget": 36
  },
  {
    "name": "Black reliquary",
    "rows": [
      "#########",
      "# # a$S #",
      "#E   #  #",
      "# $ # b #",
      "##### D##",
      "# #K  # #",
      "# # # #@#",
      "# Sa    #",
      "#########"
    ],
    "route": "DLLLLLUURRUURUUULLLLDLLL",
    "budget": 27
  },
  {
    "name": "Hall of chains",
    "rows": [
      "#########",
      "# #  DE@#",
      "# # ##  #",
      "#$# aS# #",
      "#a### # #",
      "#   #   #",
      "#aSS##  #",
      "#Kb b$  #",
      "#########"
    ],
    "route": "DDDDDDLLLLLLLUULLLDURRDLRRRUURUUUUL",
    "budget": 36
  },
  {
    "name": "Crimson machinery",
    "rows": [
      "###########",
      "#S a D  # #",
      "# # #S  # #",
      "# #b  # #K#",
      "# ### #@# #",
      "#   aa#  $#",
      "#$ ##b### #",
      "# E #    S#",
      "###########"
    ],
    "route": "UULLLDDDDDRRRRRUUUUUUUDDDDLLLLUULLLDD",
    "budget": 39
  },
  {
    "name": "A last spark",
    "rows": [
      "###########",
      "#   SS    #",
      "# ### D## #",
      "#   #   #b#",
      "### ###S#a#",
      "# a # $ # #",
      "#@#b$  ## #",
      "#  $ K# aE#",
      "###########"
    ],
    "route": "URRDRRDLRLULUUULLUURRRRRRRRRRDDDDDD",
    "budget": 39
  },
  {
    "name": "The long descent",
    "rows": [
      "###########",
      "#@#  a$  S#",
      "# ##  ### #",
      "#   #K#  a#",
      "### ##bE  #",
      "#b a S$ D #",
      "# ###S### #",
      "#    $#   #",
      "###########"
    ],
    "route": "DDRRDDRRRDRRURURRUUULLLLLLDDUURRRRDDDLL",
    "budget": 41
  },
  {
    "name": "Heart of the furnace",
    "rows": [
      "###########",
      "#a b# SD  #",
      "###a# ### #",
      "#  $      #",
      "#b ###  #S#",
      "#a#   #E#@#",
      "#S# #K#  $#",
      "#   #$  # #",
      "###########"
    ],
    "route": "UUULLLLLLLLLDLDDDDRRUURRDULLDDLLUUURURRRRDRD",
    "budget": 48
  }
];

/** All footprints, encounters and routes are original BOXSHIFT content. */
export const INFERNO_LEVELS: InfernoLevel[] = blueprints.map((blueprint, index) => {
  const width = blueprint.rows[0].length;
  const level: InfernoLevel = {
    id: index + 1, name: blueprint.name, difficulty: index < 4 ? 'easy' : index < 8 ? 'medium' : 'hard',
    width, height: blueprint.rows.length, walls: [], floor: [], goals: [], boxes: [], player: -1,
    solution: [], par: blueprint.route.length, exit: -1, doors: [], hazards: [], enemies: [], budget: blueprint.budget,
  };
  blueprint.rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const cell = y * width + x;
    if (tile === '#') level.walls.push(cell);
    else level.floor.push(cell);
    if (tile === '@') level.player = cell;
    if (tile === '$') level.boxes.push(cell);
    if (tile === 'K') level.key = cell;
    if (tile === 'D') level.doors.push(cell);
    if (tile === 'S') level.enemies.push(cell);
    if (tile === 'a' || tile === 'b') level.hazards.push({ cell, phase: tile === 'a' ? 0 : 1 });
    if (tile === 'E') { level.exit = cell; level.goals.push(cell); }
  }));
  const directions: Record<string, Direction> = { U: 'up', D: 'down', L: 'left', R: 'right' };
  level.solution = [...blueprint.route].map(letter => directions[letter]);
  return level;
});
