# BOXSHIFT — Registo de validação

Estado em **22 de outubro de 2026**, após o reforço da campanha e a implementação dos novos limites de ajuda. As verificações de uma revisão anterior não confirmam automaticamente esta revisão.

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

TypeScript, ESLint e build de produção da revisão atual aprovados. A suite atual tem **27 cenários E2E aprovados**: 26 na execução completa em Chromium/WebKit e o cenário tátil móvel numa repetição focada após corrigir a preparação do teste. Os 40 níveis foram concluídos por teclado nos dois motores. Joker, limites de sugestões, avanço automático, sessão, idiomas, modos, expiração, offline e layouts foram exercitados.

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

| Item | Estado |
| --- | --- |
| Repositório dedicado [Scalifornia/boxshift-puzzle](https://github.com/Scalifornia/boxshift-puzzle) | Criado; publicação inicial do código por confirmar |
| GitHub Actions | Workflow preparado; primeira execução por confirmar |
| GitHub Pages | Configuração/publicação por confirmar |
| Endereço previsto | `https://scalifornia.github.io/boxshift-puzzle/` — teste HTTPS público pendente |

Um build local ou um commit não demonstra uma publicação. A entrega requer confirmar o workflow, abrir o endereço público e exercer o jogo servido por esse endereço.

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
