import '@fontsource-variable/outfit';
import './style.css';
import { createState, move, isWon, deadlocks, findPath, neighbor } from './engine';
import type { Direction, Level, State } from './engine';
import { LEVELS, dailyLevel } from './levels';
import { BoardRenderer } from './renderer';
import type { Theme } from './renderer';
import { AudioManager } from './audio';
import { loadSave, saveData, resetSave, recordWin, calculateStars, getAssists, consumeJoker, consumeHint } from './storage';
import { t } from './i18n';
import type { Language } from './i18n';
import { icon } from './icons';
import type { IconName } from './icons';

type Mode = 'classic' | 'zen' | 'time' | 'daily';
type View = 'home' | 'game';
const app = document.querySelector<HTMLDivElement>('#app')!;
let save = loadSave();
let view: View = 'home';
let mode: Mode = 'classic';
let level: Level = LEVELS[0];
let state: State = createState(level);
let history: State[] = [];
let elapsed = 0;
let undos = 0;
let won = false;
let dateKey = utcDay();
let renderer: BoardRenderer;
let dialog: HTMLDialogElement | null = null;
let expired = false;
let dialogTrigger: HTMLElement | null = null;
let autoWalk = 0;
let hintId = 0;
let worker: Worker | null = null;
let workerTimer = 0;
let messageTimer = 0;
let advanceTimer = 0;
let lastTick = performance.now();
let lastSave = lastTick;
let muted = false;
const audio = new AudioManager();
const themes: Theme[] = ['warehouse', 'neon', 'garden', 'city'];
const unlockAt = [0, 5, 15, 30];
const modes: Mode[] = ['classic', 'zen', 'time', 'daily'];
const modeIcons: IconName[] = ['cube', 'leaf', 'timer', 'sun'];
const directions: Record<string, Direction> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', w: 'up', s: 'down', a: 'left', d: 'right' };
const tr = (key: string, vars?: Record<string, string | number>) => t(key, save.settings.language, vars);
const esc = (value: string | number) => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
const copyState = (s: State): State => ({ ...s, boxes: [...s.boxes] });
const sameState = (a: State, b: State) => a.player === b.player && [...a.boxes].sort((a,b)=>a-b).join(',') === [...b.boxes].sort((a,b)=>a-b).join(',');
const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2,'0')}:${Math.floor(s % 60).toString().padStart(2,'0')}`;
const campaignCount = () => LEVELS.filter(l => save.records[String(l.id)]).length;
const aids = () => getAssists(save, level.id, mode, dateKey);
function modeUnlocked() {
  if (mode === 'classic' || mode === 'daily') return save.unlocked;
  return Math.min(40, Math.max(save.unlocked, ...Object.keys(save.records).filter(k=>k.startsWith(mode+':')).map(k=>Number(k.split(':')[1])+1)));
}
const stars = (n: number) => [0, 1, 2].map(i => icon('star', i < n ? 'earned' : 'empty')).join('');
function utcDay() { return new Date().toISOString().slice(0, 10); }
function limit() { return Math.max(75, level.par * 3 + level.boxes.length * 12); }
function active() { return view === 'game' && !dialog?.open && !won && !expired && !document.hidden; }
function button(action: string, label: string, symbol?: IconName, cls = '', extra = '') {
  return `<button type="button" class="${cls}" data-action="${action}" ${extra}>${symbol ? icon(symbol) : ''}<span>${esc(label)}</span></button>`;
}
function iconButton(action: string, label: string, symbol: IconName, extra = '') {
  return `<button type="button" class="icon-button" data-action="${action}" aria-label="${esc(label)}" title="${esc(label)}" ${extra}>${icon(symbol)}</button>`;
}
function applySettings() {
  document.documentElement.lang = save.settings.language;
  document.documentElement.dataset.theme = save.settings.theme;
  document.documentElement.dataset.motion = save.settings.reducedMotion ? 'reduced' : 'full';
  audio.setMusic(save.settings.music);
  audio.setEffects(save.settings.effects);
  renderer?.setTheme(save.settings.theme);
  renderer?.setReducedMotion(save.settings.reducedMotion);
}
function persist() {
  if (view === 'game' && !won) {
    save.session = { levelId: level.id, mode, date: dateKey, state: copyState(state), history: history.map(copyState), seconds: elapsed, undos };
  }
  if (!saveData(save)) document.documentElement.dataset.storage = 'unavailable';
}
function brand() {
  return `<a class="brand" href="#" data-action="home" aria-label="BOXSHIFT"><img src="${import.meta.env.BASE_URL}icon.svg" width="37" height="37" alt=""/><span>BOXSHIFT<small>PUZZLE ADVENTURE</small></span></a>`;
}
function header() {
  return `<header class="header">${brand()}<nav class="main-nav" aria-label="${esc(tr('home.levels'))}">${button('play',tr('home.play'),'play',view === 'game' ? 'nav-button selected' : 'nav-button')}${button('levels',tr('home.levels'),'grid','nav-button')}${button('statistics',tr('home.statistics'),'trophy','nav-button')}</nav><div class="header-tools"><button type="button" class="language-button" data-action="language" aria-label="${esc(tr('settings.language'))}">${save.settings.language.toUpperCase()}</button>${iconButton('levels',tr('home.levels'),'grid','data-mobile-levels')}${iconButton('sound',tr('hud.sound'),muted ? 'muted' : 'sound')}${iconButton('settings',tr('home.settings'),'settings')}</div></header>`;
}
function boardMarkup() {
  return `<div class="board-wrap"><canvas id="board" role="img" aria-label="${esc(tr('controls.tip'))}" tabindex="0"></canvas><div class="board-floor-label"><span class="status-dot"></span>${esc(tr('themes.'+save.settings.theme))}</div></div>`;
}
function render() {
  window.clearTimeout(advanceTimer);
  autoWalk++;
  clearHint();
  if (dialog) { dialog.close(); dialog.remove(); dialog = null; }
  renderer?.destroy();
  document.body.dataset.view = view;
  applySettings();
  if (view === 'home') {
    const count = campaignCount();
    app.innerHTML = `${header()}<main class="home-layout"><section class="home-copy"><div class="edition"><span class="status-dot"></span>${esc(tr('home.eyebrow'))}</div><h1>${esc(tr('home.headline')).replace('. ','.<br>')}</h1><p class="intro">${esc(tr('home.description'))}</p><div class="home-cta">${button('start',tr('home.start'),'play','primary large')}${save.session ? button('continue',tr('home.continue'),'arrowRight','continue-button') : ''}</div><div class="progress-block"><div><span>${esc(tr('home.progress'))}</span><strong>${count}<span> / 40</span></strong></div><div class="progress-track"><i style="transform:scaleX(${count/40})"></i></div></div></section><section class="home-stage" aria-label="${esc(tr('controls.tip'))}"><div class="stage-top"><span>01 <i>/</i> 40</span>${button('help',tr('hud.help'),'help','quiet-button')}</div>${boardMarkup()}<div class="stage-caption"><span class="tiny-crate"></span><span>${esc(tr('controls.tip'))}</span></div></section><section class="mode-selector"><div class="mode-heading"><span>${esc(tr('modes.choose'))}</span><span class="line"></span><span>04</span></div><div class="mode-grid">${modes.map((m,i)=>`<button type="button" class="mode-card ${mode===m?'chosen':''}" data-action="mode" data-mode="${m}" aria-pressed="${mode===m}"><span class="mode-icon ${m}">${icon(modeIcons[i])}</span><span class="mode-text"><strong>${esc(tr('modes.'+m))}</strong><small>${esc(tr('modes.'+m+'Desc'))}</small></span>${icon('arrowRight','mode-arrow')}</button>`).join('')}</div></section></main><footer class="home-footer"><span>BOXSHIFT <i>1.0</i></span><span>${esc(tr('home.credits'))}</span>${button('statistics',tr('home.statistics'),'trophy','quiet-button mobile-stats')}${button('quick',tr('home.quick'),'lightning','quiet-button')}</footer>`;
    renderer = new BoardRenderer(document.querySelector('#board')!);
    const preview = LEVELS[Math.min(5, LEVELS.length - 1)];
    renderer.setLevel(preview, createState(preview));
    // A live scene gives the start screen the same visual language as play.
    document.querySelector('#board')!.addEventListener('click', startSelected);
  } else {
    const displayNumber=mode==='daily'?dateKey.slice(-2):String(level.id).padStart(2,'0');
    app.innerHTML = `${header()}<main class="game-layout ${mode==='zen'?'zen-mode':''}"><aside class="level-aside"><div class="level-marker">${icon(modeIcons[modes.indexOf(mode)])}<span>${esc(tr('modes.'+mode))}</span></div><div class="level-title"><span>${esc(tr('hud.level'))}</span><h1>${displayNumber}<small>${mode==='daily'?dateKey.slice(0,7):'/ 40'}</small></h1></div><h2>${esc(tr(mode==='daily'?'modes.daily':'levels.chapter'+(level.id<=15?'1':level.id<=30?'2':'3')))}</h2><span class="difficulty ${level.difficulty}"><i></i>${esc(tr('common.'+level.difficulty))}</span><p class="level-note">${esc(tr(mode==='daily'?'daily.date':'controls.tip', {date:dateKey}))}</p><div class="aside-progress"><span>${esc(tr('home.progress'))}</span><strong>${Math.round(campaignCount()/40*100)}%</strong><div class="progress-track"><i style="transform:scaleX(${campaignCount()/40})"></i></div></div>${button('levels',tr('home.levels'),'grid','secondary')}</aside><section class="game-stage"><div class="game-hud"><div class="mobile-level"><span>${esc(tr('hud.level'))}</span><b>${displayNumber}</b></div><div class="hud-cell"><span>${esc(tr('hud.moves'))}</span><strong id="moves">${state.moves}</strong></div><div class="hud-cell pushes"><span>${esc(tr('hud.pushes'))}</span><strong id="pushes">${state.pushes}</strong></div>${mode!=='zen'?`<div class="hud-cell ${mode==='time'?'time-challenge':''}"><span>${esc(tr('hud.time'))}</span><strong id="timer">${formatTime(mode==='time'?limit()-elapsed:elapsed)}</strong></div>`:''}<div class="hud-cell goals"><span>${esc(tr('hud.goals'))}</span><strong id="goals"></strong></div>${iconButton('pause',tr('hud.pause'),'pause')}</div><div class="game-board">${boardMarkup()}<div id="message" class="board-message" role="status" aria-live="polite"></div></div><div class="game-actions">${button('undo',tr('hud.undo'),'undo','tool-button','id="undo"')}${button('restart',tr('hud.restart'),'restart','tool-button')}${button('hint',tr('hud.hint'),'hint','tool-button','id="hint"')}${button('help',tr('hud.help'),'help','tool-button help-tool')}</div></section><div class="game-bottom"><span class="keyboard-caption"><kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> ${esc(tr('controls.keyboard'))}</span><span class="touch-caption">${esc(tr('controls.touch'))}</span><div class="dpad" aria-label="${esc(tr('controls.touch'))}">${(['up','left','down','right'] as Direction[]).map((d)=>`<button type="button" data-direction="${d}" aria-label="${esc(tr('directions.'+d))}" class="dpad-${d}">${icon(('arrow'+d[0].toUpperCase()+d.slice(1)) as IconName)}</button>`).join('')}<span class="dpad-center"></span></div><span class="shortcut-caption"><kbd>Z</kbd> ${esc(tr('hud.undo'))}<i></i><kbd>R</kbd> ${esc(tr('hud.restart'))}</span></div></main>`;
    renderer = new BoardRenderer(document.querySelector('#board')!);
    renderer.setLevel(level, state);
    bindBoard();
    updateHud();
  }
  applySettings();
  lastTick = performance.now();
}
function updateHud() {
  const set = (id: string,value: string|number) => { const el=document.getElementById(id); if(el)el.textContent=String(value); };
  set('moves',state.moves); set('pushes',state.pushes);
  set('timer',formatTime(mode==='time'?Math.max(0,limit()-elapsed):elapsed));
  set('goals',`${state.boxes.filter(b=>level.goals.includes(b)).length} / ${level.goals.length}`);
  const usage=won?{jokerUsed:true,hintsUsed:2}:aids();
  const undo=document.querySelector<HTMLButtonElement>('#undo');
  if(undo) {
    undo.disabled=history.length<2||usage.jokerUsed||won;
    undo.title=tr('help.undo');
    undo.innerHTML=`${icon('undo')}<span>${esc(tr('hud.undo'))}</span><small class="budget">${usage.jokerUsed?'0':'1'}</small>`;
  }
  const hint=document.querySelector<HTMLButtonElement>('#hint');
  if(hint) {
    hint.disabled=usage.hintsUsed>=2||Boolean(worker)||won;
    hint.title=tr('help.hints');
    hint.innerHTML=`${icon('hint')}<span>${esc(tr('hud.hint'))}</span><small class="budget">${2-usage.hintsUsed}</small>`;
  }
}
function clearHint() {
  hintId++;
  worker?.terminate(); worker=null;
  window.clearTimeout(workerTimer);
  renderer?.setHint(null);
  const hint=document.querySelector<HTMLButtonElement>('#hint'); if(hint)hint.disabled=won||aids().hintsUsed>=2;
}
function message(text: string, warning=false) {
  const el=document.getElementById('message'); if(!el)return;
  el.textContent=text; el.classList.toggle('warning',warning); el.classList.add('visible');
  window.clearTimeout(messageTimer);
  messageTimer=window.setTimeout(()=>el.classList.remove('visible'),6000);
}
function startLevel(next:Level, nextMode:Mode=mode, restore=false) {
  if(view==='game')persist();
  level=next; mode=nextMode; state=createState(level); history=[]; elapsed=0; undos=0; won=false; expired=false; dateKey=utcDay();
  undos=aids().jokerUsed?2:0;
  const session=save.session;
  if(restore && session && session.levelId===level.id && session.mode===mode && (mode!=='daily'||session.date===dateKey)) {
    if (validState(session.state,level) && session.history.every(s=>validState(s,level))) {
      state=copyState(session.state);history=session.history.map(copyState);elapsed=session.seconds;undos=session.undos;
    }
  }
  view='game'; render(); persist();
  void audio.unlock();
  document.querySelector<HTMLCanvasElement>('#board')?.focus({preventScroll:true});
  if(state.moves===0 && level.id<=3)message(tr(['controls.tip','controls.nopull','controls.boxes'][level.id-1]));
  if(isWon(level,state))win();
  else if(mode==='time'&&elapsed>=limit())expireTime();
}
function validState(s:State,l:Level) {
  return Number.isInteger(s.player)&&l.floor.includes(s.player)&&s.boxes.length===l.boxes.length&&new Set(s.boxes).size===s.boxes.length&&!s.boxes.includes(s.player)&&s.boxes.every(b=>l.floor.includes(b))&&s.moves>=0&&s.pushes>=0&&s.pushes<=s.moves;
}
function startSelected() { startLevel(mode==='daily'?dailyLevel():LEVELS[Math.min(modeUnlocked()-1,39)],mode); }
function continueGame() {
  const s=save.session;
  if(!s){startSelected();return;}
  startLevel(s.mode==='daily'?dailyLevel():LEVELS[Math.max(0,Math.min(s.levelId-1,39))],s.mode,true);
}
function doMove(direction:Direction, automatic=false) {
  if(!active())return;
  if(mode==='time'&&elapsed>=limit()){expireTime();return;}
  if(!automatic)autoWalk++;
  clearHint();
  const result=move(level,state,direction);
  if(!result.moved)return;
  history.push(copyState(state)); state=result.state;
  renderer.update(state,direction,result.pushed);
  if(result.pushed) {
    save.stats.pushes++;
    audio.play(level.goals.includes(result.to!)?'goal':level.goals.includes(result.from!)?'ungoal':'push');
    if(result.deadlocked)message(tr(aids().jokerUsed?'hint.deadlockedRestart':'hint.deadlockedJoker'),true);
  } else audio.play('step');
  updateHud();persist();
  if(isWon(level,state))win();
}
function undoMove() {
  if(!active())return;
  if(history.length<2){message(tr('joker.needTwo'));return;}
  if(!consumeJoker(save,level.id,mode,dateKey)){message(tr('joker.used'));return;}
  autoWalk++;clearHint();
  history.pop();state=history.pop()!;undos+=2;
  renderer.update(state);updateHud();persist();
  message(tr('joker.done'));
}
function restartLevel() {
  closeDialog(); startLevel(mode==='daily'?dailyLevel():level,mode);
}
async function hint() {
  if(!active())return;
  if(aids().hintsUsed>=2){message(tr('hint.exhausted'));return;}
  autoWalk++; clearHint();
  if(deadlocks(level,state).length){message(tr(aids().jokerUsed?'hint.deadlockedRestart':'hint.deadlockedJoker'),true);return;}
  let tracked=createState(level);
  let suffix:Direction[]|null=null;
  for(let i=0;i<=level.solution.length;i++) {
    if(sameState(tracked,state)){suffix=level.solution.slice(i);break;}
    if(i<level.solution.length)tracked=move(level,tracked,level.solution[i]).state;
  }
  const show=(solution:Direction[]|null)=>{
    if(solution?.length) {
      if(!consumeHint(save,level.id,mode,dateKey))return;
      renderer.setHint(neighbor(level,state.player,solution[0]));
      message(tr('hint.move',{direction:tr('directions.'+solution[0])}));
    } else message(tr('hint.unavailable'));
    updateHud();persist();
  };
  if(suffix?.length){show(suffix);return;}
  message(tr('hint.thinking'));
  const b=document.querySelector<HTMLButtonElement>('#hint');if(b)b.disabled=true;
  const id=hintId;
  try {
    worker=new Worker(new URL('./solver.worker.ts',import.meta.url),{type:'module'});
    worker.onmessage=(event:MessageEvent<{id:number;solution:Direction[]|null}>)=>{
      if(event.data.id!==id||hintId!==id)return;
      window.clearTimeout(workerTimer);worker?.terminate();worker=null;show(event.data.solution);
    };
    worker.onerror=()=>{if(hintId===id){clearHint();show(null);}};
    worker.postMessage({id,level,state});
    workerTimer=window.setTimeout(()=>{if(hintId===id){clearHint();show(null);}},4000);
  } catch {clearHint();show(null);}
}
function win() {
  if(won)return;
  won=true;autoWalk++;clearHint();renderer.celebrate();audio.play('win');
  const rating=calculateStars(state.moves,elapsed,level.par,mode,limit());
  const result={moves:state.moves,pushes:state.pushes,seconds:elapsed,stars:rating,undos};
  const recorded=recordWin(save,level.id,mode,result,dateKey);
  save=recorded.data;delete save.session;saveData(save);
  updateHud();
  if(mode!=='daily'&&level.id<40) {
    const board=document.querySelector('.game-board')!;
    const panel=document.createElement('div');panel.id='completion';panel.className='completion';panel.setAttribute('role','status');
    panel.innerHTML=`<span class="completion-check">${icon('check')}</span><div><strong>${esc(tr('victory.levelDone',{level:level.id}))}</strong><span class="completion-stars">${stars(rating)}</span><small>${state.moves} ${esc(tr('hud.moves').toLowerCase())} · ${formatTime(elapsed)}${recorded.newBest?' · '+esc(tr('victory.newBest')):''}</small></div>${button('next',tr('victory.autoNext',{level:level.id+1}),'arrowRight','completion-next')}`;
    board.append(panel);
    const completed=level.id;
    const advance=()=>{
      if(view!=='game'||!won||level.id!==completed)return;
      if(dialog?.open||document.hidden){advanceTimer=window.setTimeout(advance,300);return;}
      startLevel(LEVELS[completed],mode);
    };
    advanceTimer=window.setTimeout(advance,1500);
    return;
  }
  window.setTimeout(()=>{
    if(view!=='game'||!won)return;
    const end=mode==='classic'&&level.id===40;
    openDialog('win',`<div class="win-badge">${icon(end?'trophy':'check')}</div><p class="dialog-kicker">${esc(tr('modes.'+mode))}</p><h2>${esc(tr(end?'victory.campaign':'victory.title'))}</h2><div class="victory-stars">${stars(rating)}</div><p class="result-note">${esc(tr(recorded.newBest?'victory.newBest':'victory.subtitle'))}</p><div class="result-grid"><div><span>${esc(tr('hud.moves'))}</span><b>${state.moves}</b></div><div><span>${esc(tr('hud.pushes'))}</span><b>${state.pushes}</b></div><div><span>${esc(tr('hud.time'))}</span><b>${formatTime(elapsed)}</b></div></div>${recorded.newAchievements.length?`<div class="new-achievements">${icon('trophy')}${recorded.newAchievements.map(a=>esc(tr('achievements.'+a))).join(' · ')}</div>`:''}<div class="dialog-actions">${mode!=='daily'&&level.id<40?button('next',tr('victory.next'),'arrowRight','primary'):button('home',tr('hud.menu'),'home','primary')}${button('replay',tr('victory.replay'),'restart','secondary')}</div>`);
  },save.settings.reducedMotion?50:650);
}
function expireTime() {
  elapsed=limit();expired=true;autoWalk++;
  openDialog('expired',`<div class="dialog-symbol">${icon('timer')}</div><h2>${esc(tr('time.expired'))}</h2><p>${esc(tr('time.retry'))}</p><div class="dialog-actions">${button('restart',tr('hud.restart'),'restart','primary')}${button('home',tr('hud.menu'),'home','secondary')}</div>`);
}
function closeDialog() {
  if(!dialog)return;
  dialog.close();dialog.remove();dialog=null;
  renderer?.setPaused(false);lastTick=performance.now();
  dialogTrigger?.focus({preventScroll:true});dialogTrigger=null;
}
function openDialog(kind:string,html:string) {
  closeDialog();autoWalk++;clearHint();persist();
  dialogTrigger=document.activeElement as HTMLElement;
  dialog=document.createElement('dialog');dialog.className=`dialog ${kind}-dialog`;
  dialog.setAttribute('aria-label',tr(kind==='levels'?'levels.title':kind==='settings'?'home.settings':kind==='statistics'?'home.statistics':kind==='win'?'victory.title':'hud.pause'));
  dialog.innerHTML=`${iconButton('close',tr('common.close'),'close')}<div class="dialog-content">${html}</div>`;
  document.body.append(dialog);dialog.showModal();renderer?.setPaused(true);
  dialog.addEventListener('cancel',event=>{event.preventDefault();if(kind==='win'||kind==='expired'){goHome();}else closeDialog();});
  dialog.addEventListener('click',event=>{if(event.target===dialog&&kind!=='win'&&kind!=='expired')closeDialog();});
}
function showPause() {
  if(view!=='game'||won)return;
  if(dialog?.open){closeDialog();return;}
  openDialog('pause',`<div class="dialog-symbol">${icon('pause')}</div><h2>${esc(tr('paused.title'))}</h2><p>${esc(tr('paused.description'))}</p><div class="dialog-actions">${button('close',tr('paused.resume'),'play','primary')}${button('restart',tr('hud.restart'),'restart','secondary')}${button('home',tr('hud.menu'),'home','text-button')}${button('statistics',tr('home.statistics'),'trophy','text-button')}</div>`);
}
function showLevels() {
  openDialog('levels',`<div class="dialog-title"><div><span class="dialog-kicker">${esc(tr('modes.classic'))}</span><h2>${esc(tr('levels.title'))}</h2></div>${icon('grid')}</div><p>${esc(tr('levels.progress',{count:campaignCount()}))}</p>${[[1,15],[16,30],[31,40]].map(([from,to],i)=>`<section class="chapter"><h3><span>0${i+1}</span>${esc(tr('levels.chapter'+(i+1)))}</h3><div class="level-grid">${LEVELS.slice(from-1,to).map(l=>{const record=save.records[mode==='classic'||mode==='daily'?String(l.id):`${mode}:${l.id}`];const current=view==='game'&&l.id===level.id;const unlocked=l.id<=modeUnlocked()||current;return `<button type="button" data-action="level" data-level="${l.id}" ${current?'aria-current="step"':''} ${!unlocked?'disabled':''} aria-label="${esc(tr('hud.level'))} ${l.id}${!unlocked?' · '+esc(tr('common.locked')):''}" class="level-tile ${record?'complete':''} ${current||view==='home'&&l.id===modeUnlocked()?'current':''}"><b>${unlocked?String(l.id).padStart(2,'0'):icon('lock')}</b><span class="level-stars">${stars(record?.stars??0)}</span></button>`;}).join('')}</div></section>`).join('')}`);
}
function showSettings() {
  const count=campaignCount();
  openDialog('settings',`<h2>${esc(tr('home.settings'))}</h2><div class="setting-row"><label for="language">${esc(tr('settings.language'))}</label><select id="language" data-setting="language"><option value="pt" ${save.settings.language==='pt'?'selected':''}>Português</option><option value="fr" ${save.settings.language==='fr'?'selected':''}>Français</option><option value="en" ${save.settings.language==='en'?'selected':''}>English</option></select></div>${(['music','effects','reducedMotion'] as const).map(k=>`<div class="setting-row"><label for="setting-${k}">${esc(tr('settings.'+k))}</label><input type="checkbox" role="switch" id="setting-${k}" data-setting="${k}" ${save.settings[k]?'checked':''}/></div>`).join('')}<h3 class="setting-heading">${esc(tr('settings.theme'))}</h3><div class="theme-grid">${themes.map((theme,i)=>`<button type="button" class="theme-tile ${theme} ${save.settings.theme===theme?'selected':''}" data-action="theme" data-theme="${theme}" ${count<unlockAt[i]?'disabled':''}><span class="theme-preview"><span></span>${icon(count<unlockAt[i]?'lock':save.settings.theme===theme?'check':'cube')}</span><b>${esc(tr('themes.'+theme))}</b><small>${esc(count<unlockAt[i]?tr('settings.themeUnlock',{count:unlockAt[i]}):tr('common.unlocked'))}</small></button>`).join('')}</div><p class="install-note">${esc(tr('settings.install'))}</p><div class="settings-bottom"><small>${esc(tr('settings.saved'))}</small>${button('delete',tr('settings.deleteProgress'),undefined,'danger-link')}</div>`);
}
function showStatistics() {
  const count=campaignCount();
  const entries=[['stats.campaign',Math.round(count/40*100)+'%'],['stats.solved',save.stats.solved],['stats.totalPushes',save.stats.pushes],['stats.totalTime',formatTime(save.stats.seconds)],['stats.dailyCompleted',Object.keys(save.daily).length],['stats.stars',Object.entries(save.records).filter(([key])=>/^\d+$/.test(key)).reduce((s,[,r])=>s+r.stars,0)+' / 120']];
  openDialog('statistics',`<div class="dialog-title"><h2>${esc(tr('home.statistics'))}</h2>${icon('trophy')}</div><div class="stats-grid">${entries.map(([k,v])=>`<div><span>${esc(tr(String(k)))}</span><b>${v}</b></div>`).join('')}</div><h3>${esc(tr('stats.achievements'))}</h3><div class="achievement-list">${['first','perfect','master','speed','legend'].map(a=>`<div class="achievement ${save.achievements.includes(a)?'unlocked':''}"><span>${icon(save.achievements.includes(a)?'trophy':'lock')}</span><div><b>${esc(tr('achievements.'+a))}</b><small>${esc(tr('achievements.'+a+'Desc'))}</small></div>${save.achievements.includes(a)?icon('check'):''}</div>`).join('')}</div>`);
}
function showHelp() {
  openDialog('help',`<div class="dialog-symbol">${icon('hint')}</div><h2>${esc(tr('hud.help'))}</h2><div class="help-lines"><p>${esc(tr('controls.tip'))}</p><p>${esc(tr('controls.nopull'))}</p><p>${esc(tr('controls.boxes'))}</p><p>${esc(tr('controls.walk'))}</p><p>${esc(tr('help.undo'))}</p><p>${esc(tr('help.hints'))}</p><p>${esc(tr('help.timeStars'))}</p></div><div class="help-controls"><div><kbd>↑ ← ↓ →</kbd><span>W A S D</span></div><p>${esc(tr('controls.keyboard'))}</p><p>${esc(tr('controls.touch'))}</p><div class="help-shortcuts">Z · ${esc(tr('hud.undo'))}<br>R · ${esc(tr('hud.restart'))}<br>H · ${esc(tr('hud.hint'))}<br>P / Esc · ${esc(tr('hud.pause'))}<br>M · ${esc(tr('hud.sound'))}</div></div>${button('close',tr('common.close'),'check','primary')}`);
}
function goHome() {persist();closeDialog();view='home';render();}
function bindBoard() {
  const canvas=document.querySelector<HTMLCanvasElement>('#board')!;
  let pointer:{x:number;y:number;id:number}|null=null;
  canvas.addEventListener('pointerdown',e=>{if(!active())return;e.preventDefault();canvas.setPointerCapture(e.pointerId);pointer={x:e.clientX,y:e.clientY,id:e.pointerId};void audio.unlock();});
  canvas.addEventListener('pointercancel',()=>{pointer=null;});
  canvas.addEventListener('pointerup',e=>{
    if(!pointer||pointer.id!==e.pointerId)return;
    const dx=e.clientX-pointer.x,dy=e.clientY-pointer.y;pointer=null;
    if(Math.hypot(dx,dy)>23){doMove(Math.abs(dx)>Math.abs(dy)?dx>0?'right':'left':dy>0?'down':'up');return;}
    const cell=renderer.cellAt(e.clientX,e.clientY);
    if(cell===null||!active())return;
    const path=findPath(level,state,cell);
    if(!path)return;
    const token=++autoWalk;
    const walk=(i:number)=>{if(token!==autoWalk||!active()||i>=path.length)return;doMove(path[i],true);window.setTimeout(()=>walk(i+1),110);};walk(0);
  });
}
app.addEventListener('pointerdown',e=>{
  const target=(e.target as Element).closest<HTMLElement>('[data-direction]');
  if(target){e.preventDefault();void audio.unlock();doMove(target.dataset.direction as Direction);}
});
document.addEventListener('click',e=>{
  const target=(e.target as Element).closest<HTMLButtonElement>('[data-action]');
  if(!target||target.disabled)return;
  const action=target.dataset.action;
  e.preventDefault();void audio.unlock();audio.play('click');
  if(action==='home'){goHome();return;}
  if(action==='close'){if(won||expired)goHome();else closeDialog();return;}
  if(action==='play'){if(view==='home')startSelected();return;}
  if(action==='start'){startSelected();return;}
  if(action==='quick'){startLevel(LEVELS[0],'zen');return;}
  if(action==='continue'){continueGame();return;}
  if(action==='mode'){mode=target.dataset.mode as Mode;render();return;}
  if(action==='levels'){showLevels();return;}
  if(action==='level'){const l=LEVELS[Number(target.dataset.level)-1];closeDialog();startLevel(l,mode==='daily'?'classic':mode);return;}
  if(action==='settings'){showSettings();return;}
  if(action==='statistics'){showStatistics();return;}
  if(action==='help'){showHelp();return;}
  if(action==='pause'){showPause();return;}
  if(action==='restart'||action==='replay'){restartLevel();return;}
  if(action==='undo'){undoMove();return;}
  if(action==='hint'){void hint();return;}
  if(action==='next'){closeDialog();startLevel(LEVELS[Math.min(level.id,39)],mode);return;}
  if(action==='sound'){muted=!muted;audio.setMuted(muted);const b=document.querySelector('[data-action="sound"]');if(b)b.innerHTML=icon(muted?'muted':'sound');return;}
  if(action==='language'){save.settings.language=({pt:'fr',fr:'en',en:'pt'} as Record<Language,Language>)[save.settings.language];persist();if(view==='game'&&won)applySettings();else render();return;}
  if(action==='theme'){save.settings.theme=target.dataset.theme as Theme;applySettings();persist();showSettings();return;}
  if(action==='delete'){openDialog('delete',`<h2>${esc(tr('settings.deleteProgress'))}</h2><p>${esc(tr('settings.confirmDelete'))}</p><div class="dialog-actions">${button('delete-confirm',tr('common.confirm'),undefined,'danger')}${button('settings',tr('common.cancel'),undefined,'secondary')}</div>`);return;}
  if(action==='delete-confirm'){save=resetSave();closeDialog();view='home';mode='classic';won=false;render();}
});
document.addEventListener('change',e=>{
  const el=e.target as HTMLInputElement;
  if(!el.dataset.setting)return;
  if(el.dataset.setting==='language')save.settings.language=el.value as Language;
  else if(el.dataset.setting==='music')save.settings.music=el.checked;
  else if(el.dataset.setting==='effects')save.settings.effects=el.checked;
  else if(el.dataset.setting==='reducedMotion')save.settings.reducedMotion=el.checked;
  applySettings();persist();
  if(el.dataset.setting==='language'){if(!won)render();showSettings();}
});
document.addEventListener('keydown',e=>{
  if(e.altKey||e.ctrlKey||e.metaKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
  const key=e.key.length===1?e.key.toLowerCase():e.key;
  if(dialog?.open)return;
  if(directions[key]&&view==='game'){e.preventDefault();void audio.unlock();doMove(directions[key]);return;}
  if(key==='z'&&view==='game'){e.preventDefault();undoMove();}
  else if(key==='r'&&view==='game'){e.preventDefault();restartLevel();}
  else if(key==='h'&&view==='game'){e.preventDefault();void hint();}
  else if((key==='p'||key==='Escape')&&view==='game'){e.preventDefault();showPause();}
  else if(key==='m'){muted=!muted;audio.setMuted(muted);const b=document.querySelector('[data-action="sound"]');if(b)b.innerHTML=icon(muted?'muted':'sound');}
});
window.setInterval(()=>{
  const now=performance.now();const delta=Math.min((now-lastTick)/1000,1);lastTick=now;
  if(active()) {
    elapsed+=delta;save.stats.seconds+=delta;updateHud();
    if(mode==='time'&&elapsed>=limit()) {
      expireTime();
    }
  }
  if(now-lastSave>5000){persist();lastSave=now;}
},100);
document.addEventListener('visibilitychange',()=>{
  persist();
  if(document.hidden){audio.suspend();if(view==='game'&&!dialog?.open&&!won)showPause();}
  else {lastTick=performance.now();audio.resume();}
});
window.addEventListener('pagehide',persist);
render();
if('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load',()=>{navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(()=>{/* Offline remains optional if browser blocks workers. */});});
}
