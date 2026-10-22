import { detectLanguage, type Language } from './i18n';

export interface Settings {
  language: Language;
  music: boolean;
  effects: boolean;
  reducedMotion: boolean;
  theme: 'warehouse' | 'neon' | 'garden' | 'city';
}

export interface RecordResult {
  moves: number;
  pushes: number;
  seconds: number;
  stars: number;
  undos: number;
}

export interface SavedState {
  player: number;
  boxes: number[];
  moves: number;
  pushes: number;
}

export interface AssistUsage { jokerUsed: boolean; hintsUsed: number }

export interface SaveData {
  version: 1;
  settings: Settings;
  unlocked: number;
  /** Classic keys are "1"…"40"; other modes use "zen:1" / "time:1". */
  records: Record<string, RecordResult>;
  daily: Record<string, RecordResult>;
  /** Budgets survive restart, returning to the menu and browser reloads. */
  assists: Record<string, AssistUsage>;
  stats: { seconds: number; pushes: number; solved: number };
  achievements: string[];
  session?: {
    levelId: number;
    mode: 'classic' | 'zen' | 'time' | 'daily';
    date?: string;
    state: SavedState;
    history: SavedState[];
    seconds: number;
    undos: number;
  };
}

// Campaign 2 changes the physical puzzles: old solved flags cannot unlock new rooms.
// Keep the old key untouched so the first campaign's progress is never overwritten.
export const SAVE_KEY = 'boxshift.save.v2';
export const LEGACY_SAVE_KEY = 'boxshift.save.v1';
const LEVEL_COUNT = 40;
const achievements = ['first', 'perfect', 'master', 'speed', 'legend'];
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined;

function number(value: unknown, fallback = 0, maximum = 1e9, integer = true): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const safe = Math.max(0, Math.min(maximum, value));
  return integer ? Math.floor(safe) : safe;
}

function validDate(value: unknown): value is string {
  if (typeof value !== 'string' || !datePattern.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00.000Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function validLevelId(value: unknown, mode: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= (mode === 'daily' ? 1e9 : LEVEL_COUNT);
}

export function freshSave(): SaveData {
  let reducedMotion = false;
  try { reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { /* Non-browser host. */ }
  return {
    version: 1,
    settings: { language: detectLanguage(), music: true, effects: true, reducedMotion, theme: 'warehouse' },
    unlocked: 1,
    records: {}, daily: {}, assists: {},
    stats: { seconds: 0, pushes: 0, solved: 0 },
    achievements: [],
  };
}

function normalizeResult(value: unknown): RecordResult | undefined {
  const result = object(value);
  if (!result || ['moves', 'pushes', 'seconds', 'stars', 'undos'].some(key => typeof result[key] !== 'number' || !Number.isFinite(result[key]))) return undefined;
  const moves = number(result.moves);
  return {
    moves,
    pushes: Math.min(moves, number(result.pushes)),
    seconds: number(result.seconds, 0, 1e9, false),
    stars: number(result.stars, 0, 3),
    undos: number(result.undos),
  };
}

function normalizeState(value: unknown): SavedState | undefined {
  const state = object(value);
  if (!state || !Number.isInteger(state.player) || (state.player as number) < 0 || (state.player as number) > 4095 || !Array.isArray(state.boxes) || state.boxes.length === 0 || state.boxes.length > 100 || typeof state.moves !== 'number' || typeof state.pushes !== 'number') return undefined;
  if (!state.boxes.every(position => Number.isInteger(position) && position >= 0 && position <= 4095)) return undefined;
  const boxes = state.boxes as number[];
  if (new Set(boxes).size !== boxes.length || boxes.includes(state.player as number)) return undefined;
  const moves = number(state.moves);
  return { player: state.player as number, boxes: [...boxes], moves, pushes: Math.min(moves, number(state.pushes)) };
}

function normalizeSave(value: unknown): SaveData {
  const base = freshSave();
  const source = object(value);
  if (!source || source.version !== 1) return base;
  const settings = object(source.settings);
  if (settings) {
    if (settings.language === 'pt' || settings.language === 'fr' || settings.language === 'en') base.settings.language = settings.language;
    for (const key of ['music', 'effects', 'reducedMotion'] as const) if (typeof settings[key] === 'boolean') base.settings[key] = settings[key];
    if (['warehouse', 'neon', 'garden', 'city'].includes(settings.theme as string)) base.settings.theme = settings.theme as Settings['theme'];
  }
  base.unlocked = Math.max(1, number(source.unlocked, 1, LEVEL_COUNT));
  for (const [key, entry] of Object.entries(object(source.records) ?? {})) {
    if (!/^(?:(?:zen|time):)?(?:[1-9]|[1-3]\d|40)$/.test(key)) continue;
    const result = normalizeResult(entry);
    if (result) base.records[key] = result;
  }
  for (const [key, entry] of Object.entries(object(source.daily) ?? {})) {
    const result = normalizeResult(entry);
    if (validDate(key) && result) base.daily[key] = result;
  }
  for (const [key, entry] of Object.entries(object(source.assists) ?? {})) {
    if (!/^(?:(?:zen|time):)?(?:[1-9]|[1-3]\d|40)$/.test(key) && !(key.startsWith('daily:') && validDate(key.slice(6)))) continue;
    const usage = object(entry);
    if (usage) base.assists[key] = { jokerUsed: usage.jokerUsed === true, hintsUsed: number(usage.hintsUsed, 0, 2) };
  }
  const stats = object(source.stats);
  if (stats) base.stats = { seconds: number(stats.seconds, 0, 1e9, false), pushes: number(stats.pushes), solved: number(stats.solved) };
  if (Array.isArray(source.achievements)) base.achievements = [...new Set(source.achievements.filter((entry): entry is string => typeof entry === 'string' && achievements.includes(entry)))];
  const session = object(source.session);
  if (session && validLevelId(session.levelId, session.mode) && ['classic', 'zen', 'time', 'daily'].includes(session.mode as string)) {
    const state = normalizeState(session.state);
    const history = Array.isArray(session.history) ? session.history.map(normalizeState) : [];
    if (state && history.every((entry): entry is SavedState => Boolean(entry)) && (session.mode !== 'daily' || validDate(session.date))) {
      base.session = {
        levelId: session.levelId as number,
        mode: session.mode as NonNullable<SaveData['session']>['mode'],
        state, history,
        seconds: number(session.seconds, 0, 1e9, false),
        undos: number(session.undos),
        ...(validDate(session.date) ? { date: session.date } : {}),
      };
    }
  }
  return base;
}

function browserStorage(): Storage | undefined {
  try { return typeof localStorage === 'undefined' ? undefined : localStorage; } catch { return undefined; }
}

export function loadSave(storage: Storage | undefined = browserStorage()): SaveData {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) return normalizeSave(JSON.parse(raw) as unknown);
    const fresh = freshSave();
    const legacy = storage?.getItem(LEGACY_SAVE_KEY);
    if (legacy) {
      const previous = normalizeSave(JSON.parse(legacy) as unknown);
      fresh.settings = previous.settings;
      fresh.stats = previous.stats;
    }
    return fresh;
  } catch { return freshSave(); }
}

/** Failure is reported to the UI; playing never depends on persistence. */
export function saveData(data: SaveData, storage: Storage | undefined = browserStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(SAVE_KEY, JSON.stringify(normalizeSave(data)));
    return true;
  } catch { return false; }
}

export function resetSave(storage: Storage | undefined = browserStorage()): SaveData {
  try { storage?.removeItem(SAVE_KEY); storage?.removeItem(LEGACY_SAVE_KEY); } catch { /* Keep the game usable when storage is denied. */ }
  return freshSave();
}

export function assistKey(levelId: number, mode: string, date?: string): string {
  return mode === 'daily' ? `daily:${date}` : mode === 'classic' ? String(levelId) : `${mode}:${levelId}`;
}

export function getAssists(data: SaveData, levelId: number, mode: string, date?: string): AssistUsage {
  return data.assists[assistKey(levelId, mode, date)] ??= { jokerUsed: false, hintsUsed: 0 };
}

export function consumeJoker(data: SaveData, levelId: number, mode: string, date?: string): boolean {
  const usage = getAssists(data, levelId, mode, date);
  if (usage.jokerUsed) return false;
  usage.jokerUsed = true;
  return true;
}

export function consumeHint(data: SaveData, levelId: number, mode: string, date?: string): boolean {
  const usage = getAssists(data, levelId, mode, date);
  if (usage.hintsUsed >= 2) return false;
  usage.hintsUsed++;
  return true;
}

/** Higher stars win; then fewer moves; then a faster time. Exact ties preserve the old record. */
function better(result: RecordResult, previous: RecordResult | undefined): boolean {
  return !previous || result.stars > previous.stars ||
    (result.stars === previous.stars && (result.moves < previous.moves ||
      (result.moves === previous.moves && result.seconds < previous.seconds)));
}

export function recordWin(data: SaveData, levelId: number, mode: string, result: RecordResult, date?: string): { data: SaveData; newBest: boolean; newAchievements: string[] } {
  const next = normalizeSave(data);
  const score = normalizeResult(result);
  if (!score || !validLevelId(levelId, mode) || !['classic', 'zen', 'time', 'daily'].includes(mode) || (mode === 'daily' && !validDate(date))) return { data: next, newBest: false, newAchievements: [] };
  const key = mode === 'daily' ? date! : mode === 'classic' ? String(levelId) : `${mode}:${levelId}`;
  const records = mode === 'daily' ? next.daily : next.records;
  const newBest = better(score, records[key]);
  if (newBest) records[key] = score;
  if (mode === 'classic') next.unlocked = Math.min(LEVEL_COUNT, Math.max(next.unlocked, levelId + 1));
  // Elapsed time and actual pushes are accumulated live, including unfinished runs.
  next.stats.solved = number(next.stats.solved + 1);
  delete next.session;
  delete next.assists[assistKey(levelId, mode, date)];
  const campaignCount = Object.keys(next.records).filter(key => /^\d+$/.test(key)).length;
  const candidates = [
    ...(next.records['1'] ? ['first'] : []),
    ...(score.undos === 0 ? ['perfect'] : []),
    ...(campaignCount >= 20 ? ['master'] : []),
    ...(mode === 'time' ? ['speed'] : []),
    ...(campaignCount >= LEVEL_COUNT ? ['legend'] : []),
  ];
  const newAchievements = candidates.filter(id => !next.achievements.includes(id));
  next.achievements.push(...newAchievements);
  return { data: next, newBest, newAchievements };
}

/** The same thresholds are explained in the localized How to Play panel. */
export function calculateStars(moves: number, seconds: number, par: number, mode: string, limit: number): number {
  const target = Math.max(1, number(par));
  const actualMoves = number(moves);
  if (mode === 'zen') return 3;
  if (mode === 'time') {
    const duration = Math.max(1, number(limit, 1, 1e9, false));
    const elapsed = number(seconds, 0, 1e9, false);
    if (elapsed > duration) return 0;
    if (elapsed <= duration * 0.55 && actualMoves <= Math.ceil(target * 1.15)) return 3;
    if (elapsed <= duration * 0.85 && actualMoves <= Math.ceil(target * 1.75)) return 2;
    return 1;
  }
  return actualMoves <= target ? 3 : actualMoves <= Math.ceil(target * 1.5) ? 2 : 1;
}
