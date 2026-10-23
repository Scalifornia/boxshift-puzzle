# BOXSHIFT · Puzzle Adventure

Um pequeno robô. Um mundo de puzzles.

BOXSHIFT é uma aventura de lógica inspirada nas regras clássicas do Sokoban: empurra cada caixa até a um destino, planeia o caminho e evita ficar sem espaço para manobrar. Joga no navegador com teclado, gestos ou controlos táteis, sem conta e sem instalação obrigatória.

[JOGAR AGORA](https://scalifornia.github.io/boxshift-puzzle/) · [Código-fonte](https://github.com/Scalifornia/boxshift-puzzle) · [Verificações automáticas](https://github.com/Scalifornia/boxshift-puzzle/actions)

**Publicado em GitHub Pages e verificado por HTTPS em 23 de outubro de 2026.** Joker, sugestões, avanço automático, progresso e utilização offline foram exercitados no endereço público em Chromium e WebKit. Consulta a evidência e as limitações em [docs/QA.md](docs/QA.md).

## O jogo

- **40 níveis de campanha:** 15 de dificuldade inicial, 15 intermédios e 10 difíceis. A campanha foi reforçada com 16 mapas novos: começa com 3 caixas e uma rota verificada de 31 movimentos, e os níveis finais têm 4–6 caixas. Três salas adaptam a composição visual das fotografias de referência fornecidas pelo utilizador.
- **Quatro modos:** Classic Adventure para progredir na campanha, Zen para jogar sem temporizador visível, Time Challenge com limite de tempo e Daily Challenge com resultados por data UTC.
- **Quatro ambientes:** Warehouse Classic, Neon Laboratory, Secret Garden e Night City. Os temas seguintes desbloqueiam após 5, 15 e 30 níveis da campanha concluídos.
- **Progresso pessoal:** estrelas, melhores resultados por modo, conquistas, tempo jogado, caixas empurradas e continuação da sessão.
- **Ajuda durante o jogo:** um Joker para recuar dois movimentos, duas sugestões por sala, Restart, Pause e avisos de bloqueios óbvios.
- **Vitórias com continuidade:** passagem automática ao nível seguinte após 1,5 segundos, com o resultado visível e indicação do próximo nível na seleção da campanha.
- **Identidade original:** robô e cenários desenhados em Canvas 2D. Ao empurrar, o robô estende os braços, faz uma expressão de esforço e emite um som curto de esforço sintetizado; música e efeitos usam Web Audio.
- **Português, francês e inglês:** deteção inicial do idioma do navegador e preferência guardada. Português é o idioma de recurso.
- **PWA e recursos locais:** funcionamento offline após um carregamento completo da versão de produção e instalação opcional nos navegadores que a suportam.

O desafio diário usa uma rotação determinística de **320 dias**: os 40 puzzles verificados recebem rotações e reflexões que preservam a solução. A mesma versão oferece o mesmo puzzle a todos os jogadores na mesma data UTC. É uma seleção de variantes verificadas, não uma promessa de puzzles inéditos ilimitados.

As rotas de referência dos primeiros 15 níveis têm **25–53 movimentos**; as dos intermédios, **63–140**; e as dos difíceis, **133–209**. Todas as salas foram resolvidas pelo algoritmo sem consultar a rota armazenada e depois reproduzidas legalmente nos testes. Estes valores descrevem soluções verificadas, não mínimos de movimentos nem uma medida completa da dificuldade humana.

## Como jogar

Ocupa todos os destinos com caixas para concluir uma sala. O robô empurra uma caixa de cada vez; não consegue puxar caixas nem empurrar duas juntas. Planeia as manobras e reserva o Joker para corrigir uma decisão.

| Ação | Teclado |
| --- | --- |
| Mover | Setas ou W A S D |
| Joker: recuar dois movimentos | Z |
| Recomeçar | R |
| Sugestão | H |
| Pausa | P ou Escape |
| Ativar/desativar som | M |

No telemóvel ou tablet, desliza sobre o tabuleiro, utiliza as setas táteis ou toca numa casa livre acessível. O percurso automático evita caixas e não as empurra. Os mesmos botões de jogo estão disponíveis em todos os formatos.

**Joker:** há um uso por sala e modo, disponível depois de dois movimentos válidos. Restaura exatamente esses dois movimentos, incluindo jogador, caixas e contadores de movimentos/empurrões. Tentativas contra paredes não contam como movimentos.

**Sugestões:** há duas por sala e modo, incluindo Zen. Cada sugestão encontrada indica a próxima direção de uma solução válida; pesquisas sem resultado e avisos de bloqueio não gastam o orçamento. O uso do Joker e das sugestões permanece guardado ao recomeçar, regressar ao menu ou recarregar a página. Concluir a sala repõe os recursos para uma repetição futura. No Daily, o orçamento corresponde ao puzzle da respetiva data UTC.

Depois de uma vitória, Classic, Zen e Time Challenge avançam automaticamente ao próximo nível após 1,5 segundos; o botão de próximo nível permite avançar imediatamente. Daily e o último nível apresentam o resultado sem avanço automático.

**Estrelas:** em Classic e Daily, a rota de referência define o objetivo de movimentos: até esse objetivo dá 3 estrelas; até 150% dá 2; as restantes vitórias dão 1. Esta referência é uma solução verificada e pode não ser a solução mínima. Zen atribui 3 estrelas pela conclusão. Time Challenge combina tempo e movimentos; os critérios aparecem em “Como jogar”. Os melhores resultados comparam primeiro estrelas, depois movimentos e depois tempo.

## Abrir e instalar

No Mac ou PC, abre o endereço HTTPS do jogo num navegador moderno e seleciona Jogar. Não é necessário instalar software.

No **iPhone**, abre o jogo no Safari. Para instalar, usa **Partilhar → Adicionar ao ecrã principal** e confirma. No **Android**, abre no Chrome e procura **Instalar aplicação** ou **Adicionar ao ecrã principal** no menu do navegador. A designação e a disponibilidade dependem da versão do navegador. A instalação é opcional.

Para jogar sem ligação, deixa terminar o primeiro carregamento online da versão publicada. O Service Worker guarda o jogo, os níveis, a fonte e os ícones no dispositivo. Uma atualização fica em espera enquanto a versão anterior tiver separadores abertos; fecha os separadores do jogo e volta a abri-lo para ativar a nova versão. Limpar os dados do site pode remover o progresso e os recursos offline.

## Dados e privacidade

O jogo não inclui backend, contas, anúncios, compras, telemetria nem recolha de dados pessoais pela aplicação. A ligação de rede serve os ficheiros estáticos do alojamento. O fornecedor de alojamento pode tratar os seus próprios registos técnicos de acesso.

As definições, recordes, recursos de ajuda e sessão ficam apenas no `localStorage`, na chave `boxshift.save.v2`. Como os mapas da campanha mudaram, a migração da chave anterior `boxshift.save.v1` recupera apenas definições e estatísticas gerais; os desbloqueios, resultados por nível e a sessão anterior não são aplicados aos novos mapas. A migração lê os dados antigos sem os alterar.

Não existe sincronização entre dispositivos ou navegadores. Nas definições, “Apagar progresso” pede confirmação antes de eliminar os dados atuais e antigos. Quando o navegador bloqueia o armazenamento, continua a ser possível jogar, mas o progresso e os limites de ajuda poderão não persistir.

## Desenvolvimento

Requisitos: **Node.js 22.13 ou superior** e **pnpm 11.25.0**. O workflow utiliza Node.js 24. A versão do gestor está declarada em `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

O servidor de desenvolvimento fica disponível em `http://127.0.0.1:5173`. O Service Worker é registado apenas no build de produção.

| Comando | Objetivo |
| --- | --- |
| `pnpm typecheck` | Verificar TypeScript sem gerar ficheiros |
| `pnpm lint` | Verificar o código com ESLint |
| `pnpm test` | Executar testes de lógica, níveis, persistência e renderização |
| `pnpm build` | Criar `dist/` e gerar o cache offline versionado |
| `pnpm preview` | Servir o build de produção localmente |
| `pnpm exec playwright install chromium webkit` | Instalar os navegadores usados nos testes end-to-end |
| `pnpm test:e2e` | Executar os cenários de navegador configurados |

## Arquitetura

TypeScript e Vite fornecem uma aplicação estática pequena. Um renderer próprio em **Canvas 2D** permite controlar a grelha, a interpolação e os desenhos sem uma dependência de motor de jogo. Os menus usam HTML e CSS para manter controlos nativos, foco e adaptação aos formatos de ecrã.

| Ficheiro | Responsabilidade |
| --- | --- |
| `src/engine.ts` | Estados, movimentos, colisões, vitória, caminhos e bloqueios |
| `src/levels.ts` | Campanha, soluções verificáveis e variantes diárias UTC |
| `src/solver.ts` | Pesquisa de soluções com limites de processamento |
| `src/solver.worker.ts` | Pesquisa fora da thread da interface |
| `src/renderer.ts` | Desenho original do robô, tabuleiro, temas e animações |
| `src/main.ts` | Ecrãs, inputs, modos, sessão e integração dos módulos |
| `src/audio.ts` | Música e efeitos procedurais com Web Audio |
| `src/storage.ts` | Dados versionados, validação, pontuação e conquistas |
| `src/i18n.ts` | Textos e deteção de idioma PT/FR/EN |
| `src/style.css`, `src/tokens.css` | Layout responsivo e identidade visual |
| `public/` | Manifest PWA e ícones de instalação |
| `scripts/build-sw.mjs` | Cache de produção com versão derivada dos recursos |
| `tests/` | Verificação automatizada |

As regras operam sobre um estado lógico independente do desenho. As animações não determinam o resultado de um movimento. O solver corre num Web Worker com limite de tempo; se não encontrar uma solução dentro do orçamento, o jogo informa o jogador em vez de bloquear a interface ou sugerir uma jogada aleatória.

## GitHub Pages

O workflow em `.github/workflows/deploy.yml` verifica tipos, lint, testes, build e cenários Chromium e WebKit. Pull requests executam as verificações. Um push em `main` publica o diretório `dist/` através de GitHub Pages após os testes passarem.

O repositório deve ter **Settings → Pages → Source: GitHub Actions**. O Vite usa caminhos relativos (`base: './'`), incluindo manifest e Service Worker, para servir o projeto em `/boxshift-puzzle/`.

A existência de um build local ou de um commit no GitHub não confirma uma publicação. Confirma o workflow, abre o endereço público e verifica a versão e os fluxos principais. O estado conhecido e os limites de teste ficam registados em [docs/QA.md](docs/QA.md).

## Créditos e licenças

Os gráficos de jogo, o personagem, os efeitos e a música procedural foram criados para BOXSHIFT. As fotografias pessoais de referência não são incluídas no repositório nem no build. Os níveis são composições próprias; não é distribuído nenhum pacote externo de níveis.

- [Outfit](https://github.com/Outfitio/Outfit-Fonts) — fonte distribuída por `@fontsource-variable/outfit`, sob SIL Open Font License 1.1.
- [Phosphor Icons](https://github.com/phosphor-icons/core) — ícones sob licença MIT.
- As ferramentas de desenvolvimento conservam as respetivas licenças nos pacotes instalados. Consulta também `pnpm-lock.yaml` para as versões resolvidas.

Ainda não foi atribuída uma licença de reutilização ao código e aos recursos originais deste projeto. A publicação do repositório, por si só, não concede uma licença geral de redistribuição ou uso comercial.

## Limites e próximos passos

O editor de níveis e a geração de desafios aleatórios adicionais ficam fora desta versão. O Canvas não fornece uma representação textual completa do tabuleiro para leitores de ecrã. A emulação de dimensões mobile não substitui a validação em iPhone e Android físicos, incluindo áudio, instalação e gestos. Consulta [docs/QA.md](docs/QA.md) para distinguir verificações executadas de testes ainda pendentes.
