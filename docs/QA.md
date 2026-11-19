# BOXSHIFT — Registo de validação

## Versão 2.0 · 18 de novembro de 2026

**Versão 2.0 publicada em 18 de novembro de 2026; recursos HTTPS novamente verificados em 19 de novembro.** [Jogar BOXSHIFT](https://scalifornia.github.io/boxshift-puzzle/). O commit `ad4b75f886619e720c3ff94e6b669e1b1e15b299` passou na [verificação e publicação 44406018854](https://github.com/Scalifornia/boxshift-puzzle/actions/runs/44406018854). Os 14 recursos pedidos pelo cache offline, incluindo a página, manifesto, ícones, fonte, scripts e estilos, têm os mesmos bytes do build local testado. Cache publicado: `boxshift-bf55f6bf2ca2`.

**A execução final no GitHub aprovou 101 testes de regras/persistência e os 37 cenários de navegador sem repetições**, em 8,9 minutos de testes de navegador. Os 40 níveis clássicos e as 12 salas infernais foram concluídos por teclado em Chromium e WebKit, com avanço automático e marcador exato de cada sala. O deploy GitHub Pages também foi aprovado.

Na [execução anterior 44402434951](https://github.com/Scalifornia/boxshift-puzzle/actions/runs/44402434951), 36 cenários passaram na primeira tentativa e o percurso infernal em WebKit passou na repetição em 39,7 segundos. A primeira tentativa atingiu 600 segundos ao tentar clicar no atalho seguinte: o registo mostra que o botão foi removido durante a tentativa, enquanto o jogo avançava automaticamente. O teste foi corrigido para aguardar o marcador exato da sala seguinte, tanto na campanha clássica como na infernal. As asserções de soluções, recordes e orçamento foram preservadas. O resultado final acima confirma a correção do teste sem mudar os ficheiros executáveis do jogo.

No endereço público, 13 cenários iniciais passaram em Chromium e WebKit, incluindo as 12 salas infernais em ambos os motores, progresso, animações, Joker, sugestões, gestos globais, layouts e recarregamento offline. Uma verificação adicional com toques nativos na simulação de iPhone 13 passou em ambos: ajuda por modo, pausa/continuação, Joker de duas jogadas uma única vez, duas sugestões sem ativação duplicada e persistência após recarregar. A emulação não substitui a validação num iPhone físico.

Os 40 níveis clássicos e as 12 salas infernais também foram concluídos no endereço público em Chromium e WebKit, aguardando o avanço automático e o marcador exato de cada sala: quatro percursos aprovados em 2,3 minutos. O teste sincronizado está guardado no GitHub e foi aprovado na execução final indicada acima. Os ficheiros executáveis do jogo não mudaram neste ajuste.

A [primeira execução da versão 2.0](https://github.com/Scalifornia/boxshift-puzzle/actions/runs/43728560861), em 15 de novembro, bloqueou corretamente a publicação: 36 cenários passaram e o cenário de toque falhou ao abrir a pausa após um gesto nas duas tentativas. A correção ativa os botões no fim do toque e cancela o clique sintetizado para evitar duplicações. O cenário foi reforçado com pausa/continuação, Joker, reinício e sugestões por toque; nenhuma asserção que detetou o problema foi removida.

- TypeScript, ESLint e build de produção aprovados.
- **101 testes de lógica e persistência aprovados**, incluindo os 12 novos puzzles resolvidos sem consultar as rotas guardadas, regras de pontapé/ataque/chave/armadilhas, orçamento e compatibilidade dos dados existentes.
- **37 cenários E2E aprovados numa única execução completa em 15 de novembro de 2026 (1 minuto local):** Chromium e WebKit, todos os 40 níveis clássicos e as 12 salas infernais por teclado, Joker, sugestões, derrota e recuperação, progresso, modos, idiomas, offline, gestos fora do tabuleiro e layouts mobile. O cenário tátil valida pausa e continuação imediatamente após o gesto, Joker recuando duas jogadas, reinício e duas sugestões. Inclui animações do menu e dos golpes sem progresso artificial e redução de movimento.
- Layouts originais a 320×568, 390×844, 844×390, 768×1024, 1366×768 e 1920×1080. A nova campanha inclui também 390×650 para o espaço reduzido por barras do navegador.
- Renderização infernal, faíscas, golpes, menu em demonstração e áudio inteiramente originais. FPS sustentados, equilíbrio auditivo e teste desta revisão num iPhone físico permanecem pendentes.
- Os três avisos de design anteriores foram reavaliados: o progresso transita por `transform`; os contornos móveis relevantes são neutros e de 1 px, sem o realce espesso assinalado. Nenhuma supressão foi adicionada e nenhum desses avisos ficou por corrigir. O ajuste mobile remove a antiga limitação de altura do menu e liberta o espaço ocupado pelo D-pad.

## Registo da versão anteriormente publicada

Estado em **23 de outubro de 2026**, após o reforço da campanha, a implementação dos novos limites de ajuda e a publicação pública verificada.

## Evidência executada

| Verificação | Resultado observado |
| --- | --- |
| Vitest, revisão atual | **79 testes aprovados:** 62 de motor/conteúdo, 15 de persistência/idiomas e 2 de renderer |
| Campanha | 40 estruturas válidas e 40 soluções reproduzidas até à vitória |
| Solver independente | Resolveu as 40 salas sem consultar as soluções armazenadas, dentro dos limites de pesquisa testados |
| Daily | As 320 variantes de rotação/reflexão preservam uma solução válida; determinismo UTC verificado |
| Dificuldade | Primeiro nível: 3 caixas, 31 movimentos e 12 empurrões na rota verificada; testes de regressão exigem múltiplas caixas e esforço de solução por capítulo |
| ESLint dos ficheiros de conteúdo alterados | `src/levels.ts` e `tests/engine.test.ts` aprovados |
| Formatação do diff | `git diff --check` aprovado após a alteração da campanha |

As rotas verificadas usam 25–53 movimentos nos primeiros 15 níveis, 63–140 nos 15 intermédios e 133–209 nos 10 difíceis. Os finais têm 4–6 caixas e as soluções independentes exigem pelo menos 24 empurrões. Os movimentos incluem deslocações entre empurrões; não são apresentados como mínimos de movimentos.

TypeScript, ESLint e build de produção da revisão atual aprovados. A suite atual tem **27 cenários E2E aprovados**. Além da validação local, a execução final no GitHub aprovou os 27 cenários numa só execução, sem repetições. Os 40 níveis foram concluídos por teclado nos dois motores. Joker, limites de sugestões, avanço automático, sessão, idiomas, modos, expiração, offline e layouts foram exercitados.

## Regras verificadas no navegador

- Avanço automático após 1,5 segundos em Classic, Zen e Time Challenge, exceto no último nível; Daily permanece no resultado. Indicação do próximo nível na seleção da campanha.
- Joker disponível após dois movimentos válidos; um uso recua exatamente dois movimentos e restaura jogador, caixas e contadores.
- Duas sugestões encontradas por sala e modo, incluindo Zen. Pesquisa sem resultado e aviso de bloqueio não gastam uma sugestão.
- Limites de ajuda preservados ao recomeçar, voltar ao menu e recarregar; recursos repostos após a vitória para uma repetição futura.
- Braços estendidos e expressão de esforço capturados durante um empurrão real. Sinal de áudio sintetizado detetado com efeitos ativos; equilíbrio auditivo e teste em dispositivos físicos permanecem pendentes. Opções de som e redução de movimento disponíveis.
- Chave de armazenamento `boxshift.save.v2`; migração lê `boxshift.save.v1` e recupera apenas definições e estatísticas gerais, preservando os dados antigos durante a migração.

## Formatos, offline e dispositivos

A revisão atual foi exercitada em navegador automatizado a 320×568, 390×844, 844×390, 768×1024, 1366×768 e 1920×1080. Também teve recarregamento offline e conclusão de um nível aprovados em Chromium e WebKit após o precache. 

Foram verificados tabuleiro completo, contadores, Joker, reinício, pausa, gestos, percurso por toque sem empurrões, recuperação de sessão, idiomas, modos, Daily UTC e expiração. Sem erros bloqueantes de consola nos percursos testados.

**iPhone e Android físicos permanecem pendentes.** A emulação não comprova instalação, áudio, gestos ou desempenho nesses dispositivos. Medição sustentada de FPS e equilíbrio de áudio também permanecem pendentes.

## Publicação

| Item | Resultado confirmado |
| --- | --- |
| Código | Disponível em [Scalifornia/boxshift-puzzle](https://github.com/Scalifornia/boxshift-puzzle) |
| CI da versão do jogo | [Execução n.º 4](https://github.com/Scalifornia/boxshift-puzzle/actions/runs/40026842151) aprovada: tipos, lint, 79 testes, build e **27 E2E sem repetições**, em 6,8 minutos de testes de navegador |
| Campanha no CI | 40 níveis concluídos por teclado em Chromium (2,6 minutos) e WebKit (5,2 minutos) |
| GitHub Pages | Deploy aprovado do commit `2bc8fe7424ecd4fd92735e55aa6194537b59c097`; fonte GitHub Actions e HTTPS obrigatório |
| Endereço público | [Jogar BOXSHIFT](https://scalifornia.github.io/boxshift-puzzle/) — HTTP 200 e percursos aprovados em Chromium e WebKit em 23/10/2026 |
| Recursos publicados | JavaScript `index-CyTPG4I_.js` e CSS `index-BbRkzXIJ.css` com SHA-256 igual ao build local; sem 404, falhas de recursos ou erros de página nos percursos testados |
| Regras no endereço público | Joker recua exatamente dois movimentos uma única vez; duas sugestões, terceira bloqueada; limites preservados após reinício, menu e recarregamento |
| Progresso no endereço público | Vitória por teclado no nível 1, avanço automático ao nível 2, marcadores de nível atual/concluído e desbloqueio guardado |
| Offline no endereço público | Recarregamento sem rede, recuperação do nível 2 e movimento legal aprovados nos dois motores |

A primeira execução Linux excedeu o limite de 30 segundos durante a sequência de teclas do Daily em WebKit; houve também uma expectativa de 7 segundos a aguardar o avanço de nível. Os cenários passaram na execução final. A CI usa limites de 90 segundos por cenário, 15 segundos por expectativa e 600 segundos para os 40 níveis. O WebKit Linux usa DPR 1 com o mesmo viewport CSS de 1440×960 e todas as asserções. Localmente mantêm-se DPR 2 em WebKit e limites de 30, 7 e 180 segundos, respetivamente.

A verificação pública usou contextos isolados e comparou os recursos servidos com o build testado. Os commits seguintes atualizam apenas esta documentação e o README; os ficheiros executáveis do jogo permanecem os mesmos. Instalação, áudio, gestos e desempenho em iPhone/Android físicos continuam pendentes.

## Comandos de validação

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm exec playwright install chromium webkit
pnpm test:e2e
```

No ambiente desta sessão, o Vitest foi executado diretamente com o Node.js disponibilizado pelo runtime, evitando que o wrapper do gestor tentasse reinstalar dependências. Os resultados registados correspondem a execuções reais.

## Limitações conhecidas

- Daily usa uma rotação de 320 dias com variantes geométricas dos 40 puzzles da campanha.
- As sugestões têm limite de pesquisa e podem terminar sem resultado num estado complexo ou sem solução.
- Os avisos identificam bloqueios óbvios; a ausência de aviso não demonstra que um estado seja resolúvel.
- Os dados são locais ao navegador e não sincronizam entre dispositivos.
- O Canvas ainda não dispõe de uma alternativa textual completa para leitores de ecrã.
- O editor de níveis e a geração de puzzles adicionais ficam fora desta versão.
