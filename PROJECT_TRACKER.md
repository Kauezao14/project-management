# Project Management Gantt — Rastreamento do Projeto

> Atualizado em: 2026-05-22

---

## Visão Geral

Aplicativo web de gestão de projetos com Gantt drag-and-drop para dois clientes:
- **DOMINUS**: produção de moldes para injeção plástica. Cada linha = uma **Máquina**, cada tarefa = uma **Peça**.
- **PSG**: montagem e manutenção de máquinas. Cada linha = um **Técnico**, cada tarefa = um **Trabalho**.

**URL produção:** `https://kauezao14.github.io/project-management/`

**Deploy:** GitHub Pages via GitHub Actions (push em `main` → build → deploy automático)

---

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4
- Zustand v5 + Immer (estado global)
- @dnd-kit/core + @dnd-kit/sortable (drag and drop)
- date-fns (manipulação de datas)
- Supabase (sync remoto, coluna `extra_data` JSONB)
- nanoid, lucide-react

---

## Arquitetura Principal

### Dados
- `ClientConfig` — configuração de cada cliente (workCalendar, labels)
- `Pool` — linha do Gantt (máquina / técnico)
- `Task` — tarefa com `scheduledStart`, `scheduledEnd`, `actualEnd`, `pinnedStart`, `durationHours`, `status`
- `Project` — projeto com cor e `startDate`

### Scheduling (`src/lib/scheduler.ts`)
- `rescheduleAll()` — ordena tarefas topologicamente respeitando:
  1. Fila do pool (cada tarefa começa após a anterior terminar)
  2. Predecessoras explícitas (`task.predecessors`)
- Tarefas com `pinnedStart` ignoram o piso "agora" mas ainda respeitam predecessoras
- **Tarefas concluídas nunca são reagendadas** — mantêm `scheduledStart/End` históricos

### Visual (`src/lib/ganttLayout.ts`)
- Barras posicionadas por `calcLeft(scheduledStart)` e `calcWidth(scheduledStart, barEnd)` em tempo real (wall-clock)
- Fim visual: `actualEnd ?? scheduledEnd`
- Sem splitting de barras por dia/almoço/fim de semana — a barra é contínua
- Fins de semana visíveis apenas pelo fundo cinza das colunas

### Rendering (`src/components/gantt/TaskTrack.tsx`)
- Anti-overlap: `minLeft` garante que barras consecutivas não se sobreponham visualmente mesmo com largura mínima de 4px
- Drag preview via `DragPreviewContext`: setas → (forward) e ← (backward) mostram direção de deslocamento durante o drag

---

## Funcionalidades Implementadas

- [x] Gantt com views Dia / Semana / Mês
- [x] Drag-and-drop dentro e entre pools (reordenação com recálculo automático)
- [x] Drag preview com setas de direção (← →)
- [x] Modal de criação/edição de tarefas com todos os campos
- [x] `pinnedStart` — ancora início de uma tarefa sem usar "agora" como piso
- [x] Migração automática de tarefas existentes para `pinnedStart` (uma só vez, flag localStorage)
- [x] Propagação de atraso para tarefas subsequentes
- [x] Caminho crítico (estrela amarela nas barras)
- [x] Cores por projeto (fundo neutro + borda/ícone colorido)
- [x] Status: Pendente / Em andamento / Atrasado / Concluído (com hachura)
- [x] Ícones de hora extra (lua), almoço (café), caminho crítico (estrela)
- [x] Ctrl+Z undo (até 20 operações, snapshot fora do Zustand)
- [x] Popup de detalhes da tarefa (clique na barra)
- [x] Marcador "agora" (linha vermelha vertical)
- [x] Highlight do dia atual e fins de semana nas colunas
- [x] Recolher/expandir linhas do Gantt
- [x] Sincronização com Supabase (`extra_data` JSONB para campos custom)
- [x] Persistência localStorage como fallback

---

## Bugs Corrigidos (histórico)

| Data | Bug | Causa raiz | Fix |
|------|-----|------------|-----|
| 2026-05-21 | Drag ordering errado | `order` value usado como splice index | `findIndex` em array sorted |
| 2026-05-21 | Edit de tarefa movia tempo | `updateTask` sempre chamava `rescheduleAll` | Checar `scheduleFields` antes de reagendar |
| 2026-05-21 | Barras cruzando fins de semana | `getWorkSegments` com `skipLunch` gerando segmentos extra | Remover splitting por dia — barra contínua wall-clock |
| 2026-05-21 | Barras não-clicáveis (slivers) | Segmentos de almoço geravam 2ª barra sem `pointer-events` | Remover `getWorkSegments`, usar `calcLeft`+`calcWidth` direto |
| 2026-05-22 | Tarefas concluídas sobrepostas | `rescheduleAll` movia concluídas para "agora" | Skip completo de concluídas no scheduler |
| 2026-05-22 | `scheduledEnd < scheduledStart` | Fix anterior movia `scheduledStart` sem atualizar `scheduledEnd` | Revertido: concluídas não são tocadas pelo scheduler |
| 2026-05-22 | Popup mostrando datas erradas | `scheduledEnd` desatualizado para tarefas concluídas | Popup usa `actualEnd ?? scheduledEnd` |
| 2026-05-22 | Sobreposição visual de barras curtas | Largura mínima 4px > largura real da tarefa curta | `minLeft` tracking em `taskLayouts` |
| 2026-05-22 | Preview do drag empurrava muito | Usava duração wall-clock (inclui fds) para calcular posição | Simplificado para setas ←→ sem reposicionar |

---

## Problemas Conhecidos / Em Investigação

- **Barras de concluídas com `scheduledStart` corrompido** (movidas para "agora" por versões antigas do scheduler): visualmente o `minLeft` evita sobreposição, mas as datas no popup podem estar erradas se `actualEnd` não estiver setado. Solução definitiva: migração de dados limpando `scheduledStart` de concluídas.
- **`pinnedStart` em tarefas criadas sem `pinnedStart`**: ao reagendar, tarefas sem `pinnedStart` usam `now` como piso, o que pode empurrar tarefas para o futuro inesperadamente.

---

## Próximos Passos

### Alta Prioridade
- [ ] **Limpeza de dados corrompidos**: detectar tarefas concluídas com `scheduledEnd < scheduledStart` ou `scheduledEnd` muito distante de `actualEnd` e corrigir automaticamente (migration na primeira carga)
- [ ] **Agrupamento por projeto/tipo/máquina**: aba alternativa de visualização com tarefas agrupadas por critério (Feature #5 solicitada pelo usuário)

### Média Prioridade
- [ ] **Indicador visual de tarefa fora do horário**: quando `pinnedStart` é fora do horário de trabalho, mostrar aviso
- [ ] **Relatório/exportação**: exportar cronograma em PDF ou imagem
- [ ] **Filtro por projeto**: exibir só tarefas de um projeto específico no Gantt

### Baixa Prioridade
- [ ] **Code splitting**: bundle único de 552KB pode ser dividido (aviso do Vite)
- [ ] **Supabase realtime**: sync automático entre múltiplos usuários simultâneos

---

## Decisões de Design Importantes

1. **Barra contínua wall-clock**: Barras não se dividem em dias separados. Fins de semana aparecem como colunas cinzas mas a barra cruza por cima. Mais simples e menos propenso a bugs.

2. **`pinnedStart` bypassa piso "agora"**: Permite fixar uma tarefa em uma data passada sem o scheduler a mover. O scheduler ainda respeita predecessoras (a tarefa não começa antes de suas dependências terminarem).

3. **Tarefas concluídas imutáveis no scheduler**: Não são reagendadas. `effectiveEnd = actualEnd ?? scheduledEnd` é usado como referência para sucessoras.

4. **Undo fora do Zustand**: Stack de snapshots como variável de módulo. `JSON.parse(JSON.stringify(...))` para deep copy. Evita overhead de middleware.

5. **Anti-overlap visual (`minLeft`)**: Barras muito curtas usam mínimo 4px. O `minLeft` garante que cada barra começa onde a anterior termina visualmente. Não altera dados.
