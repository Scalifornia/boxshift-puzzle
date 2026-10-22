import play from '@phosphor-icons/core/assets/fill/play-fill.svg?raw';
import arrowRight from '@phosphor-icons/core/assets/regular/arrow-right.svg?raw';
import arrowLeft from '@phosphor-icons/core/assets/regular/arrow-left.svg?raw';
import arrowUp from '@phosphor-icons/core/assets/regular/arrow-up.svg?raw';
import arrowDown from '@phosphor-icons/core/assets/regular/arrow-down.svg?raw';
import undo from '@phosphor-icons/core/assets/regular/arrow-counter-clockwise.svg?raw';
import restart from '@phosphor-icons/core/assets/regular/arrows-clockwise.svg?raw';
import hint from '@phosphor-icons/core/assets/regular/lightbulb.svg?raw';
import pause from '@phosphor-icons/core/assets/fill/pause-fill.svg?raw';
import grid from '@phosphor-icons/core/assets/regular/squares-four.svg?raw';
import settings from '@phosphor-icons/core/assets/regular/sliders-horizontal.svg?raw';
import trophy from '@phosphor-icons/core/assets/regular/trophy.svg?raw';
import leaf from '@phosphor-icons/core/assets/regular/leaf.svg?raw';
import timer from '@phosphor-icons/core/assets/regular/timer.svg?raw';
import sun from '@phosphor-icons/core/assets/regular/sun-horizon.svg?raw';
import cube from '@phosphor-icons/core/assets/regular/cube.svg?raw';
import sound from '@phosphor-icons/core/assets/regular/speaker-high.svg?raw';
import muted from '@phosphor-icons/core/assets/regular/speaker-slash.svg?raw';
import close from '@phosphor-icons/core/assets/regular/x.svg?raw';
import check from '@phosphor-icons/core/assets/bold/check-bold.svg?raw';
import lock from '@phosphor-icons/core/assets/regular/lock-simple.svg?raw';
import star from '@phosphor-icons/core/assets/fill/star-fill.svg?raw';
import help from '@phosphor-icons/core/assets/regular/question.svg?raw';
import home from '@phosphor-icons/core/assets/regular/house.svg?raw';
import lightning from '@phosphor-icons/core/assets/regular/lightning.svg?raw';
import city from '@phosphor-icons/core/assets/regular/buildings.svg?raw';
import flag from '@phosphor-icons/core/assets/regular/flag-checkered.svg?raw';

const icons = { play, arrowRight, arrowLeft, arrowUp, arrowDown, undo, restart, hint, pause, grid, settings, trophy, leaf, timer, sun, cube, sound, muted, close, check, lock, star, help, home, lightning, city, flag };
export type IconName = keyof typeof icons;
export function icon(name: IconName, className = ''): string {
  return `<span class="icon ${className}" aria-hidden="true">${icons[name]}</span>`;
}
