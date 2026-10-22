import type { Direction, Level, State } from './engine';

export type Theme = 'warehouse' | 'neon' | 'garden' | 'city';

type Palette = {
  background: string; halo: string; foundation: string; foundationEdge: string;
  floor: string[]; seam: string; wall: string; wallLight: string; wallEdge: string;
  wallFront: string; wallMortar: string; crate: string; crateLight: string;
  crateDark: string; accent: string; goalInk: string; robot: string; robotLight: string;
  leaf: string; leafLight: string;
};

const PALETTES: Record<Theme, Palette> = {
  warehouse: {
    background: '#e9e6dc', halo: '#ffefd0', foundation: '#bbb5a2', foundationEdge: '#938b75',
    floor: ['#e8dfc9', '#e5ddc8', '#ece3ce', '#e7dfcd'], seam: '#c9c0a9',
    wall: '#81948a', wallLight: '#a1b0a1', wallEdge: '#657a70', wallFront: '#597367', wallMortar: '#6e8578',
    crate: '#c79556', crateLight: '#e2b97c', crateDark: '#8b5a30', accent: '#68ddc5', goalInk: '#2b7567',
    robot: '#4eaa9d', robotLight: '#9bd0b7', leaf: '#4a8660', leafLight: '#8cb67b',
  },
  neon: {
    background: '#172332', halo: '#276979', foundation: '#263d52', foundationEdge: '#102335',
    floor: ['#2b4356', '#293e52', '#30485c', '#2c4257'], seam: '#506f83',
    wall: '#435c70', wallLight: '#6e9aae', wallEdge: '#223e52', wallFront: '#1c3549', wallMortar: '#547d93',
    crate: '#355d74', crateLight: '#8ff1ed', crateDark: '#173c55', accent: '#70f0da', goalInk: '#9dfff0',
    robot: '#4fb3ac', robotLight: '#b5e7db', leaf: '#528c9c', leafLight: '#7bbcc8',
  },
  garden: {
    background: '#e4e8d8', halo: '#f3edbe', foundation: '#b8b296', foundationEdge: '#8f8b70',
    floor: ['#e4ddbf', '#e7e0c2', '#dfd9bb', '#e9e0c5'], seam: '#c8c2a4',
    wall: '#9ea28b', wallLight: '#c4c5a9', wallEdge: '#797e69', wallFront: '#717762', wallMortar: '#858b73',
    crate: '#a5ab91', crateLight: '#d2d5b8', crateDark: '#68765c', accent: '#8acb83', goalInk: '#456f3f',
    robot: '#5da894', robotLight: '#b6d9aa', leaf: '#4f8550', leafLight: '#a4c578',
  },
  city: {
    background: '#22213b', halo: '#6c538e', foundation: '#3a3f5b', foundationEdge: '#20283f',
    floor: ['#3b425c', '#3f4661', '#373f59', '#414763'], seam: '#697089',
    wall: '#4e5675', wallLight: '#7983a3', wallEdge: '#303c59', wallFront: '#2b3652', wallMortar: '#64708e',
    crate: '#65728a', crateLight: '#b1bed5', crateDark: '#35455f', accent: '#c4a0ff', goalInk: '#d6c0ff',
    robot: '#599aaa', robotLight: '#bee0e1', leaf: '#5b8c73', leafLight: '#a8bd87',
  },
};

type Tween = { fromX: number; fromY: number; toX: number; toY: number; start: number; duration: number };
type Particle = { x: number; y: number; vx: number; vy: number; start: number; life: number; radius: number; color: string };
const ease = (v: number) => 1 - Math.pow(1 - Math.min(1, Math.max(0, v)), 3);
const hash = (n: number) => { const v = Math.sin(n * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v); };

/** An original Canvas 2D diorama. Coordinates in this class are CSS pixels. */
export class BoardRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private level: Level | null = null;
  private state: State | null = null;
  private walls = new Set<number>();
  private floor = new Set<number>();
  private goals = new Set<number>();
  private theme: Theme = 'warehouse';
  private reducedMotion = false;
  private paused = false;
  private dead = false;
  private width = 1;
  private height = 1;
  private tile = 1;
  private originX = 0;
  private originY = 0;
  private raf = 0;
  private playerTween: Tween | null = null;
  private boxTweens = new Map<number, Tween>();
  private direction = 'down';
  private lastMove = -10000;
  private lastPush = -10000;
  private bumpUntil = 0;
  private celebrationStart = -10000;
  private hintCell: number | null = null;
  private particles: Particle[] = [];
  private resizeObserver: ResizeObserver;
  private visibilityHandler = () => {
    if (document.hidden) this.stop();
    else { this.draw(performance.now()); this.start(); }
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('O navegador não suporta Canvas 2D.');
    this.ctx = ctx;
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.resize();
    this.start();
  }

  setLevel(level: Level, state: State): void {
    this.level = level;
    this.state = this.copyState(state);
    this.walls = new Set(level.walls);
    this.floor = new Set(level.floor);
    this.goals = new Set(level.goals);
    this.playerTween = null;
    this.boxTweens.clear();
    this.particles = [];
    this.hintCell = null;
    this.celebrationStart = -10000;
    this.lastMove = -10000;
    this.lastPush = -10000;
    this.direction = 'down';
    this.layout();
    this.draw(performance.now());
    this.start();
  }

  update(state: State, direction?: Direction, pushed = false): void {
    const now = performance.now();
    const previous = this.state;
    if (!this.level || !previous) { this.state = this.copyState(state); return; }
    if (direction) this.direction = this.getDirection(direction);
    if (!pushed) this.lastPush = -10000;
    if (previous.player !== state.player) {
      const from = this.playerTween ? this.position(this.playerTween, now) : this.coords(previous.player);
      const to = this.coords(state.player);
      const adjacent = Math.abs(from.x - to.x) + Math.abs(from.y - to.y) < 1.65;
      this.playerTween = !this.reducedMotion && adjacent ? { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, start: now, duration: pushed ? 155 : 115 } : null;
      this.lastMove = now;
      this.hintCell = null;
    } else if (direction && previous.moves === state.moves) {
      this.bumpUntil = this.reducedMotion ? 0 : now + 145;
    }
    const removed = previous.boxes.filter(cell => !state.boxes.includes(cell));
    const added = state.boxes.filter(cell => !previous.boxes.includes(cell));
    const nextTweens = new Map<number, Tween>();
    for (const cell of state.boxes) {
      const oldTween = this.boxTweens.get(cell);
      if (oldTween && now < oldTween.start + oldTween.duration) nextTweens.set(cell, oldTween);
    }
    if (removed.length === 1 && added.length === 1) {
      const old = removed[0];
      const cell = added[0];
      const oldTween = this.boxTweens.get(old);
      const from = oldTween ? this.position(oldTween, now) : this.coords(old);
      const to = this.coords(cell);
      if (!this.reducedMotion && Math.abs(from.x - to.x) + Math.abs(from.y - to.y) < 1.65) {
        nextTweens.set(cell, { fromX: from.x, fromY: from.y, toX: to.x, toY: to.y, start: now, duration: 155 });
      }
      if (this.goals.has(cell)) this.spawnSparkles(to.x + .5, to.y + .44, now, 12);
    }
    this.boxTweens = nextTweens;
    if (pushed) this.lastPush = now;
    this.state = this.copyState(state);
    this.draw(now);
    this.start();
  }

  setTheme(theme: Theme): void {
    if (!(theme in PALETTES)) return;
    this.theme = theme;
    this.draw(performance.now());
  }

  setReducedMotion(value: boolean): void {
    this.reducedMotion = value;
    if (value) { this.playerTween = null; this.boxTweens.clear(); this.particles = []; this.stop(); }
    this.draw(performance.now());
    this.start();
  }

  setPaused(value: boolean): void {
    this.paused = value;
    if (value) this.stop();
    else { this.draw(performance.now()); this.start(); }
  }

  setHint(cell: number | null): void {
    this.hintCell = cell;
    this.draw(performance.now());
    this.start();
  }

  celebrate(): void {
    const now = performance.now();
    this.celebrationStart = now;
    for (const goal of this.goals) {
      const p = this.coords(goal);
      this.spawnSparkles(p.x + .5, p.y + .4, now, 15);
    }
    this.draw(now);
    this.start();
  }

  cellAt(clientX: number, clientY: number): number | null {
    if (!this.level) return null;
    const rect = this.canvas.getBoundingClientRect();
    const x = Math.floor((clientX - rect.left - this.originX) / this.tile);
    const y = Math.floor((clientY - rect.top - this.originY) / this.tile);
    if (x < 0 || y < 0 || x >= this.level.width || y >= this.level.height) return null;
    return y * this.level.width + x;
  }

  destroy(): void {
    this.dead = true;
    this.stop();
    this.resizeObserver.disconnect();
    document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private copyState(state: State): State { return { ...state, boxes: [...state.boxes] }; }

  private getDirection(direction: Direction): string {
    const value = direction as unknown;
    if (typeof value === 'string') {
      return ({ ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', U: 'up', D: 'down', L: 'left', R: 'right' } as Record<string, string>)[value] ?? value.toLowerCase();
    }
    if (typeof value === 'object' && value) {
      const d = value as { x?: number; y?: number; dx?: number; dy?: number };
      const x = d.dx ?? d.x ?? 0;
      const y = d.dy ?? d.y ?? 0;
      return x < 0 ? 'left' : x > 0 ? 'right' : y < 0 ? 'up' : 'down';
    }
    return this.direction;
  }

  private resize(): void {
    if (this.dead) return;
    const rect = this.canvas.getBoundingClientRect();
    this.width = Math.max(1, rect.width);
    this.height = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.width * dpr);
    this.canvas.height = Math.round(this.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.layout();
    this.draw(performance.now());
  }

  private layout(): void {
    if (!this.level) return;
    const padding = .65;
    this.tile = Math.max(1, Math.min(this.width / (this.level.width + padding * 2), this.height / (this.level.height + padding * 2 + .35)));
    this.originX = (this.width - this.level.width * this.tile) / 2;
    this.originY = (this.height - this.level.height * this.tile) / 2 - this.tile * .04;
  }

  private coords(cell: number): { x: number; y: number } {
    return { x: cell % (this.level?.width ?? 1), y: Math.floor(cell / (this.level?.width ?? 1)) };
  }

  private position(tween: Tween, now: number): { x: number; y: number } {
    const amount = ease((now - tween.start) / tween.duration);
    return { x: tween.fromX + (tween.toX - tween.fromX) * amount, y: tween.fromY + (tween.toY - tween.fromY) * amount };
  }

  private start(): void {
    if (this.raf || this.dead || this.paused || document.hidden || this.reducedMotion) return;
    this.raf = requestAnimationFrame(this.frame);
  }

  private stop(): void { if (this.raf) cancelAnimationFrame(this.raf); this.raf = 0; }

  private frame = (now: number): void => {
    this.raf = 0;
    if (this.dead || this.paused || document.hidden) return;
    this.draw(now);
    this.start();
  };

  private roundRect(x: number, y: number, w: number, h: number, radius: number, fill: string, stroke?: string, lineWidth = 1): void {
    const c = this.ctx;
    c.beginPath(); c.roundRect(x, y, w, h, Math.max(0, radius)); c.fillStyle = fill; c.fill();
    if (stroke) { c.strokeStyle = stroke; c.lineWidth = lineWidth; c.stroke(); }
  }

  private line(x1: number, y1: number, x2: number, y2: number, color: string, width: number): void {
    const c = this.ctx;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
  }

  private ellipse(x: number, y: number, rx: number, ry: number, fill: string): void {
    const c = this.ctx;
    c.beginPath(); c.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, Math.PI * 2); c.fillStyle = fill; c.fill();
  }

  private draw(now: number): void {
    const c = this.ctx;
    c.clearRect(0, 0, this.width, this.height);
    if (!this.level || !this.state || this.tile < 1) return;
    const palette = PALETTES[this.theme];
    const t = this.tile;
    const boardW = this.level.width * t;
    const boardH = this.level.height * t;
    c.save();
    c.translate(this.originX, this.originY);

    // Light stays behind the board so the cell boundaries remain clear.
    const halo = c.createRadialGradient(boardW * .38, boardH * .32, t, boardW * .5, boardH * .5, Math.max(boardW, boardH) * .8);
    halo.addColorStop(0, palette.halo + '60'); halo.addColorStop(1, palette.halo + '00');
    c.fillStyle = halo; c.fillRect(-t, -t, boardW + 2 * t, boardH + 2 * t);
    c.save();
    c.shadowColor = this.theme === 'neon' || this.theme === 'city' ? '#09121e80' : '#4d50372d';
    c.shadowBlur = t * .48; c.shadowOffsetY = t * .27;
    this.roundRect(-t * .14, -t * .1, boardW + t * .28, boardH + t * .34, t * .23, palette.foundationEdge);
    c.restore();
    this.roundRect(-t * .14, -t * .17, boardW + t * .28, boardH + t * .32, t * .22, palette.foundation);
    this.roundRect(-t * .1, -t * .17, boardW + t * .2, boardH + t * .2, t * .17, palette.floor[0]);

    // Every tile has restrained, deterministic texture, so the puzzle stays legible.
    for (let y = 0; y < this.level.height; y++) {
      for (let x = 0; x < this.level.width; x++) {
        const cell = y * this.level.width + x;
        const tx = x * t;
        const ty = y * t;
        if (this.floor.has(cell) || this.walls.has(cell)) {
          this.roundRect(tx + .6, ty + .6, t - 1.2, t - 1.2, t * .035, palette.floor[Math.floor(hash(cell + 42) * 4)]);
          c.strokeStyle = palette.seam + '52'; c.lineWidth = Math.max(.55, t * .009);
          c.strokeRect(tx + .7, ty + .7, t - 1.4, t - 1.4);
          if (hash(cell + 21) > .32) {
            this.line(tx + t * .17, ty + t * (.19 + hash(cell) * .6), tx + t * .34, ty + t * (.19 + hash(cell) * .6), palette.seam + '43', t * .014);
          }
          if (hash(cell + 13) > .72) this.ellipse(tx + t * .72, ty + t * .72, t * .017, t * .012, palette.seam + '72');
          if (!this.walls.has(cell)) this.drawFloorDetail(tx, ty, cell, palette);
        } else {
          this.roundRect(tx, ty, t, t, t * .035, palette.foundation);
          if (hash(cell) > .87) this.drawSmallPebble(tx + t * .5, ty + t * .5, t, palette);
        }
      }
    }

    for (const goal of this.goals) this.drawGoal(goal, now, palette);
    if (this.hintCell !== null && this.floor.has(this.hintCell)) this.drawHint(this.hintCell, now, palette);

    const player = this.playerTween && !this.reducedMotion ? this.position(this.playerTween, now) : this.coords(this.state.player);
    const objects: { sort: number; draw: () => void }[] = [];
    for (const cell of this.walls) {
      const p = this.coords(cell);
      objects.push({ sort: p.y + .5, draw: () => this.drawWall(cell, palette) });
    }
    for (const cell of this.state.boxes) {
      const tween = this.boxTweens.get(cell);
      const p = tween && !this.reducedMotion ? this.position(tween, now) : this.coords(cell);
      objects.push({ sort: p.y + .7, draw: () => this.drawCrate(p.x * t, p.y * t, cell, now, palette) });
    }
    objects.push({ sort: player.y + .72, draw: () => this.drawRobot(player.x * t, player.y * t, now, palette) });
    objects.sort((a, b) => a.sort - b.sort);
    for (const object of objects) object.draw();
    this.drawParticles(now);
    if (this.theme === 'garden') this.drawDriftingLeaves(now, palette);

    // A soft diagonal highlight adds depth without obscuring the playable cells.
    const light = c.createLinearGradient(0, 0, boardW, boardH);
    light.addColorStop(0, this.theme === 'city' ? '#bca1ff0b' : '#fff8dd0d'); light.addColorStop(.55, '#ffffff00'); light.addColorStop(1, '#47564a08');
    c.fillStyle = light; c.fillRect(0, 0, boardW, boardH);
    c.restore();
  }

  private drawFloorDetail(x: number, y: number, cell: number, p: Palette): void {
    const t = this.tile;
    if (this.theme === 'neon' && hash(cell + 81) > .42) {
      // Fine printed traces turn the floor into a quiet circuit board.
      const yy = y + t * (.22 + hash(cell + 5) * .55);
      this.line(x + t * .15, yy, x + t * .43, yy, p.accent + '24', t * .012);
      this.line(x + t * .43, yy, x + t * .55, yy - t * .12, p.accent + '24', t * .012);
      this.line(x + t * .55, yy - t * .12, x + t * .82, yy - t * .12, p.accent + '24', t * .012);
      this.ellipse(x + t * .15, yy, t * .027, t * .027, p.accent + '39');
      this.ellipse(x + t * .82, yy - t * .12, t * .018, t * .018, p.accent + '39');
    } else if (this.theme === 'city') {
      // Broken, horizontal reflections suggest rain without moving the puzzle.
      if (hash(cell + 81) > .44) {
        const yy = y + t * (.3 + hash(cell + 7) * .5);
        this.line(x + t * .2, yy, x + t * .71, yy, '#bf9dff25', t * .025);
        this.line(x + t * .31, yy + t * .07, x + t * .61, yy + t * .07, '#93d5ed1d', t * .014);
      }
      if (hash(cell + 93) > .82) this.roundRect(x + t * .12, y + t * .81, t * .76, t * .06, t * .025, '#1a2a4222');
    } else if (this.theme === 'garden' && hash(cell + 81) > .77) {
      this.line(x + t * .73, y + t * .78, x + t * .7, y + t * .7, p.leaf + '51', t * .018);
      this.line(x + t * .73, y + t * .78, x + t * .77, y + t * .69, p.leaf + '51', t * .018);
    }
  }

  private drawGoal(cell: number, now: number, p: Palette): void {
    const { x, y } = this.coords(cell);
    const t = this.tile;
    const cx = (x + .5) * t;
    const cy = (y + .52) * t;
    const occupied = this.state!.boxes.includes(cell);
    const pulse = this.reducedMotion ? .5 : (Math.sin(now * .0026 + cell) + 1) * .5;
    this.ellipse(cx, cy + t * .035, t * .3, t * .29, '#616c4916');
    this.roundRect(cx - t * .28, cy - t * .27, t * .56, t * .54, t * .15, p.accent + (occupied ? '65' : '45'), p.goalInk, Math.max(1.2, t * .025));
    const inset = t * .15;
    this.roundRect(cx - inset, cy - inset, inset * 2, inset * 2, t * .055, p.accent + (occupied ? 'aa' : '35'), p.goalInk + 'aa', Math.max(.8, t * .014));
    this.ellipse(cx, cy, t * (.05 + pulse * .012), t * (.05 + pulse * .012), occupied ? '#f0fff2' : p.goalInk);
    if (!occupied) {
      const size = t * .07;
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        this.line(cx + dx * t * .21, cy + dy * t * .21, cx + dx * (t * .21 - size), cy + dy * t * .21, p.goalInk, t * .024);
        this.line(cx + dx * t * .21, cy + dy * t * .21, cx + dx * t * .21, cy + dy * (t * .21 - size), p.goalInk, t * .024);
      }
    }
  }

  private drawWall(cell: number, p: Palette): void {
    const t = this.tile;
    const pos = this.coords(cell);
    const x = pos.x * t;
    const y = pos.y * t;
    const w = this.level!.width;
    const south = this.walls.has(cell + w) && pos.y < this.level!.height - 1;
    const east = this.walls.has(cell + 1) && pos.x < w - 1;
    const west = this.walls.has(cell - 1) && pos.x > 0;
    const north = this.walls.has(cell - w) && pos.y > 0;
    const rise = t * .21;
    if (!south) {
      const shadow = this.ctx.createLinearGradient(0, y + t * .8, 0, y + t * 1.18);
      shadow.addColorStop(0, '#354d3439'); shadow.addColorStop(1, '#354d3400');
      this.ctx.fillStyle = shadow; this.ctx.fillRect(x - t * .02, y + t * .8, t * 1.04, t * .4);
      this.roundRect(x + t * .015, y + t * .7, t * .97, t * .3, t * .045, p.wallFront);
      this.line(x + t * .04, y + t * .91, x + t * .96, y + t * .91, p.wallEdge + '8a', t * .018);
      if (hash(cell) > .25) this.line(x + t * .56, y + t * .81, x + t * .56, y + t * .99, p.wallMortar, t * .016);
    }
    const radius = t * .065;
    this.roundRect(x + (west ? 0 : t * .012), y - rise, t - (east || west ? 0 : t * .024), t, radius, p.wall, p.wallEdge, Math.max(.6, t * .012));
    const c = this.ctx;
    c.save();
    c.beginPath(); c.roundRect(x + t * .015, y - rise + t * .015, t * .97, t * .97, radius); c.clip();
    const gradient = c.createLinearGradient(x, y - rise, x + t, y + t);
    gradient.addColorStop(0, p.wallLight + '8a'); gradient.addColorStop(1, p.wall + '00');
    c.fillStyle = gradient; c.fillRect(x, y - rise, t, t);
    this.drawWallSurface(x, y - rise, cell, p);
    if (!north) this.line(x + t * .06, y - rise + t * .055, x + t * .94, y - rise + t * .055, p.wallLight, t * .024);
    if (!west) this.line(x + t * .04, y - rise + t * .1, x + t * .04, y + t * .73, p.wallLight + 'a0', t * .018);
    c.restore();
    // Sparse original set dressing lives on top of walls, away from play space.
    const decoration = hash(cell + 333);
    if (this.theme === 'garden') {
      if (decoration > .58) this.drawWallGrowth(x, y - rise, cell, p);
      if (!north && decoration > .55 && t > 19) this.drawPlant(x + t * .52, y + t * .25, t * .78, p, decoration > .7);
    } else if (this.theme === 'city') {
      if (!north && pos.y === 0 && decoration > .55 && t > 19) this.drawRooftop(x, y - rise, cell, p);
      if (!south && decoration > .35) this.line(x + t * .17, y + t * .79, x + t * .77, y + t * .79, '#bc98f2b0', t * .022);
    } else if (this.theme === 'neon') {
      if (!south) this.line(x + t * .13, y + t * .79, x + t * .86, y + t * .79, p.accent + 'a0', t * .027);
      if (!north && decoration < .3 && t > 24) this.drawBolts(x, y - rise, t, p);
    } else {
      if (!north && decoration > .72 && t > 19) this.drawPlant(x + t * .52, y + t * .25, t * .74, p, decoration > .93);
      else if (!north && decoration < .07 && t > 24) this.drawBolts(x, y - rise, t, p);
    }
  }

  private drawWallSurface(x: number, y: number, cell: number, p: Palette): void {
    const t = this.tile;
    if (this.theme === 'neon') {
      this.roundRect(x + t * .1, y + t * .11, t * .8, t * .75, t * .045, p.wallEdge + '25', p.wallLight + '4d', t * .016);
      this.line(x + t * .23, y + t * .3, x + t * .43, y + t * .3, p.accent + '73', t * .019);
      this.line(x + t * .43, y + t * .3, x + t * .57, y + t * .45, p.accent + '73', t * .019);
      this.line(x + t * .57, y + t * .45, x + t * .78, y + t * .45, p.accent + '73', t * .019);
      this.ellipse(x + t * .23, y + t * .3, t * .03, t * .03, p.accent + 'a0');
      for (let i = 0; i < 3; i++) this.line(x + t * (.25 + i * .14), y + t * .69, x + t * (.32 + i * .14), y + t * .69, p.wallLight + '8c', t * .025);
    } else if (this.theme === 'city') {
      this.roundRect(x + t * .13, y + t * .15, t * .74, t * .63, t * .035, '#1b2b485a', '#95a2c34c', t * .015);
      this.line(x + t * .5, y + t * .17, x + t * .5, y + t * .77, p.wallLight + '6a', t * .018);
      this.line(x + t * .14, y + t * .48, x + t * .86, y + t * .48, p.wallLight + '6a', t * .018);
      const glow = hash(cell + 18) > .6 ? '#ddb3ff75' : '#92c8e33d';
      this.roundRect(x + t * .2, y + t * .22, t * .2, t * .17, t * .015, glow);
      if (hash(cell + 29) > .45) this.roundRect(x + t * .59, y + t * .55, t * .19, t * .14, t * .015, glow);
    } else if (this.theme === 'garden') {
      // Offset joints read as irregular cut stone rather than warehouse brick.
      this.line(x, y + t * .43, x + t * .36, y + t * .47, p.wallMortar + 'e0', t * .026);
      this.line(x + t * .36, y + t * .47, x + t, y + t * .42, p.wallMortar + 'e0', t * .026);
      this.line(x + t * .36, y, x + t * .36, y + t * .47, p.wallMortar + 'e0', t * .024);
      this.line(x + t * .68, y + t * .45, x + t * .72, y + t, p.wallMortar + 'e0', t * .024);
      if (hash(cell + 13) > .35) this.ellipse(x + t * .17, y + t * .65, t * .075, t * .025, p.wallLight + '60');
    } else {
      this.line(x, y + t * .48, x + t, y + t * .48, p.wallMortar + 'b3', t * .015);
      this.line(x + t * .46, y, x + t * .46, y + t * .48, p.wallMortar + 'aa', t * .015);
      this.line(x + t * .73, y + t * .48, x + t * .73, y + t, p.wallMortar + 'b3', t * .015);
    }
  }

  private drawWallGrowth(x: number, y: number, cell: number, p: Palette): void {
    const t = this.tile;
    const offset = .18 + hash(cell + 9) * .53;
    this.line(x + t * offset, y + t * .08, x + t * (offset + .06), y + t * .38, p.leaf, t * .027);
    for (let i = 0; i < 3; i++) {
      const yy = y + t * (.13 + i * .08);
      this.ellipse(x + t * (offset + (i % 2 ? .09 : -.025)), yy, t * .063, t * .035, i % 2 ? p.leaf : p.leafLight);
    }
    if (hash(cell + 16) > .6) {
      this.ellipse(x + t * (offset + .1), y + t * .09, t * .04, t * .04, '#e4b7bc');
      this.ellipse(x + t * (offset + .1), y + t * .09, t * .015, t * .015, '#f7e8b5');
    }
  }

  private drawRooftop(x: number, y: number, cell: number, p: Palette): void {
    const t = this.tile;
    for (let i = 0; i < 3; i++) {
      const height = (.13 + hash(cell + i + 41) * .19) * t;
      const xx = x + t * (.18 + i * .21);
      this.roundRect(xx, y - height + t * .05, t * .18, height, t * .02, p.wallFront, p.wallEdge, t * .012);
      this.line(xx + t * .035, y - height + t * .08, xx + t * .14, y - height + t * .08, '#bba0ee9e', t * .015);
      if (i === 1) this.line(xx + t * .09, y - height + t * .04, xx + t * .09, y - height - t * .055, p.wallLight, t * .015);
    }
  }

  private drawCrate(x: number, y: number, cell: number, now: number, p: Palette): void {
    const t = this.tile;
    const c = this.ctx;
    const onGoal = this.goals.has(cell);
    const left = x + t * .14;
    const top = y + t * .095;
    const size = t * .72;
    const depth = t * .13;
    this.ellipse(x + t * .53, y + t * .84, t * .37, t * .13, '#49463431');
    if (onGoal) {
      c.save(); c.shadowColor = p.accent + '66'; c.shadowBlur = t * .22;
      this.roundRect(left + t * .02, top + t * .08, size - t * .04, size + depth - t * .02, t * .07, p.accent + '25'); c.restore();
    }
    this.roundRect(left, top + depth, size, size, t * .06, p.crateDark);
    this.roundRect(left, top, size, size, t * .055, p.crate, p.crateDark, t * .025);
    this.roundRect(left + t * .065, top + t * .065, size - t * .13, size - t * .13, t * .017, p.crateDark + '23', p.crateDark + '55', t * .018);
    this.drawCrateSurface(left, top, size, cell, p);
    this.line(left + t * .045, top + t * .035, left + size - t * .045, top + t * .035, p.crateLight + 'f0', t * .045);
    this.line(left + t * .035, top + t * .055, left + t * .035, top + size - t * .04, p.crateLight + 'aa', t * .036);
    this.line(left + t * .07, top + size + depth * .68, left + size - t * .07, top + size + depth * .68, p.crateLight + '55', t * .021);
    if (this.theme !== 'garden') {
      for (const [dx, dy] of [[.085, .085], [.635, .085], [.085, .635], [.635, .635]]) {
        this.ellipse(left + t * dx, top + t * dy, t * .018, t * .018, p.crateDark);
      }
    }
    const pulse = this.reducedMotion ? 1 : .8 + Math.sin(now * .004) * .2;
    this.roundRect(x + t * .41, top + size + t * .014, t * .18, t * .054, t * .025, onGoal ? p.accent : p.crateDark + 'b0');
    if (onGoal) {
      c.save(); c.globalAlpha = pulse; c.shadowColor = p.accent; c.shadowBlur = t * .1;
      this.line(x + t * .455, top + size + t * .038, x + t * .545, top + size + t * .038, '#dffff2', t * .014); c.restore();
      // A physical check badge keeps success visible without relying on hue.
      this.ellipse(left + size - t * .13, top + t * .14, t * .105, t * .105, p.crateDark);
      this.line(left + size - t * .184, top + t * .14, left + size - t * .145, top + t * .18, '#e9fff0', t * .027);
      this.line(left + size - t * .145, top + t * .18, left + size - t * .077, top + t * .105, '#e9fff0', t * .027);
    }
  }

  private drawCrateSurface(x: number, y: number, size: number, cell: number, p: Palette): void {
    const t = this.tile;
    if (this.theme === 'neon') {
      // A luminous core and branched traces replace the warehouse's timber X.
      this.roundRect(x + t * .23, y + t * .23, t * .26, t * .26, t * .045, p.crateDark, p.crateLight + 'ca', t * .025);
      this.roundRect(x + t * .29, y + t * .29, t * .14, t * .14, t * .025, p.accent + 'c0');
      for (const side of [-1, 1]) {
        const start = x + size * .5 + side * t * .13;
        const end = x + size * .5 + side * t * .25;
        this.line(start, y + size * .5, end, y + size * .5, p.crateLight + 'b0', t * .022);
        this.line(end, y + size * .5, end, y + size * .5 + side * t * .19, p.crateLight + 'b0', t * .022);
        this.ellipse(end, y + size * .5 + side * t * .19, t * .027, t * .027, p.accent);
        this.line(x + size * .5, y + size * .5 + side * t * .13, x + size * .5, y + size * .5 + side * t * .25, p.crateLight + '9e', t * .022);
      }
    } else if (this.theme === 'garden') {
      this.roundRect(x + t * .18, y + t * .19, t * .36, t * .35, t * .08, p.crateLight + '45', p.crateDark + '70', t * .023);
      this.line(x + t * .36, y + t * .25, x + t * .45, y + t * .36, p.crateDark + 'a0', t * .027);
      this.line(x + t * .45, y + t * .36, x + t * .36, y + t * .47, p.crateDark + 'a0', t * .027);
      this.line(x + t * .36, y + t * .47, x + t * .27, y + t * .36, p.crateDark + 'a0', t * .027);
      this.line(x + t * .27, y + t * .36, x + t * .36, y + t * .25, p.crateDark + 'a0', t * .027);
      this.line(x + t * .61, y + t * .09, x + t * .55, y + t * .17, p.crateDark + '80', t * .018);
      this.line(x + t * .55, y + t * .17, x + t * .59, y + t * .22, p.crateDark + '80', t * .018);
      for (let i = 0; i < 4; i++) this.ellipse(x + t * (.1 + i * .055), y + t * (.6 + hash(cell + i) * .035), t * .045, t * .025, i % 2 ? p.leafLight : p.leaf);
    } else if (this.theme === 'city') {
      for (const offset of [.17, .49]) {
        this.roundRect(x + t * offset, y + t * .04, t * .06, size - t * .08, t * .012, p.crateLight + '80');
        this.line(x + t * (offset + .025), y + t * .11, x + t * (offset + .025), y + size - t * .1, p.crateDark + '85', t * .014);
      }
      this.roundRect(x + t * .28, y + t * .23, t * .16, t * .24, t * .035, p.crateDark);
      this.line(x + t * .32, y + t * .31, x + t * .4, y + t * .31, p.accent, t * .025);
      this.line(x + t * .32, y + t * .38, x + t * .37, y + t * .38, p.accent + '80', t * .018);
    } else {
      // Planks and joinery remain readable at very small phone sizes.
      for (let i = 1; i < 4; i++) {
        const xx = x + size * i / 4;
        this.line(xx, y + t * .07, xx, y + size - t * .07, p.crateDark + '47', t * .015);
      }
      const brace = t * .082;
      this.line(x + t * .1, y + t * .11, x + size - t * .1, y + size - t * .1, p.crateDark + '5f', brace * 1.5);
      this.line(x + size - t * .1, y + t * .11, x + t * .1, y + size - t * .1, p.crateDark + '5f', brace * 1.5);
      this.line(x + t * .1, y + t * .09, x + size - t * .1, y + size - t * .12, p.crateLight, brace);
      this.line(x + size - t * .1, y + t * .09, x + t * .1, y + size - t * .12, p.crateLight, brace);
    }
  }

  private drawRobot(x: number, y: number, now: number, p: Palette): void {
    const t = this.tile;
    const c = this.ctx;
    const moving = !this.reducedMotion && now - this.lastMove < 175;
    const pushing = !this.reducedMotion && now - this.lastPush >= 0 && now - this.lastPush < 220;
    const effort = pushing ? 1 - (now - this.lastPush) / 220 * .35 : 0;
    const pushX = this.direction === 'left' ? -1 : this.direction === 'right' ? 1 : 0;
    const pushY = this.direction === 'up' ? -1 : this.direction === 'down' ? 1 : 0;
    const victorious = now - this.celebrationStart < 1900;
    const idle = this.reducedMotion ? 0 : Math.sin(now * .003) * t * .012;
    const stride = moving ? Math.sin((now - this.lastMove) / 155 * Math.PI * 2) * t * .04 : 0;
    const bounce = victorious && !this.reducedMotion ? Math.abs(Math.sin((now - this.celebrationStart) * .009)) * t * .1 : 0;
    let bumpX = 0; let bumpY = 0;
    if (now < this.bumpUntil) {
      const strength = Math.sin((this.bumpUntil - now) / 145 * Math.PI) * t * .055;
      bumpX = this.direction === 'left' ? -strength : this.direction === 'right' ? strength : 0;
      bumpY = this.direction === 'up' ? -strength : this.direction === 'down' ? strength : 0;
    }
    this.ellipse(x + t * .51, y + t * .83, t * (.26 - bounce / t * .25), t * .105, '#334e4530');
    c.save();
    c.translate(x + t * .5 + bumpX + pushX * t * .055 * effort, y + t * .48 + idle - bounce + bumpY + pushY * t * .035 * effort);
    if (pushing) { c.rotate(pushX * .1 * effort); c.scale(1 + effort * .035, 1 - effort * .055); }
    else if (moving) c.rotate((this.direction === 'left' ? -.035 : .035) * Math.sin((now - this.lastMove) / 175 * Math.PI));
    // Little rubber treads, ivory chassis, and a broad glass visor.
    this.roundRect(-t * .23, t * .19 + stride, t * .155, t * .18, t * .05, '#375c55');
    this.roundRect(t * .075, t * .19 - stride, t * .155, t * .18, t * .05, '#375c55');
    this.line(-t * .193, t * .31 + stride, -t * .112, t * .31 + stride, '#72978a', t * .021);
    this.line(t * .111, t * .31 - stride, t * .192, t * .31 - stride, '#72978a', t * .021);
    if (pushing) this.drawPushArms(t, p, effort);
    else {
      this.roundRect(-t * .32, t * .09, t * .11, t * .2, t * .052, p.robot, '#3e7c6e', t * .018);
      this.roundRect(t * .21, t * .09, t * .11, t * .2, t * .052, p.robot, '#3e7c6e', t * .018);
    }
    this.roundRect(-t * .245, -t * .04, t * .49, t * .34, t * .11, '#e9e6cb', '#becab0', t * .021);
    this.roundRect(-t * .21, t * .16, t * .42, t * .13, t * .055, p.robotLight);
    this.roundRect(-t * .255, -t * .27, t * .51, t * .38, t * .13, p.robot, '#3e7c6e', t * .02);
    this.roundRect(-t * .205, -t * .23, t * .41, t * .24, t * .082, '#254b45');
    this.roundRect(-t * .18, -t * .213, t * .36, t * .034, t * .016, '#76b9a533');
    this.line(-t * .18, -t * .25, t * .08, -t * .25, p.robotLight + 'bd', t * .021);
    // Antenna and chest jewel give our original courier its own silhouette.
    this.line(t * .06, -t * .28, t * .09, -t * .39, '#5c8a74', t * .027);
    this.ellipse(t * .095, -t * .405, t * .041, t * .041, p.crateLight);
    this.ellipse(t * .084, -t * .418, t * .012, t * .012, '#fff4cd');
    this.ellipse(0, t * .138, t * .042, t * .041, p.robot);
    this.ellipse(-t * .009, t * .126, t * .013, t * .012, p.accent);
    let eyeOffsetX = this.direction === 'left' ? -t * .035 : this.direction === 'right' ? t * .035 : 0;
    const eyeOffsetY = this.direction === 'up' ? -t * .025 : this.direction === 'down' ? t * .008 : 0;
    if (this.hintCell !== null) eyeOffsetX += Math.sin(now * .002) * t * .012;
    const blink = !moving && !victorious && !this.reducedMotion && (now % 5300) > 5150;
    const eyeColor = '#bcebd3';
    for (const side of [-1, 1]) {
      const ex = side * t * .082 + eyeOffsetX;
      const ey = -t * .102 + eyeOffsetY;
      if (pushing) {
        this.line(ex + side * t * .036, ey - t * .027, ex - side * t * .027, ey - t * .004, eyeColor, t * .025);
        this.roundRect(ex - t * .025, ey + t * .012, t * .05, t * .021, t * .009, eyeColor);
      } else if (victorious) {
        this.line(ex - t * .027, ey + t * .01, ex, ey - t * .019, eyeColor, t * .024);
        this.line(ex, ey - t * .019, ex + t * .027, ey + t * .01, eyeColor, t * .024);
      } else this.roundRect(ex - t * .024, ey - (blink ? t * .003 : t * .031), t * .048, blink ? t * .014 : t * .062, t * .02, eyeColor);
    }
    if (pushing) {
      this.roundRect(-t * .062, -t * .041, t * .124, t * .043, t * .013, '#e3f4cf', '#254b45', t * .011);
      this.line(-t * .048, -t * .019, t * .048, -t * .019, '#527e69', t * .008);
      this.line(-t * .018, -t * .034, -t * .018, -t * .008, '#527e69', t * .008);
      this.line(t * .019, -t * .034, t * .019, -t * .008, '#527e69', t * .008);
      const sweatY = -t * .19 + (1 - effort) * t * .1;
      this.line(t * .287, sweatY - t * .042, t * .282, sweatY, '#b5eff2', t * .026);
      this.ellipse(t * .282, sweatY, t * .024, t * .034, '#b5eff2');
      this.ellipse(t * .275, sweatY - t * .009, t * .007, t * .012, '#efffff');
    }
    else this.ellipse(eyeOffsetX * .5, -t * .031, t * .018, t * .011, '#76ba9d');
    this.ellipse(-t * .179, -t * .047, t * .026, t * .012, '#f5b98b6b');
    this.ellipse(t * .179, -t * .047, t * .026, t * .012, '#f5b98b6b');
    c.restore();
    if (this.hintCell !== null) this.drawThinking(x + t * .79, y + t * .06, now, p);
  }

  private drawPushArms(t: number, p: Palette, effort: number): void {
    const directionX = this.direction === 'left' ? -1 : this.direction === 'right' ? 1 : 0;
    const directionY = this.direction === 'up' ? -1 : 1;
    for (const side of [-1, 1]) {
      const shoulderX = side * t * .215;
      const shoulderY = t * .1;
      const handX = directionX ? directionX * t * (.48 + effort * .045) : side * t * .275;
      const handY = directionX ? t * (side < 0 ? .035 : .205) : directionY < 0 ? -t * (.37 + effort * .04) : t * (.41 + effort * .035);
      this.line(shoulderX, shoulderY, handX, handY, '#3e7c6e', t * .137);
      this.line(shoulderX, shoulderY, handX, handY, p.robot, t * .103);
      this.line(shoulderX, shoulderY - t * .024, handX, handY - t * .024, p.robotLight + 'b0', t * .026);
      this.roundRect(handX - t * .055, handY - t * .063, t * .11, t * .126, t * .033, p.robotLight, '#3e7c6e', t * .018);
    }
  }

  private drawThinking(x: number, y: number, now: number, p: Palette): void {
    const t = this.tile;
    this.ellipse(x - t * .04, y + t * .12, t * .025, t * .025, '#ffffef');
    this.roundRect(x - t * .11, y - t * .1, t * .35, t * .2, t * .09, '#ffffef', p.wallLight + '77', t * .012);
    for (let i = 0; i < 3; i++) {
      const alpha = this.reducedMotion ? 1 : .45 + .55 * (Math.sin(now * .006 - i) + 1) / 2;
      this.ctx.save(); this.ctx.globalAlpha = alpha;
      this.ellipse(x - t * .015 + i * t * .075, y, t * .019, t * .019, p.robot); this.ctx.restore();
    }
  }

  private drawHint(cell: number, now: number, p: Palette): void {
    const pos = this.coords(cell);
    const t = this.tile;
    const pulse = this.reducedMotion ? 1 : .7 + Math.sin(now * .005) * .25;
    this.ctx.save(); this.ctx.globalAlpha = pulse;
    this.roundRect(pos.x * t + t * .08, pos.y * t + t * .08, t * .84, t * .84, t * .18, p.accent + '22', p.accent, t * .035);
    this.ctx.restore();
  }

  private drawPlant(x: number, y: number, size: number, p: Palette, flower: boolean): void {
    const c = this.ctx;
    this.ellipse(x + size * .04, y + size * .27, size * .23, size * .095, '#284d2b29');
    this.roundRect(x - size * .15, y - size * .005, size * .3, size * .25, size * .05, '#b77e58');
    this.roundRect(x - size * .175, y - size * .04, size * .35, size * .095, size * .032, '#d3a575');
    this.ellipse(x, y - size * .035, size * .13, size * .035, '#63563b');
    for (let i = 0; i < 5; i++) {
      c.save(); c.translate(x, y - size * .03); c.rotate((i - 2) * .48);
      this.ellipse(0, -size * (.13 + hash(i + x) * .07), size * .065, size * .17, i % 2 ? p.leafLight : p.leaf); c.restore();
    }
    if (flower) {
      this.ellipse(x + size * .06, y - size * .24, size * .065, size * .065, '#f0c595');
      this.ellipse(x + size * .06, y - size * .24, size * .022, size * .022, '#a47a42');
    }
  }

  private drawDriftingLeaves(now: number, p: Palette): void {
    const t = this.tile;
    const c = this.ctx;
    let count = 0;
    for (const cell of this.walls) {
      const pos = this.coords(cell);
      if (pos.x !== 0 && pos.y !== 0 && pos.x !== this.level!.width - 1 && pos.y !== this.level!.height - 1) continue;
      if (hash(cell + 341) < .72) continue;
      const drift = this.reducedMotion ? 0 : Math.sin(now * .00045 + cell) * t * .08;
      c.save(); c.globalAlpha = .64;
      c.translate((pos.x + .6) * t + drift, (pos.y + .14) * t + drift * .4);
      c.rotate(hash(cell + 6) * 2 - 1 + drift / t);
      this.ellipse(0, 0, t * .07, t * .027, p.leafLight);
      this.line(-t * .05, 0, t * .05, 0, p.leaf, t * .009);
      c.restore();
      if (++count >= 5) break;
    }
  }

  private drawBolts(x: number, y: number, t: number, p: Palette): void {
    this.roundRect(x + t * .23, y + t * .18, t * .54, t * .33, t * .04, p.wallEdge + '66', p.wallLight + '55', t * .015);
    for (let i = 0; i < 3; i++) this.line(x + t * .32, y + t * (.25 + i * .07), x + t * .68, y + t * (.25 + i * .07), p.wallFront + '7a', t * .026);
  }

  private drawSmallPebble(x: number, y: number, t: number, p: Palette): void {
    this.ellipse(x, y, t * .06, t * .035, p.foundationEdge + '40');
    this.ellipse(x + t * .07, y + t * .05, t * .025, t * .018, p.foundationEdge + '35');
  }

  private spawnSparkles(x: number, y: number, now: number, count: number): void {
    if (this.reducedMotion) return;
    const p = PALETTES[this.theme];
    for (let i = 0; i < count; i++) {
      const a = i / count * Math.PI * 2 + hash(i + now) * .5;
      const speed = .35 + hash(i + 69) * .55;
      this.particles.push({ x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - .65, start: now + hash(i) * 80, life: 550 + hash(i + 4) * 400, radius: .022 + hash(i + 3) * .025, color: i % 3 ? p.accent : '#fff4b7' });
    }
  }

  private drawParticles(now: number): void {
    const t = this.tile;
    const c = this.ctx;
    this.particles = this.particles.filter(p => now - p.start < p.life);
    for (const particle of this.particles) {
      const age = now - particle.start;
      if (age < 0) continue;
      const s = age / 1000;
      const x = (particle.x + particle.vx * s) * t;
      const y = (particle.y + particle.vy * s + s * s * .6) * t;
      c.save(); c.globalAlpha = Math.max(0, 1 - age / particle.life);
      c.translate(x, y); c.rotate(age * .002);
      this.roundRect(-particle.radius * t, -particle.radius * t, particle.radius * t * 2, particle.radius * t * 2, particle.radius * t * .4, particle.color);
      c.restore();
    }
  }
}
