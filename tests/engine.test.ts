import { describe, expect, it } from 'vitest';
import { createState, deadlocks, findPath, isWon, move, neighbor, validateLevel, type Direction, type Level } from '../src/engine';
import { dailyLevel, LEVELS } from '../src/levels';
import { solve } from '../src/solver';

function fixture(rows: string[]): Level {
  const width = rows[0].length;
  const level: Level = { id: 0, name: 'Test', difficulty: 'easy', width, height: rows.length, walls: [], floor: [], goals: [], boxes: [], player: -1, solution: [], par: 100 };
  rows.forEach((row, y) => [...row].forEach((tile, x) => {
    const cell = y * width + x;
    if (tile === '#') level.walls.push(cell);
    else level.floor.push(cell);
    if ('.*+'.includes(tile)) level.goals.push(cell);
    if ('$*'.includes(tile)) level.boxes.push(cell);
    if ('@+'.includes(tile)) level.player = cell;
  }));
  return level;
}

const room = () => fixture(['########', '#@ $  .#', '#   $ .#', '#      #', '########']);
const replay = (level: Level, directions: Direction[], initial = createState(level)) => directions.reduce((state, direction) => {
  const result = move(level, state, direction);
  expect(result.moved).toBe(true);
  return result.state;
}, initial);

describe('Sokoban movement', () => {
  it('walks in all four directions without changing boxes', () => {
    const level = room();
    const initial = createState(level);
    const state = replay(level, ['down', 'right', 'up', 'left']);
    expect(state.player).toBe(initial.player);
    expect(state.moves).toBe(4);
    expect(state.pushes).toBe(0);
    expect(state.boxes).toEqual(initial.boxes);
  });

  it('does not walk into a wall or wrap at a row boundary', () => {
    const level = room();
    const initial = createState(level);
    expect(move(level, initial, 'up')).toMatchObject({ moved: false, pushed: false, state: initial });
    expect(neighbor(level, 7, 'right')).toBe(-1);
    expect(neighbor(level, 8, 'left')).toBe(-1);
  });

  it('pushes one box and counts the walk and push separately', () => {
    const level = room();
    const initial = createState(level);
    const result = move(level, move(level, initial, 'right').state, 'right');
    expect(result).toMatchObject({ moved: true, pushed: true, from: 11, to: 12 });
    expect(result.state.moves).toBe(2);
    expect(result.state.pushes).toBe(1);
    expect(initial.boxes).toContain(11);
    expect(result.state.boxes).toContain(12);
  });

  it('never pulls a box when walking away', () => {
    const level = room();
    const state = replay(level, ['right', 'left']);
    expect(state.boxes).toEqual(level.boxes);
    expect(state.pushes).toBe(0);
  });

  it('cannot push two adjacent boxes', () => {
    const level = fixture(['#######', '#@$$..#', '#     #', '#######']);
    const initial = createState(level);
    expect(move(level, initial, 'right')).toMatchObject({ state: initial, moved: false, pushed: false });
  });

  it('cannot push a box against a wall', () => {
    const level = fixture(['######', '# @$##', '#  . #', '######']);
    expect(move(level, createState(level), 'right').moved).toBe(false);
  });

  it('only wins when all boxes occupy goals and allows goals to be vacated', () => {
    const level = fixture(['#######', '# @* .#', '#  $  #', '#     #', '#######']);
    const initial = createState(level);
    expect(isWon(level, initial)).toBe(false);
    const result = move(level, initial, 'right');
    expect(result.pushed).toBe(true);
    expect(result.state.boxes).not.toContain(10);
    expect(level.goals).toContain(10);
    expect(isWon(level, { player: 9, boxes: [...level.goals], moves: 0, pushes: 0 })).toBe(true);
    expect(isWon(level, { player: 9, boxes: [], moves: 0, pushes: 0 })).toBe(false);
  });

  it('keeps immutable snapshots for complete undo and restart', () => {
    const level = room();
    const start = createState(level);
    const beforePush = move(level, start, 'right').state;
    const history = [start, beforePush];
    const afterPush = move(level, beforePush, 'right').state;
    expect(afterPush.pushes).toBe(1);
    expect(history.pop()).toEqual({ player: 10, boxes: [11, 20], moves: 1, pushes: 0 });
    expect(createState(level)).toEqual(start);
    expect(level.boxes).toEqual([11, 20]);
  });
});

describe('walking and strategic feedback', () => {
  it('finds a shortest walking path without pushing boxes', () => {
    const level = room();
    const start = createState(level);
    const path = findPath(level, start, 14);
    expect(path).not.toBeNull();
    const end = replay(level, path!, start);
    expect(end.player).toBe(14);
    expect(end.pushes).toBe(0);
    expect(findPath(level, start, 11)).toBeNull();
    expect(findPath(level, start, 0)).toBeNull();
    expect(findPath(level, start, start.player)).toEqual([]);
  });

  it('detects a box in a corner without a goal', () => {
    const level = fixture(['######', '#$ @.#', '#    #', '######']);
    expect(deadlocks(level, createState(level))).toEqual([7]);
  });

  it('does not flag a correctly filled corner', () => {
    const level = fixture(['######', '#* @ #', '#    #', '######']);
    expect(deadlocks(level, createState(level))).toEqual([]);
  });

  it('detects a frozen 2 by 2 box block', () => {
    const level = fixture(['########', '#@     #', '# $$ ..#', '# $$ ..#', '#      #', '########']);
    expect(deadlocks(level, createState(level))).toEqual([18, 19, 26, 27]);
  });
});

describe('verified original campaign', () => {
  it('contains forty distinct layouts and the requested progression', () => {
    expect(LEVELS).toHaveLength(40);
    expect(LEVELS.map(level => level.id)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    expect(LEVELS.filter(level => level.difficulty === 'easy')).toHaveLength(15);
    expect(LEVELS.filter(level => level.difficulty === 'medium')).toHaveLength(15);
    expect(LEVELS.filter(level => level.difficulty === 'hard')).toHaveLength(10);
    expect(LEVELS.filter(level => level.inspired)).toHaveLength(3);
    expect(new Set(LEVELS.map(level => `${level.width}/${level.height}/${level.floor}`)).size).toBe(40);
  });

  it('opens with several boxes and meaningful manoeuvres instead of a two-move tutorial', () => {
    const first = LEVELS[0];
    expect(first.boxes.length).toBeGreaterThanOrEqual(3);
    expect(first.boxes.filter(box => !first.goals.includes(box)).length).toBeGreaterThanOrEqual(2);
    const result = replay(first, first.solution);
    expect(result.moves).toBeGreaterThanOrEqual(25);
    expect(result.pushes).toBeGreaterThanOrEqual(9);
    let state = createState(first);
    const pushDirections = new Set<Direction>();
    for (const direction of first.solution) {
      const next = move(first, state, direction);
      if (next.pushed) pushDirections.add(direction);
      state = next.state;
    }
    expect(pushDirections.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps the increased challenge across all three campaign chapters', () => {
    const chapters = [LEVELS.slice(0, 15), LEVELS.slice(15, 30), LEVELS.slice(30)];
    for (const level of chapters[0]) {
      expect(level.boxes.length).toBeGreaterThanOrEqual(3);
      expect(level.par).toBeGreaterThanOrEqual(25);
    }
    for (const level of chapters[1]) expect(level.par).toBeGreaterThanOrEqual(60);
    for (const level of chapters[2]) {
      expect(level.boxes.length).toBeGreaterThanOrEqual(4);
      expect(level.boxes.length).toBeLessThanOrEqual(6);
      expect(level.par).toBeGreaterThanOrEqual(120);
    }
    const averages = chapters.map(chapter => chapter.reduce((sum, level) => sum + level.par, 0) / chapter.length);
    expect(averages[1]).toBeGreaterThan(averages[0] * 1.5);
    expect(averages[2]).toBeGreaterThan(averages[1] * 1.5);
  });

  for (let index = 0; index < 40; index++) {
    it(`validates and legally solves campaign level ${index + 1}`, () => {
      const level = LEVELS[index];
      expect(validateLevel(level)).toEqual([]);
      const state = replay(level, level.solution);
      expect(isWon(level, state)).toBe(true);
      expect(deadlocks(level, state)).toEqual([]);
      expect(state.moves).toBeLessThanOrEqual(level.par);
    });
  }

  it('rejects mismatched box counts, invalid player and incorrect solutions', () => {
    expect(validateLevel({ ...LEVELS[0], boxes: [] })).toContain('Box and goal counts must match and be nonzero');
    expect(validateLevel({ ...LEVELS[0], player: -1 })).toContain('Invalid player position');
    expect(validateLevel({ ...LEVELS[0], solution: [] })).toContain('Stored solution does not solve the level');
  });
});

describe('solver and UTC daily puzzles', () => {
  it('suggests the correct suffix of a precomputed solution', () => {
    const level = LEVELS[13];
    const state = replay(level, level.solution.slice(0, 3));
    const suggestion = solve(level, state);
    expect(suggestion).not.toBeNull();
    expect(isWon(level, replay(level, suggestion!, state))).toBe(true);
  });

  it('independently solves a puzzle without its stored solution', () => {
    const level = LEVELS[17];
    const solution = solve(level, createState(level), { useStoredSolution: false, timeoutMs: 5000 });
    expect(solution).not.toBeNull();
    expect(isWon(level, replay(level, solution!))).toBe(true);
  });

  it('independently resolves every published room within worker limits', () => {
    for (const level of LEVELS) {
      const solution = solve(level, createState(level), { useStoredSolution: false, maxNodes: 100_000, timeoutMs: 2500 });
      expect(solution, `Solver timed out for level ${level.id}`).not.toBeNull();
      const result = replay(level, solution!);
      expect(isWon(level, result)).toBe(true);
      // An independent solution must still require substantial pushing; merely
      // padding a stored route with walking loops cannot pass this regression.
      const minimumPushes = level.difficulty === 'easy' ? 9 : level.difficulty === 'medium' ? 14 : 24;
      expect(result.pushes, `Trivial independent solution for level ${level.id}`).toBeGreaterThanOrEqual(minimumPushes);
    }
  }, 15_000);

  it('respects a search limit and rejects an obvious deadlock', () => {
    expect(solve(LEVELS[20], createState(LEVELS[20]), { useStoredSolution: false, maxNodes: 0 })).toBeNull();
    const level = fixture(['######', '#$ @.#', '#    #', '######']);
    expect(solve(level)).toBeNull();
  });

  it('uses the UTC date, stays stable and changes on the next day', () => {
    const morning = dailyLevel(new Date('2026-10-21T00:00:00Z'));
    expect(dailyLevel(new Date('2026-10-21T23:59:59Z'))).toEqual(morning);
    expect(dailyLevel(new Date('2026-10-22T00:00:00Z')).id).not.toBe(morning.id);
    expect(validateLevel(morning)).toEqual([]);
  });

  it('preserves valid solutions through every daily rotation and reflection', () => {
    for (let day = 0; day < 320; day++) {
      expect(validateLevel(dailyLevel(new Date(Date.UTC(2026, 0, 1 + day))))).toEqual([]);
    }
  });
});
