import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { LEVELS, dailyLevel } from '../src/levels';
import { createState, move } from '../src/engine';
import type { Direction, Level } from '../src/engine';
import { freshSave, SAVE_KEY } from '../src/storage';
import type { SaveData } from '../src/storage';

const key: Record<Direction, string> = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
const action = (page: Page, name: string) => page.locator(`[data-action="${name}"]`);
const winDialog = (page: Page) => page.locator('dialog.win-dialog');
const completion = (page: Page) => page.locator('#completion');
const opposite: Record<Direction, Direction> = { up: 'down', down: 'up', left: 'right', right: 'left' };

function initialSave(): SaveData {
  const data = freshSave();
  data.settings = { language: 'pt', music: false, effects: false, reducedMotion: true, theme: 'warehouse' };
  return data;
}

async function saved(page: Page): Promise<SaveData> {
  return page.evaluate(storageKey => JSON.parse(localStorage.getItem(storageKey)!), SAVE_KEY);
}

async function solve(page: Page, level: Level) {
  for (const direction of level.solution) await page.keyboard.press(key[direction]);
  await expect(page.locator('#completion:visible, dialog.win-dialog[open]')).toBeVisible();
}

async function cellCenter(page: Page, level: Level, cell: number) {
  const rect = await page.locator('#board').boundingBox();
  if (!rect) throw new Error('The game board must be visible.');
  const tile = Math.min(rect.width / (level.width + 1.3), rect.height / (level.height + 1.65));
  return {
    x: rect.x + (rect.width - level.width * tile) / 2 + (cell % level.width + 0.5) * tile,
    y: rect.y + (rect.height - level.height * tile) / 2 - tile * 0.04 + (Math.floor(cell / level.width) + 0.5) * tile,
  };
}

test.beforeEach(async ({ context }) => {
  // Every test owns a fresh browser context. Preserve subsequent writes/reloads.
  await context.addInitScript(({ storageKey, data }) => {
    if (!['http:', 'https:'].includes(location.protocol)) return;
    if (!localStorage.getItem(storageKey)) localStorage.setItem(storageKey, JSON.stringify(data));
  }, { storageKey: SAVE_KEY, data: initialSave() });
});

test('lobby, keyboard victory and automatic next room preserve progress', async ({ page }) => {
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-view', 'home');
  await expect(page.locator('.mode-card')).toHaveCount(4);
  await action(page, 'start').click();
  await expect(page.locator('#moves')).toHaveText('0');
  const level = LEVELS[0];
  const first = move(level, createState(level), level.solution[0]);
  await page.keyboard.press(key[level.solution[0]]);
  await expect(page.locator('#moves')).toHaveText('1');
  await expect(page.locator('#pushes')).toHaveText(String(first.state.pushes));
  for (const direction of level.solution.slice(1)) await page.keyboard.press(key[direction]);
  await expect(completion(page)).toBeVisible();
  await expect(winDialog(page)).toHaveCount(0);
  expect((await saved(page)).records['1']).toMatchObject({ moves: level.solution.length, stars: 3 });
  expect((await saved(page)).unlocked).toBe(2);
  // Let the production timer advance this room without clicking the shortcut.
  await expect(page.locator('.level-title h1')).toContainText('02');
  await expect(page.locator('#moves')).toHaveText('0');
  await expect(completion(page)).toHaveCount(0);
  await action(page, 'levels').first().click();
  await expect(page.locator('[data-action="level"][data-level="2"]')).toHaveAttribute('aria-current', 'step');
  await expect(page.locator('[data-action="level"][data-level="1"]')).toHaveClass(/complete/);
  expect(pageErrors).toEqual([]);
});

test('Joker restores exactly two moves once and stays spent after restart, menu and reload', async ({ page }) => {
  await page.goto('/');
  await action(page, 'start').click();
  const level = LEVELS[0];
  await expect(action(page, 'undo')).toBeDisabled();
  await page.keyboard.press(key[level.solution[0]]);
  await expect(action(page, 'undo')).toBeDisabled();
  await page.keyboard.press(key[level.solution[1]]);
  await expect(page.locator('#moves')).toHaveText('2');
  await expect(action(page, 'undo')).toBeEnabled();
  const twoMoves = level.solution.slice(0, 2).reduce((state, direction) => move(level, state, direction).state, createState(level));
  for (const direction of level.solution.slice(2, 4)) await page.keyboard.press(key[direction]);
  await expect(page.locator('#moves')).toHaveText('4');
  await action(page, 'undo').click();
  await expect(page.locator('#moves')).toHaveText('2');
  expect((await saved(page)).session?.state).toEqual(twoMoves);
  expect((await saved(page)).session?.undos).toBe(2);
  expect((await saved(page)).assists['1']).toMatchObject({ jokerUsed: true });
  await expect(action(page, 'undo')).toBeDisabled();
  for (const direction of level.solution.slice(2, 4)) await page.keyboard.press(key[direction]);
  await expect(action(page, 'undo')).toBeDisabled();
  await action(page, 'restart').click();
  await expect(page.locator('#moves')).toHaveText('0');
  for (const direction of level.solution.slice(0, 2)) await page.keyboard.press(key[direction]);
  await expect(action(page, 'undo')).toBeDisabled();
  await action(page, 'home').click();
  await action(page, 'continue').click();
  await expect(action(page, 'undo')).toBeDisabled();
  await page.reload();
  await action(page, 'continue').click();
  await expect(action(page, 'undo')).toBeDisabled();
  await page.keyboard.press('z');
  await expect(page.locator('#moves')).toHaveText('2');
  expect((await saved(page)).assists['1']).toMatchObject({ jokerUsed: true });
});

test('two useful hints are shared across restarts and reloads for the current level', async ({ page }) => {
  await page.goto('/');
  await action(page, 'start').click();
  await action(page, 'hint').click();
  await expect.poll(async () => (await saved(page)).assists['1']?.hintsUsed).toBe(1);
  await expect(page.locator('#message')).toBeVisible();
  await expect(page.locator('#moves')).toHaveText('0');
  await action(page, 'restart').click();
  await action(page, 'hint').click();
  await expect.poll(async () => (await saved(page)).assists['1']?.hintsUsed).toBe(2);
  await expect(action(page, 'hint')).toBeDisabled();
  await page.reload();
  await action(page, 'continue').click();
  await expect(action(page, 'hint')).toBeDisabled();
  await page.keyboard.press('h');
  expect((await saved(page)).assists['1']?.hintsUsed).toBe(2);
  await solve(page, LEVELS[0]);
  expect((await saved(page)).assists['1']).toBeUndefined();
});

test('pause freezes the clock and blocks movement until resumed', async ({ page }) => {
  await page.goto('/');
  await action(page, 'start').click();
  await expect(page.locator('#timer')).not.toHaveText('00:00');
  await action(page, 'pause').click();
  await expect(page.locator('dialog.pause-dialog')).toBeVisible();
  const paused = await page.locator('#timer').textContent();
  await page.keyboard.press(key[LEVELS[0].solution[0]]);
  // A real wait verifies the runtime timer, independently of its saved value.
  await page.waitForTimeout(1_200);
  await expect(page.locator('#timer')).toHaveText(paused!);
  await expect(page.locator('#moves')).toHaveText('0');
  await page.locator('dialog.pause-dialog .primary[data-action="close"]').click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await expect(page.locator('#timer')).not.toHaveText(paused!);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#moves')).toHaveText('1');
});

test('an unfinished room restores its position, history and Joker after reload', async ({ page }) => {
  await page.goto('/');
  await action(page, 'start').click();
  for (const direction of LEVELS[0].solution.slice(0, 2)) await page.keyboard.press(key[direction]);
  const before = (await saved(page)).session;
  expect(before?.state.moves).toBe(2);
  await page.reload();
  await expect(action(page, 'continue')).toBeVisible();
  await action(page, 'continue').click();
  await expect(page.locator('#moves')).toHaveText('2');
  expect((await saved(page)).session?.state).toEqual(before?.state);
  await page.keyboard.press('z');
  await expect(page.locator('#moves')).toHaveText('0');
  expect((await saved(page)).session?.undos).toBe(2);
  expect((await saved(page)).session?.state.boxes).toEqual(LEVELS[0].boxes);
});

test('settings translate Portuguese, French and English and survive reload', async ({ page }) => {
  await page.goto('/');
  await action(page, 'settings').click();
  const names = { pt: 'Definições', fr: 'Paramètres', en: 'Settings' };
  for (const language of ['fr', 'en', 'pt'] as const) {
    await page.locator('#language').selectOption(language);
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.locator('dialog.settings-dialog h2')).toHaveText(names[language]);
    await expect(page.locator('#language')).toHaveValue(language);
    expect((await saved(page)).settings.language).toBe(language);
  }
  await page.locator('#setting-reducedMotion').uncheck();
  await page.locator('#setting-effects').check();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'pt');
  await action(page, 'settings').click();
  await expect(page.locator('#setting-reducedMotion')).not.toBeChecked();
  await expect(page.locator('#setting-effects')).toBeChecked();
});

test('Zen hides the timer and records a separate relaxed result', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="mode"][data-mode="zen"]').click();
  await action(page, 'start').click();
  await expect(page.locator('.game-layout')).toHaveClass(/zen-mode/);
  await expect(page.locator('#timer')).toHaveCount(0);
  await solve(page, LEVELS[0]);
  const data = await saved(page);
  expect(data.records['zen:1']).toMatchObject({ stars: 3, moves: LEVELS[0].solution.length });
  expect(data.records['1']).toBeUndefined();
  expect(data.unlocked).toBe(1);
});

test('time challenge counts down and stores its own completed result', async ({ page }) => {
  await page.goto('/');
  await page.locator('[data-action="mode"][data-mode="time"]').click();
  await action(page, 'start').click();
  await expect(page.locator('.time-challenge #timer')).toBeVisible();
  const start = await page.locator('#timer').textContent();
  await expect(page.locator('#timer')).not.toHaveText(start!);
  await solve(page, LEVELS[0]);
  const data = await saved(page);
  expect(data.records['time:1']).toMatchObject({ stars: 3, moves: LEVELS[0].solution.length });
  expect(data.records['1']).toBeUndefined();
});

test('an expired restored time challenge cannot bypass the retry dialog', async ({ page }) => {
  const data = initialSave();
  const level = LEVELS[0];
  data.session = {
    levelId: level.id, mode: 'time', state: createState(level), history: [], undos: 0,
    seconds: Math.max(75, level.par * 3 + level.boxes.length * 12),
  };
  // Seed before the app starts so pagehide cannot replace the fixture save.
  await page.addInitScript(({ storageKey, progress }) => {
    if (['http:', 'https:'].includes(location.protocol)) localStorage.setItem(storageKey, JSON.stringify(progress));
  }, {
    storageKey: SAVE_KEY, progress: data,
  });
  await page.goto('/');
  await action(page, 'continue').click();
  await expect(page.locator('dialog.expired-dialog')).toBeVisible();
  await expect(page.locator('#timer')).toHaveText('00:00');
  await page.keyboard.press(key[level.solution[0]]);
  await expect(page.locator('#moves')).toHaveText('0');
  await page.locator('dialog.expired-dialog [data-action="close"]').click();
  await expect(page.locator('body')).toHaveAttribute('data-view', 'home');
  await action(page, 'continue').click();
  await expect(page.locator('dialog.expired-dialog')).toBeVisible();
  await page.keyboard.press(key[level.solution[0]]);
  await expect(page.locator('#moves')).toHaveText('0');
  await page.locator('dialog.expired-dialog [data-action="restart"]').click();
  await expect(page.locator('dialog')).toHaveCount(0);
  await page.keyboard.press(key[level.solution[0]]);
  await expect(page.locator('#moves')).toHaveText('1');
});

test('daily puzzle uses the UTC date and saves completion under that day', async ({ page }) => {
  const instant = new Date('2026-10-22T23:59:00.000Z');
  const day = instant.toISOString().slice(0, 10);
  const daily = dailyLevel(instant);
  await page.clock.setFixedTime(instant);
  await page.goto('/');
  await page.locator('[data-action="mode"][data-mode="daily"]').click();
  await action(page, 'start').click();
  await expect(page.locator('.level-note')).toContainText(day);
  expect((await saved(page)).session).toMatchObject({ levelId: daily.id, date: day, mode: 'daily' });
  await solve(page, daily);
  const data = await saved(page);
  expect(Object.keys(data.daily)).toEqual([day]);
  expect(data.daily[day]).toMatchObject({ moves: daily.solution.length, stars: 3 });
  expect(data.records).toEqual({});
  await expect(winDialog(page).locator('[data-action="next"]')).toHaveCount(0);
});

test('all 40 original campaign rooms complete through real keyboard input', async ({ page }) => {
  test.setTimeout(process.env.CI ? 600_000 : 180_000);
  const pageErrors: string[] = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  await page.goto('/');
  await action(page, 'start').click();
  for (const level of LEVELS) {
    await test.step(`Solve room ${level.id}: ${level.name}`, async () => {
      await expect(page.locator('#moves')).toHaveText('0');
      await solve(page, level);
      if (level.id < 40) await completion(page).locator('[data-action="next"]').click();
      expect((await saved(page)).records[String(level.id)]).toMatchObject({ moves: level.solution.length, stars: 3 });
    });
  }
  const data = await saved(page);
  expect(Object.keys(data.records)).toHaveLength(40);
  expect(data.unlocked).toBe(40);
  expect(data.achievements).toContain('legend');
  await expect(winDialog(page).locator('[data-action="next"]')).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test('touch controls walk on tap, never push on tap, swipe and use the D-pad', async ({ page }) => {
  const walkDirection = (level: Level) => (['up', 'down', 'left', 'right'] as Direction[]).find(direction => {
    const result = move(level, createState(level), direction);
    return result.moved && !result.pushed;
  });
  const level = LEVELS.find(candidate => walkDirection(candidate))!;
  const direction = walkDirection(level)!;
  const walked = move(level, createState(level), direction).state;
  const data = initialSave();
  data.unlocked = level.id;
  await page.addInitScript(({ storageKey, progress }) => {
    if (['http:', 'https:'].includes(location.protocol)) localStorage.setItem(storageKey, JSON.stringify(progress));
  }, { storageKey: SAVE_KEY, progress: data });
  await page.goto('/');
  await action(page, 'start').click();
  const crate = await cellCenter(page, level, level.boxes[0]);
  await page.touchscreen.tap(crate.x, crate.y);
  await expect(page.locator('#moves')).toHaveText('0');
  const floor = await cellCenter(page, level, walked.player);
  await page.touchscreen.tap(floor.x, floor.y);
  await expect(page.locator('#moves')).toHaveText('1');
  await expect(page.locator('#pushes')).toHaveText('0');
  await page.locator(`[data-direction="${opposite[direction]}"]`).tap();
  await expect(page.locator('#moves')).toHaveText('2');
  const player = await cellCenter(page, level, level.player);
  const delta = { x: direction === 'left' ? -55 : direction === 'right' ? 55 : 0, y: direction === 'up' ? -55 : direction === 'down' ? 55 : 0 };
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: player.x, y: player.y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: player.x + delta.x, y: player.y + delta.y }] });
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await touch.detach();
  await expect(page.locator('#moves')).toHaveText('3');
  await expect(page.locator('#pushes')).toHaveText('0');
  await page.locator(`[data-direction="${opposite[direction]}"]`).tap();
  await expect(page.locator('#moves')).toHaveText('4');
});

test('production service worker reloads and plays with the network offline', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    if (!registration.active) throw new Error('The production worker must activate.');
  });
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(action(page, 'start')).toBeVisible();
  await action(page, 'start').click();
  await solve(page, LEVELS[0]);
  expect((await saved(page)).records['1'].moves).toBe(LEVELS[0].solution.length);
  await context.setOffline(false);
});

test('responsive lobby and game stay within the screen at six sizes', async ({ page }, testInfo) => {
  const sizes = [
    { width: 320, height: 568 }, { width: 390, height: 844 },
    { width: 844, height: 390 }, { width: 768, height: 1024 },
    { width: 1366, height: 768 }, { width: 1920, height: 1080 },
  ];
  for (const viewport of sizes) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    for (const view of ['home', 'game']) {
      if (view === 'game') await action(page, 'start').click();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, `${view} horizontal overflow at ${viewport.width}×${viewport.height}`).toBeLessThanOrEqual(1);
      for (const selector of ['#board', '.header', view === 'home' ? '.mode-grid' : '.game-actions']) {
        const box = await page.locator(selector).boundingBox();
        expect(box, `${selector} is rendered`).not.toBeNull();
        expect(box!.x, `${selector} left edge`).toBeGreaterThanOrEqual(-1);
        expect(box!.x + box!.width, `${selector} right edge`).toBeLessThanOrEqual(viewport.width + 1);
        expect(box!.width).toBeGreaterThan(0);
        expect(box!.height).toBeGreaterThan(0);
      }
      if (view === 'game' && await page.locator('.dpad').isVisible()) {
        const up = (await page.locator('.dpad-up').boundingBox())!;
        const left = (await page.locator('.dpad-left').boundingBox())!;
        const down = (await page.locator('.dpad-down').boundingBox())!;
        const right = (await page.locator('.dpad-right').boundingBox())!;
        expect(up.y, 'Up is above Down on the directional cross').toBeLessThan(down.y);
        expect(left.x).toBeLessThan(down.x);
        expect(down.x).toBeLessThan(right.x);
        expect(Math.abs(up.x + up.width / 2 - down.x - down.width / 2)).toBeLessThanOrEqual(1);
        for (const button of [up, left, down, right]) {
          expect(button.width, 'Touch controls have usable targets').toBeGreaterThanOrEqual(40);
          expect(button.height).toBeGreaterThanOrEqual(40);
        }
      }
      const screenshot = testInfo.outputPath(`${view}-${viewport.width}x${viewport.height}.png`);
      await page.screenshot({ path: screenshot, fullPage: true, animations: 'disabled' });
      await testInfo.attach(`${view} ${viewport.width}×${viewport.height}`, { path: screenshot, contentType: 'image/png' });
    }
  }
});
