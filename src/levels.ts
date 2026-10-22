import type { Direction, Level } from './engine';

/** Original BOXSHIFT rooms, curated for the more demanding second campaign.
 * New rooms were constructed by reversing legal pushes from solved boards,
 * then independently solved with push-space A* without consulting those routes.
 * Every encoded route is replayed by the validation suite. U/D/L/R include
 * walking between pushes; they are reference routes, not minimum-move claims.
 * No external level pack or runtime random generation is used. */
type Blueprint = { name: string; rows: string[]; solution: string; inspired?: boolean };
const blueprints: Blueprint[] = [
  {
    "name": "Primeira manobra",
    "rows": [
      "#######",
      "#.#   #",
      "#    .#",
      "#. $@ #",
      "#     #",
      "# $$  #",
      "#     #",
      "#######"
    ],
    "solution": "DLURULLDLUDDDDRUURULDDDRUUULURR"
  },
  {
    "name": "Três entregas",
    "rows": [
      "########",
      "#      #",
      "#.   $ #",
      "#*.# $ #",
      "#@     #",
      "########"
    ],
    "solution": "RRRRRUULLLULDRRDDRURULLLL"
  },
  {
    "name": "Três rumos",
    "rows": [
      "########",
      "#      #",
      "#  $  .#",
      "#   $  #",
      "#     ##",
      "#. @$ .#",
      "########"
    ],
    "solution": "UULUURDDURRDDLULURRDDLLULDRDLRRR"
  },
  {
    "name": "Quatro braços",
    "rows": [
      "#########",
      "#### ####",
      "####*####",
      "##.   ###",
      "#@$  $. #",
      "### $ ###",
      "### #####",
      "###.#####",
      "#########"
    ],
    "solution": "RURRDRDLUULLDRURRDDLURULLDDD",
    "inspired": true
  },
  {
    "name": "Volta ao pilar",
    "rows": [
      "########",
      "#.     #",
      "#      #",
      "#. # $@#",
      "#  #  .#",
      "#  $ $ #",
      "#      #",
      "########"
    ],
    "solution": "DLUURULLLLDRRDDDLLDLUUDDRRRRULUR"
  },
  {
    "name": "Pátio cruzado",
    "rows": [
      "#########",
      "###   ###",
      "###  $###",
      "# .     #",
      "#     $ #",
      "#.    $@#",
      "###  .###",
      "###   ###",
      "#########"
    ],
    "solution": "LRUULLLUURDLDDRDRRUULLLLRRRDRDLLLLL",
    "inspired": true
  },
  {
    "name": "Ponto de encontro",
    "rows": [
      "#########",
      "#   .   #",
      "#  $$  ##",
      "#  $@   #",
      "#  #    #",
      "#.      #",
      "##    . #",
      "#########"
    ],
    "solution": "ULULDDRURDLLDURRDRDDLLULUURRDDLDRR"
  },
  {
    "name": "Espaço de manobra",
    "rows": [
      "#######",
      "#. .# #",
      "#     #",
      "#     #",
      "#  $$ #",
      "#  $@ #",
      "##.   #",
      "#######"
    ],
    "solution": "UURULDLUDRDLULLDDRUURULDLUDDRRDRDL"
  },
  {
    "name": "O pilar",
    "rows": [
      "#######",
      "# @   #",
      "# $$$ #",
      "#  # .#",
      "#     #",
      "# .  .#",
      "#######"
    ],
    "solution": "DURRDULLDRRURDLLLDURRDULLDDUURRDDLDR"
  },
  {
    "name": "Porta entreaberta",
    "rows": [
      "#########",
      "#       #",
      "#.    $ #",
      "#  #   ##",
      "#   #$  #",
      "#    $@ #",
      "#  .  . #",
      "#########"
    ],
    "solution": "UULUURRDLLLLLRRDRRDDLRUULDDLDLLUURDRDR"
  },
  {
    "name": "Atrás da parede",
    "rows": [
      "########",
      "###  ..#",
      "# $    #",
      "#. ##  #",
      "#  $@$ #",
      "#      #",
      "########"
    ],
    "solution": "DLLUULURRRURRDDLULURDDRDDLLULLDLUDRRRRUUU"
  },
  {
    "name": "Dois caminhos",
    "rows": [
      "########",
      "#.    .#",
      "#  # $ #",
      "#  #$$ #",
      "#  .@  #",
      "########"
    ],
    "solution": "LLUUURRDRULLLDDDRRRRUUDDLLUURULLLRRDRDRDLL"
  },
  {
    "name": "Última lição",
    "rows": [
      "########",
      "#.     #",
      "# #  $ #",
      "#  . $@#",
      "# $  ###",
      "#    . #",
      "########"
    ],
    "solution": "ULULLDDRURULLLRDRRRDLULDLDDLURURDLLLURDDRR"
  },
  {
    "name": "Desvio obrigatório",
    "rows": [
      "########",
      "# . .# #",
      "#.  #  #",
      "#  $@$ #",
      "#  $   #",
      "#      #",
      "########"
    ],
    "solution": "LULLDDRURRDRRULDDLLULULUURRDLDDRUULURDDDRRULLDLUU"
  },
  {
    "name": "Caminho de regresso",
    "rows": [
      "#########",
      "#  .    #",
      "#  #  $ #",
      "#   # # #",
      "# $$  . #",
      "##@   . #",
      "#########"
    ],
    "solution": "RRURRRUULRDDLLUULULLDDRDRRUURULLDRDDLLULLDRRRRLLLDRRR"
  },
  {
    "name": "A galeria",
    "rows": [
      "##########",
      "#   @    #",
      "#  #$ .  #",
      "# $# $#  #",
      "#     #. #",
      "#       .#",
      "##########"
    ],
    "solution": "DULLDDUURRDDURRRDDDLLUULURRURDDUULLLLLDDDRRDRUULURDDLLLLDRRRRRR"
  },
  {
    "name": "Três passagens",
    "rows": [
      "#########",
      "#    .  #",
      "# # # $ #",
      "#@$     #",
      "# $ # # #",
      "#     ..#",
      "#########"
    ],
    "solution": "UURRDDRRRURULDDLDDLLLLUURLUURRDDLDLDRRRRUULLDLDRUURRDDRLUULLDDRR"
  },
  {
    "name": "Estação de troca",
    "rows": [
      "##########",
      "#  . #   #",
      "#.       #",
      "#  #.  $ #",
      "#   $@#  #",
      "# $  $   #",
      "####    .#",
      "##########"
    ],
    "solution": "UURRRDDLURULLLLLULLDDRULURDDDRDRUURULLLDDLDRRURURRRDDDLLLUURDLDRRR"
  },
  {
    "name": "Jardim secreto",
    "rows": [
      "#########",
      "##@   . #",
      "# $   . #",
      "#  # #  #",
      "# $     #",
      "# $  #. #",
      "##      #",
      "#########"
    ],
    "solution": "DLDDRULURRURRDRDDLLUULURRDLLLDDRDRUUDLLUURRRLDDDDLLULURRRRLDDRRURUULD"
  },
  {
    "name": "Encruzilhada",
    "rows": [
      "#########",
      "## .   ##",
      "#  $    #",
      "#  # # .#",
      "#.      #",
      "#. #$$$ #",
      "##  @  ##",
      "#########"
    ],
    "solution": "LLUUUURLDDRRUURULDDDLLDDRRUDLLUUUURRRRDDLLLLULDRDDRRRULUUURRDDLLLLDDRRRRULURDRU"
  },
  {
    "name": "Entrelaçado",
    "rows": [
      "###########",
      "#  ..     #",
      "# $#   #  #",
      "#     # $ #",
      "# #   @$  #",
      "#.   ##   #",
      "#.*#    $ #",
      "#         #",
      "###########"
    ],
    "solution": "LULLLULURDDRDDRDRRRURUUURULLLLRRRDDDLLLLULDRDLLRUULLDDRRRDDRRRRUURULLLLLULDRDLL"
  },
  {
    "name": "O corredor rubro",
    "rows": [
      "#########",
      "#####   #",
      "#####   #",
      "#  $@$  #",
      "# . $   #",
      "## ##   #",
      "##.  .  #",
      "####    #",
      "#########"
    ],
    "solution": "LDLLURRDLDDRRRUURUULDDRDDLLLLUUURRLDLDDRRRRUULLRRUULDLDLULDURRRRDLLULLDDUURRDLRRD",
    "inspired": true
  },
  {
    "name": "Duas câmaras",
    "rows": [
      "##########",
      "#  .##   #",
      "#   $@$$ #",
      "#.  $    #",
      "#   ##   #",
      "#.  .    #",
      "##########"
    ],
    "solution": "LRDRDDLLLUUURRDRRRUULLDURDLLDLULDURRRDURRDLLLLLLRDURRRRDDLLLLUURRRDULLLDDLUURRRRDRDLL"
  },
  {
    "name": "O intercâmbio",
    "rows": [
      "##########",
      "##.      #",
      "#  . $ . #",
      "#. ## #  #",
      "#   $@   #",
      "# #$$##  #",
      "#       ##",
      "##########"
    ],
    "solution": "UURULLLDLDDRRRRLUURRDRDDLUURULLLLRDDLLLLDDRRUDRRRRUULLLLLRDDLLUUDDRRRULURRRLLDDRRRUUU"
  },
  {
    "name": "Manobra delicada",
    "rows": [
      "##########",
      "#    #.  #",
      "#. $   ..#",
      "# ##     #",
      "#    $## #",
      "# $  $   #",
      "#   #@$. #",
      "##########"
    ],
    "solution": "RURRUUULLLLULLDRRRDRUDLLDDLDLURULDLUUDDRRRRUULURRDLDDRLUURRRDDDLRUUULLLDDRRDRUUUDDLLLDR"
  },
  {
    "name": "Passo em falso",
    "rows": [
      "#########",
      "#      .#",
      "# $ #  .#",
      "#.# # . #",
      "# #     #",
      "# $ $ $@#",
      "###   ###",
      "#########"
    ],
    "solution": "ULLLLDRULUUULLDDDDRLUUUURRDLULDRRDDRDDLUUUULURRRRDDDLLDDRULURURRDDLUULURDDLLDDRULURDRU"
  },
  {
    "name": "Horizonte",
    "rows": [
      "##########",
      "#.       #",
      "# $#.$#$ #",
      "#        #",
      "# #$ #   #",
      "#@$    #.#",
      "#      ..#",
      "#  #     #",
      "##########"
    ],
    "solution": "UURUDRRUULLRRRDURRDRDDLLULRDDLLUURUURRDDLLLLDURRRDRURDULLLLDLDUULLDDRRRRLUURRDDLLLLDRURRDRULLLDRURRDRDLLLURR"
  },
  {
    "name": "Rotas entrelaçadas",
    "rows": [
      "##########",
      "#   .    #",
      "##       #",
      "#   ###. #",
      "# $     .#",
      "# @   # .#",
      "# #$ #   #",
      "# $ $#   #",
      "##     ###",
      "##########"
    ],
    "solution": "URRRRRDDDLDLLLUURUULLLURDRUULURDDDRDDLULURRRRLDLDLDDRRRUURUULLDLLLLDDRDRUUULURRRRRLLLLUURRRRRDDLDDDLDLLUUULURRRR"
  },
  {
    "name": "Pavilhão noturno",
    "rows": [
      "###########",
      "#         #",
      "#.$#    . #",
      "#    @##..#",
      "# $##$    #",
      "#  $   #  #",
      "#         #",
      "###########"
    ],
    "solution": "UULLLDURRDDLLRRURRRRDDDDLLLLLLULUUDDRULURRLDDRDRRUUUDRRRUUULLLLDRRRURDULLLLLLDDRRLLDDDRRRUUULURRRLLDDDDLLURRDRULURRRDRU"
  },
  {
    "name": "As quatro chaves",
    "rows": [
      "##########",
      "#        #",
      "# #$@ # .#",
      "#   $# . #",
      "# $#..   #",
      "# $   #  #",
      "#        #",
      "##########"
    ],
    "solution": "ULDRDUULLLDDDDRRLLUURDLDDRRURDLLLUUUUURRDRDDUUULLLDDRRLDLDDRRRRUDLLURURLDDLLLURDRRUURRRDRUUDDDLLLLLLURDRRUDLLURURRURUULLDLDUURRRDDRDDLUDDLLU"
  },
  {
    "name": "Seis destinos",
    "rows": [
      "##########",
      "#.   .   #",
      "#     .. #",
      "# ##. ## #",
      "# $      #",
      "# $@     #",
      "# $$ #   #",
      "# $  $ ###",
      "#   .    #",
      "##########"
    ],
    "solution": "ULRDRDDDLLLUUUUUUDDDRRLLDDDRRURUUUUULURDDDDDDLUULURDRUUDLLLUURRRRRLDDDLLLLDRURRDDLUULURDRUUDLLLUURRRRDDDLDDDLLUUULURRDRUDRRDDLDLLUURD"
  },
  {
    "name": "Circuito fechado",
    "rows": [
      "#########",
      "#   .   #",
      "#   $ $ #",
      "#    $# #",
      "#  $ @# #",
      "# .  $  #",
      "#  .  $ #",
      "#. #    #",
      "# ..  # #",
      "#########"
    ],
    "solution": "LUURURRDLLLDLLUURDRDLULDURRRDLLLDURDLDURDRDDRRRUULLRRUUULLDDLDUUURRRDDDLLLRRRDLULULLLDDUURRDLRDLLRUULLDDRRURRRDLLUULLLDDRDULUURRDRDDRDL"
  },
  {
    "name": "A ordem das entregas",
    "rows": [
      "###########",
      "#     . ..#",
      "##       ##",
      "# $$$$  # #",
      "# $ @     #",
      "# $ #     #",
      "#   . #   #",
      "#     .  .#",
      "###########"
    ],
    "solution": "LUULURRRRRRDLDDDLLDLLLLUUURLDDDRRUUUULURRRRRDDDLLLUULURRDDLLLLDRURDURRDLLLDURDURRDULLDLDRUURRDDUULLDDDRRLLULLDRRUUURRDDDRRUUULLLLDDDRRUURRDDR"
  },
  {
    "name": "Mudança de turno",
    "rows": [
      "##########",
      "#        #",
      "#  ##  $ #",
      "#     #$ #",
      "#  # $@  #",
      "# .. ##$ #",
      "#  .  .  #",
      "##########"
    ],
    "solution": "RRUULLULDRRRDDLLLRRRUULLLDURRRDDLDURUULDULLDLLLDDRRUDLLUUUURRRDDLLRRUULLLDDDURRRURRDDLLULLLDLDDRRURURULLRRUULLLDDLDDRLUURDURRDRRRRDDLLLLUURRRDRDL"
  },
  {
    "name": "Câmara das cinco caixas",
    "rows": [
      "###########",
      "#         #",
      "# .#  $  ##",
      "#  # $ ## #",
      "#   $$ #  #",
      "# .  #   .#",
      "# @$    # #",
      "#       ..#",
      "###########"
    ],
    "solution": "UUUUURRRRDDDUUULLLLDDDDDDRULUUUUURRDRRDDDUUULLDRURDDUUULLLLDDDDDRRRRLLLLUUUUURRDDRRDDDURRRDDLLULURRLDLLDRRRLULLLUURUULDRDLLRDDLLUUUDRRURRDLLDLURRRDDLDRR"
  },
  {
    "name": "O labirinto azul",
    "rows": [
      "#########",
      "#       #",
      "# $# #  #",
      "#  #$  .#",
      "#  $@# .#",
      "# # $  .#",
      "# .     #",
      "#########"
    ],
    "solution": "DLDLLUUUUURDURRDDDUUULLDLDDRRLLUURDLDRLDDRRURRDRRUUULLLDUUULLDDDRDRLULUUURRDDRRDRDDLUURUUULLLDDRRUULLLLDDDRDRRDRRUULULLDURRDRDDLLURUULLDLDRRDRRUDLLURDLLL"
  },
  {
    "name": "Passagem condicionada",
    "rows": [
      "##########",
      "#.       #",
      "#    $ $ #",
      "#   #.$$ #",
      "###  #   #",
      "#   #@$  #",
      "##   #   #",
      "#  #..$ .#",
      "##   . # #",
      "##########"
    ],
    "solution": "RURRUUULLLDURRRDLLLLULLDDRURULLDRRRRDURDLDRURDLLDURRDDLDLRURUULDUUULLLLDDDDRDDRRULDLLLUUURUUURRRDDDDURRDLUUUULLLLDDDDRDULUUUURRRDDDRDDLLRRUULDRDLUUUUULLLDDDDLDDRR"
  },
  {
    "name": "Armazém sem margem",
    "rows": [
      "###########",
      "#         #",
      "# $ $#  # #",
      "# $ @$ # .#",
      "#  $   .# #",
      "#   #   ..#",
      "#         #",
      "#     .   #",
      "###########"
    ],
    "solution": "LUULLDRURDURDLLDURRDULLDRDRRLLUURDRLLDDDRRUURLULUURRDDLLLDRULLLDRDDDRUULUURRRRDULLDRULLLDRRLDDRRURRDLLLLUUURRRDULLDRDDRRURDLLLURRLLUURDLDDRRRRUUDDLLURDLLLURRDLLLLDRR"
  },
  {
    "name": "O último armazém",
    "rows": [
      "###########",
      "##        #",
      "# $ $@#   #",
      "#  ##     #",
      "#      #  #",
      "#   # .   #",
      "#. *$$##..#",
      "#        ##",
      "###########"
    ],
    "solution": "ULLLDRRURDLLLDURRRDRDDRRDDLLLUDLLLUURURRLLDLLURRRLLUURRRDRDULULLLDDRRRLLDLDDRRRUURRLLDDRRRURUUULLLDULULLLDDRRRDRLUURRRDDUULLLDDRRRUULLDURRDRDUULLLDLDDDLLUDRRULLLUURD"
  },
  {
    "name": "Mestre das caixas",
    "rows": [
      "###########",
      "#         #",
      "# $##     #",
      "# $ $  #. #",
      "# #   .$  #",
      "#@$  ##. .#",
      "#   .     #",
      "###########"
    ],
    "solution": "DRRUUURDDDLLLUUURLDDRLUURRLLUURDURRRDDURRRDDDDLLLLUULURDDDLLULUURRLUURRRDRDDRDDLLLUURRUULDUULLLDDRRDDDRRRURRUULDUULLDDRDDLLLUUURLDDDRRRUULULURRURDLLDLLDRLDDRRRUURLDDLLLUULDRDRRRRRULDLLLLUUURURRRRDDLDDLLLLULLDR"
  }
];

const directions: Record<string, Direction> = { U: 'up', D: 'down', L: 'left', R: 'right' };

export const LEVELS: Level[] = blueprints.map((blueprint, index) => {
  const width = blueprint.rows[0].length;
  const floor: number[] = [];
  const walls: number[] = [];
  const goals: number[] = [];
  const boxes: number[] = [];
  let player = -1;
  for (let y = 0; y < blueprint.rows.length; y++) for (let x = 0; x < width; x++) {
    const tile = blueprint.rows[y][x];
    const cell = y * width + x;
    if (tile === '#') walls.push(cell);
    else floor.push(cell);
    if (tile === '.' || tile === '*' || tile === '+') goals.push(cell);
    if (tile === '$' || tile === '*') boxes.push(cell);
    if (tile === '@' || tile === '+') player = cell;
  }
  const solution = [...blueprint.solution].map(letter => directions[letter]);
  return {
    id: index + 1, name: blueprint.name, difficulty: index < 15 ? 'easy' : index < 30 ? 'medium' : 'hard',
    width, height: blueprint.rows.length, walls, floor, goals, boxes, player, solution,
    par: solution.length, ...(blueprint.inspired ? { inspired: true } : {}),
  };
});

const positiveMod = (value: number, modulus: number) => (value % modulus + modulus) % modulus;

/** A versioned 320-day rotation of verified rooms. Consecutive days use different
 * rooms; rotations/reflections preserve both the puzzle and its proven route.
 * Only UTC calendar fields are used, so every timezone receives the same puzzle. */
export function dailyLevel(date: Date = new Date()): Level {
  const day = Math.floor(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86_400_000);
  const source = LEVELS[positiveMod(day, LEVELS.length)];
  const transform = positiveMod(Math.floor(day / LEVELS.length), 8);
  const rotation = transform % 4;
  const mirrored = transform >= 4;
  const width = rotation % 2 ? source.height : source.width;
  const height = rotation % 2 ? source.width : source.height;
  const cell = (original: number): number => {
    let x = original % source.width;
    let y = Math.floor(original / source.width);
    let w = source.width;
    let h = source.height;
    if (mirrored) x = w - 1 - x;
    for (let turn = 0; turn < rotation; turn++) {
      [x, y] = [h - 1 - y, x];
      [w, h] = [h, w];
    }
    return y * width + x;
  };
  const clockwise: Record<Direction, Direction> = { up: 'right', right: 'down', down: 'left', left: 'up' };
  const reflect: Record<Direction, Direction> = { up: 'up', down: 'down', left: 'right', right: 'left' };
  const solution = source.solution.map(original => {
    let direction = mirrored ? reflect[original] : original;
    for (let turn = 0; turn < rotation; turn++) direction = clockwise[direction];
    return direction;
  });
  const map = (cells: number[]) => cells.map(cell).sort((a, b) => a - b);
  return {
    ...source, id: 100_000 + day, name: date.toISOString().slice(0, 10), width, height,
    walls: map(source.walls), floor: map(source.floor), goals: map(source.goals),
    boxes: map(source.boxes), player: cell(source.player), solution,
  };
}
