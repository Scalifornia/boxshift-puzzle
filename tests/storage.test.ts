import { describe, expect, it } from 'vitest';
import { calculateStars, consumeHint, consumeJoker, freshSave, getAssists, LEGACY_SAVE_KEY, loadSave, recordWin, resetSave, SAVE_KEY, saveData, type RecordResult } from '../src/storage';
import { dictionary, t } from '../src/i18n';

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length(): number { return this.values.size; }
  clear(): void { this.values.clear(); }
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  key(index: number): string | null { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string): void { this.values.delete(key); }
  setItem(key: string, value: string): void { this.values.set(key, value); }
}

const result = (overrides: Partial<RecordResult> = {}): RecordResult => ({ moves: 12, pushes: 4, seconds: 15.5, stars: 3, undos: 0, ...overrides });

describe('versioned local progress', () => {
  it('round-trips settings, records and an undoable session without sharing arrays', () => {
    const storage = new MemoryStorage();
    const save = recordWin(freshSave(), 1, 'classic', result()).data;
    save.settings = { language: 'fr', music: false, effects: true, reducedMotion: true, theme: 'warehouse' };
    save.session = {
      levelId: 2, mode: 'classic', state: { player: 8, boxes: [9, 15], moves: 3, pushes: 1 },
      history: [{ player: 7, boxes: [8, 15], moves: 2, pushes: 0 }], seconds: 7.25, undos: 1,
    };
    expect(saveData(save, storage)).toBe(true);
    const loaded = loadSave(storage);
    expect(loaded).toEqual(save);
    loaded.session!.state.boxes.push(20);
    expect(loadSave(storage).session!.state.boxes).toEqual([9, 15]);
  });

  it('recovers from invalid JSON, incompatible versions and denied storage', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, '{oops');
    expect(loadSave(storage).unlocked).toBe(1);
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, unlocked: 40 }));
    expect(loadSave(storage).records).toEqual({});
    const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Full'); }, removeItem() { throw new Error('Denied'); } } as unknown as Storage;
    expect(loadSave(denied).version).toBe(1);
    expect(saveData(freshSave(), denied)).toBe(false);
    expect(resetSave(denied).unlocked).toBe(1);
  });

  it('clamps numbers and rejects malformed keys, dates and session positions', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({
      version: 1, unlocked: 200,
      settings: { language: 'xx', music: 'yes', theme: 'invalid' },
      records: { '1': result({ moves: -10, pushes: 300, stars: 99 }), '41': result(), 'zen:2': result(), 'daily:3': result(), 'time:1': { moves: 'many' } },
      daily: { '2026-02-30': result(), '2026-10-21': result() },
      stats: { pushes: -1, seconds: 1e20, solved: 2.7 },
      achievements: ['first', 'first', 'unknown'],
      session: { levelId: 1, mode: 'classic', state: { player: 5, boxes: [5], moves: 0, pushes: 0 }, history: [] },
    }));
    const loaded = loadSave(storage);
    expect(loaded.unlocked).toBe(40);
    expect(loaded.settings.theme).toBe('warehouse');
    expect(loaded.settings.music).toBe(true);
    expect(loaded.records['1']).toMatchObject({ moves: 0, pushes: 0, stars: 3 });
    expect(Object.keys(loaded.records)).toEqual(['1', 'zen:2']);
    expect(Object.keys(loaded.daily)).toEqual(['2026-10-21']);
    expect(loaded.stats).toEqual({ pushes: 0, seconds: 1e9, solved: 2 });
    expect(loaded.achievements).toEqual(['first']);
    expect(loaded.session).toBeUndefined();
  });

  it('carries legacy preferences and lifetime stats without unlocking changed puzzles or replacing old progress', () => {
    const storage = new MemoryStorage();
    const previous = freshSave();
    previous.unlocked = 40;
    previous.settings = { language: 'fr', music: false, effects: true, reducedMotion: true, theme: 'garden' };
    previous.stats = { seconds: 1200.5, pushes: 400, solved: 42 };
    previous.records = { '1': result(), '40': result(), 'zen:2': result() };
    previous.daily = { '2026-10-21': result() };
    previous.achievements = ['first', 'legend'];
    previous.assists = { '1': { jokerUsed: true, hintsUsed: 2 } };
    previous.session = {
      levelId: 40, mode: 'classic', state: { player: 8, boxes: [9], moves: 1, pushes: 0 },
      history: [{ player: 7, boxes: [9], moves: 0, pushes: 0 }], seconds: 12, undos: 0,
    };
    const raw = JSON.stringify(previous);
    storage.setItem(LEGACY_SAVE_KEY, raw);
    const migrated = loadSave(storage);
    expect(migrated.settings).toEqual(previous.settings);
    expect(migrated.stats).toEqual(previous.stats);
    expect(migrated.unlocked).toBe(1);
    expect(migrated.records).toEqual({});
    expect(migrated.daily).toEqual({});
    expect(migrated.achievements).toEqual([]);
    expect(migrated.assists).toEqual({});
    expect(migrated.session).toBeUndefined();
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(raw);
    saveData(recordWin(migrated, 1, 'classic', result()).data, storage);
    expect(loadSave(storage).unlocked).toBe(2);
    expect(Object.keys(loadSave(storage).records)).toEqual(['1']);
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBe(raw);
  });

  it('deletes both owned save keys and preserves unrelated data when progress is reset', () => {
    const storage = new MemoryStorage();
    storage.setItem('other-project', 'keep');
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(freshSave()));
    saveData(recordWin(freshSave(), 1, 'classic', result()).data, storage);
    const reset = resetSave(storage);
    expect(reset.records).toEqual({});
    expect(storage.getItem(SAVE_KEY)).toBeNull();
    expect(storage.getItem(LEGACY_SAVE_KEY)).toBeNull();
    expect(storage.getItem('other-project')).toBe('keep');
  });
});

describe('records, modes and achievements', () => {
  it('advances only Classic and isolates all mode records', () => {
    const initial = freshSave();
    const classic = recordWin(initial, 1, 'classic', result());
    expect(initial.records).toEqual({});
    expect(classic.data.unlocked).toBe(2);
    expect(classic.data.stats).toEqual({ seconds: 0, pushes: 0, solved: 1 });
    expect(classic.newAchievements).toEqual(['first', 'perfect']);
    let save = recordWin(classic.data, 2, 'zen', result()).data;
    save = recordWin(save, 2, 'time', result()).data;
    save = recordWin(save, 30, 'daily', result(), '2026-10-21').data;
    expect(save.unlocked).toBe(2);
    expect(Object.keys(save.records)).toEqual(['1', 'zen:2', 'time:2']);
    expect(save.daily['2026-10-21']).toEqual(result());
    expect(save.stats.solved).toBe(4);
    expect(save.achievements).toContain('speed');
    expect(save.achievements.filter(id => id === 'perfect')).toHaveLength(1);
  });

  it('compares stars, then moves, then elapsed time, retaining exact ties', () => {
    let save = recordWin(freshSave(), 1, 'classic', result({ stars: 2, moves: 10, seconds: 10 })).data;
    const betterStars = recordWin(save, 1, 'classic', result({ stars: 3, moves: 20, seconds: 50 }));
    expect(betterStars.newBest).toBe(true);
    save = betterStars.data;
    expect(recordWin(save, 1, 'classic', result({ stars: 2, moves: 1, seconds: 1 })).newBest).toBe(false);
    const betterMoves = recordWin(save, 1, 'classic', result({ moves: 19, seconds: 60 }));
    expect(betterMoves.newBest).toBe(true);
    const betterTime = recordWin(betterMoves.data, 1, 'classic', result({ moves: 19, seconds: 59 }));
    expect(betterTime.newBest).toBe(true);
    expect(recordWin(betterTime.data, 1, 'classic', result({ moves: 19, seconds: 59 })).newBest).toBe(false);
  });

  it('uses unique Classic rooms for campaign achievements and never unlocks room 41', () => {
    let save = freshSave();
    for (let i = 1; i <= 40; i++) save = recordWin(save, i, 'classic', result({ undos: 1 })).data;
    expect(save.unlocked).toBe(40);
    expect(save.achievements).toEqual(['first', 'master', 'legend']);
    const replay = recordWin(save, 40, 'classic', result({ undos: 1 }));
    expect(replay.newAchievements).toEqual([]);
    expect(replay.data.stats.solved).toBe(41);
  });

  it('ignores invalid wins and keeps Daily UTC date records stable', () => {
    const save = freshSave();
    expect(recordWin(save, 0, 'classic', result()).data.stats.solved).toBe(0);
    expect(recordWin(save, 41, 'classic', result()).data.unlocked).toBe(1);
    expect(recordWin(save, 1, 'daily', result(), '2026-02-30').newBest).toBe(false);
    const daily = recordWin(save, 1, 'daily', result(), '2026-10-21');
    expect(recordWin(daily.data, 1, 'daily', result({ seconds: 30 }), '2026-10-21').newBest).toBe(false);
    expect(daily.data.records).toEqual({});
    expect(daily.data.unlocked).toBe(1);
  });

  it('persists date-derived Daily IDs without treating them as campaign rooms', () => {
    const storage = new MemoryStorage();
    const save = freshSave();
    save.session = {
      levelId: 120747, mode: 'daily', date: '2026-10-21',
      state: { player: 8, boxes: [9], moves: 2, pushes: 1 },
      history: [{ player: 7, boxes: [8], moves: 1, pushes: 0 }], seconds: 7.5, undos: 0,
    };
    expect(saveData(save, storage)).toBe(true);
    expect(loadSave(storage).session).toEqual(save.session);
    const win = recordWin(loadSave(storage), 120747, 'daily', result(), '2026-10-21');
    expect(win.newBest).toBe(true);
    expect(win.data.daily['2026-10-21']).toEqual(result());
    expect(win.data.unlocked).toBe(1);
    expect(win.data.records).toEqual({});
    expect(win.data.session).toBeUndefined();
    expect(recordWin(save, 120747, 'classic', result()).newBest).toBe(false);
    expect(recordWin(save, 120747, 'zen', result()).newBest).toBe(false);
    expect(recordWin(save, 120747, 'time', result()).newBest).toBe(false);
  });
});

describe('limited assistance across attempts', () => {
  it('keeps one Joker and two hints spent across storage reloads', () => {
    const storage = new MemoryStorage();
    const data = freshSave();
    expect(consumeJoker(data, 1, 'classic')).toBe(true);
    expect(consumeJoker(data, 1, 'classic')).toBe(false);
    expect(consumeHint(data, 1, 'classic')).toBe(true);
    expect(consumeHint(data, 1, 'classic')).toBe(true);
    expect(consumeHint(data, 1, 'classic')).toBe(false);
    saveData(data, storage);
    const restored = loadSave(storage);
    expect(getAssists(restored, 1, 'classic')).toEqual({ jokerUsed: true, hintsUsed: 2 });
    expect(consumeJoker(restored, 1, 'classic')).toBe(false);
    expect(consumeHint(restored, 1, 'classic')).toBe(false);
  });

  it('isolates rooms, modes and UTC days and resets only a completed attempt', () => {
    const data = freshSave();
    consumeJoker(data, 1, 'classic');
    consumeHint(data, 1, 'classic');
    consumeHint(data, 1, 'zen');
    consumeHint(data, 1, 'time');
    consumeHint(data, 120747, 'daily', '2026-10-21');
    consumeHint(data, 120748, 'daily', '2026-10-22');
    expect(getAssists(data, 2, 'classic')).toEqual({ jokerUsed: false, hintsUsed: 0 });
    const completed = recordWin(data, 1, 'classic', result()).data;
    expect(completed.assists['1']).toBeUndefined();
    expect(completed.assists['zen:1'].hintsUsed).toBe(1);
    expect(completed.assists['time:1'].hintsUsed).toBe(1);
    expect(completed.assists['daily:2026-10-21'].hintsUsed).toBe(1);
    const daily = recordWin(completed, 120747, 'daily', result(), '2026-10-21').data;
    expect(daily.assists['daily:2026-10-21']).toBeUndefined();
    expect(daily.assists['daily:2026-10-22'].hintsUsed).toBe(1);
    expect(consumeJoker(completed, 1, 'classic')).toBe(true);
    expect(consumeHint(completed, 1, 'classic')).toBe(true);
  });

  it('clamps assistance usage and rejects impossible room and day keys', () => {
    const storage = new MemoryStorage();
    const data = freshSave();
    storage.setItem(SAVE_KEY, JSON.stringify({ ...data, assists: {
      '1': { jokerUsed: true, hintsUsed: 9 },
      'zen:2': { jokerUsed: 'yes', hintsUsed: -1 },
      '41': { jokerUsed: true, hintsUsed: 2 },
      'daily:2026-02-30': { jokerUsed: true, hintsUsed: 2 },
      'daily:2026-10-21': { jokerUsed: false, hintsUsed: 1 },
    } }));
    expect(loadSave(storage).assists).toEqual({
      '1': { jokerUsed: true, hintsUsed: 2 },
      'zen:2': { jokerUsed: false, hintsUsed: 0 },
      'daily:2026-10-21': { jokerUsed: false, hintsUsed: 1 },
    });
  });
});

describe('transparent star criteria', () => {
  it('has reproducible Classic, Zen and Time thresholds', () => {
    expect(calculateStars(10, 500, 10, 'classic', 100)).toBe(3);
    expect(calculateStars(15, 500, 10, 'classic', 100)).toBe(2);
    expect(calculateStars(16, 1, 10, 'classic', 100)).toBe(1);
    expect(calculateStars(100, 9999, 10, 'zen', 100)).toBe(3);
    expect(calculateStars(11, 55, 10, 'time', 100)).toBe(3);
    expect(calculateStars(17, 85, 10, 'time', 100)).toBe(2);
    expect(calculateStars(17, 86, 10, 'time', 100)).toBe(1);
    expect(calculateStars(1, 101, 10, 'time', 100)).toBe(0);
  });
});

describe('localization completeness', () => {
  it('ships the same keys and interpolation fields in all three languages', () => {
    expect(Object.keys(dictionary.pt).sort()).toEqual(Object.keys(dictionary.en).sort());
    expect(Object.keys(dictionary.fr).sort()).toEqual(Object.keys(dictionary.en).sort());
    for (const key of Object.keys(dictionary.en)) {
      const fields = (value: string): string[] => [...value.matchAll(/\{(\w+)\}/g)].map(match => match[1]!).sort();
      expect(fields(dictionary.pt[key]!)).toEqual(fields(dictionary.en[key]!));
      expect(fields(dictionary.fr[key]!)).toEqual(fields(dictionary.en[key]!));
    }
    expect(t('levels.progress', 'pt', { count: 3 })).toBe('3 de 40 concluídos');
    expect(t('daily.date', 'fr', { date: '21/10' })).toBe('Puzzle du 21/10');
  });
});
