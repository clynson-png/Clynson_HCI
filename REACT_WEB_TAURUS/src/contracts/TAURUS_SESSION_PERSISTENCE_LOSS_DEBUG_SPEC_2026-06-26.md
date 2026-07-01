# SPEC: TAURUS Session Persistence Loss Debug

Data: 2026-06-26
Projeto: `C:\HCI_REACT_WEB\REACT_WEB_TAURUS`

## Problema observado

As sessoes TAURUS Humanoide que foram lancadas ontem nao aparecem hoje.

Evidencia atual:

- App aberto em `localhost:5173`.
- Atleta ativo: `CAMPOS, FABIO`.
- `Smart Chart > HUMANOIDE` mostra:
  - `Sem sessoes aprovadas para desenhar o grafico.`
  - `Nenhuma sessao aprovada encontrada para HUMANOIDE.`
- `Admin` mostra:
  - `PENDING HCI TAURUS REVIEWS`: vazio
  - `HCI TAURUS RESULTS`: vazio
  - `ARCHIVED HCI TAURUS RESULTS`: vazio
- Existem sessoes ISSF para `CAMPOS, FABIO`, mas nenhuma sessao TAURUS visivel.

Conclusao: o problema nao e o grafico. O problema e anterior: as sessoes TAURUS nao foram carregadas/persistidas/recuperadas.

## Arquitetura esperada

Fluxo correto:

```text
Taurus Target
  -> saveTaurusTargetSession()
  -> IndexedDB TAURUS_TARGET_DB_V1
  -> taurus_target_session
  -> workflowStatus = PENDING

Admin
  -> loadTaurusTargetSessions()
  -> lista Pending
  -> Approve
  -> workflowStatus = APPROVED

Smart Chart
  -> loadTaurusTargetSessions()
  -> filtra athleteName + workflowStatus APPROVED + targetType HUMANOID
  -> desenha grafico
```

## Arquivos envolvidos

Obrigatorios para inspecao:

```text
src/pages/TaurusTargetPage.jsx
src/pages/AdminPage.jsx
src/pages/TaurusSmartChartPage.jsx
src/services/taurusTargetStore.js
src/services/taurusTargetSchema.js
src/services/taurusSmartChartEngine.js
src/components/taurus/TaurusSmartChart.jsx
```

## Estado implementado antes desta SPEC

### Sidebar

Sidebar corrigido.

Organizacao atual:

```text
Resumo
Admin
Taurus Target
Smart Chart
Plano
Biblioteca
```

### Smart Chart

Layout premium migrado.

Smart Chart e visualizador, nao motor independente.

Consome somente sessoes:

```js
workflowStatus === 'APPROVED'
```

### Humanoide

Treino principal do Humanoide foi corrigido para nao puxar Duelo 20.

Regra atual no `taurusSmartChartEngine.js`:

```js
category === 'HUMANOID'
targetType === 'DEFENSE_HUMANOID'
trainingType === 'TARGET_BASIC'
weaponClass === 'HUMANOID_BASIC'
phase === 'GENERAL_PREPARATION'
```

### Campo tempo

Foi adicionado no Humanoide:

```text
Tempo dos 20 disparos (s)
```

Campo persistido esperado:

```js
durationSeconds
```

Ele deve ser salvo em `taurus_target_session`, recuperado pelo Smart Chart e usado para:

- card `Tempo 20 disparos`
- coluna `Tempo`
- coluna `Predicao tempo`
- linha de predicao logaritmica no grafico

## Hipoteses principais

Investigar nesta ordem:

1. O app pode estar rodando outro build/projeto na porta `5173`.
2. O `TaurusTargetPage` pode estar salvando em outro origin, porta ou banco IndexedDB.
3. O `saveTaurusTargetSession()` pode nao estar gravando a sessao no object store.
4. A sessao pode estar gravada como `PENDING`, mas o Admin nao esta carregando ou filtrando corretamente.
5. A sessao pode estar gravada com `athleteName` diferente de `CAMPOS, FABIO`.
6. A sessao pode estar gravada com `targetType` diferente de `HUMANOID`.
7. A sessao pode estar sendo apagada/substituida ao editar/modificar.
8. IndexedDB pode estar usando nome/versao errada ou banco criado vazio.
9. O servidor pode ter sido aberto em `localhost` em um momento e `127.0.0.1` em outro, criando IndexedDB separado por origin.

Ponto critico:

```text
localhost:5173 e 127.0.0.1:5173 nao compartilham o mesmo IndexedDB.
```

Se ontem os dados foram salvos em `127.0.0.1:5173` e hoje abriu em `localhost:5173`, o banco pode parecer vazio.

## Checklist de diagnostico

### 1. Confirmar origin atual

No navegador:

```js
window.location.origin
```

Registrar se e:

```text
http://localhost:5173
```

ou

```text
http://127.0.0.1:5173
```

### 2. Inspecionar IndexedDB no DevTools

Abrir:

```text
DevTools > Application > IndexedDB
```

Procurar:

```text
TAURUS_TARGET_DB_V1
```

Stores esperados:

```text
meta
taurus_target_session
taurus_target_hit
```

Verificar:

- existe o banco?
- existem linhas em `taurus_target_session`?
- existem linhas em `taurus_target_hit`?
- as linhas tem `athleteName`, `targetType`, `workflowStatus`, `durationSeconds`?

### 3. Testar nos dois origins

Abrir separadamente:

```text
http://localhost:5173
http://127.0.0.1:5173
```

Em cada um, verificar IndexedDB.

Se os dados aparecem em um e nao no outro, a causa e origin diferente.

Correcao recomendada:

- escolher um origin canonico para desenvolvimento
- preferir `http://127.0.0.1:5173` ou `http://localhost:5173`
- nao alternar entre os dois
- opcional: criar rotina de export/import do banco TAURUS para migrar dados entre origins

### 4. Inserir sessao teste controlada

No `Taurus Target > Humanoide`:

- atleta: `CAMPOS, FABIO`
- max shots: `20`
- tempo: preencher um valor, por exemplo `18.5`
- preencher impactos por zona
- salvar

Resultado esperado imediato:

- Admin deve mostrar em `PENDING HCI TAURUS REVIEWS`
- status deve ser `PENDING`
- targetType deve ser `HUMANOID`
- durationSeconds deve estar preenchido

Se nao aparecer no Admin, o problema esta em:

```text
TaurusTargetPage.jsx
saveTaurusTargetSession()
loadTaurusTargetSessions()
AdminPage.jsx
```

### 5. Aprovar sessao

No Admin:

- clicar `Approve`

Resultado esperado:

- sai de Pending
- entra em `HCI TAURUS RESULTS`
- workflowStatus vira `APPROVED`

### 6. Validar Smart Chart

No `Smart Chart > HUMANOIDE`:

Resultado esperado:

- grafico desenha ponto
- card `Tempo 20 disparos` mostra valor
- tabela mostra `Tempo`
- se houver 2+ sessoes com tempo, linha logaritmica aparece

## Regras que nao podem ser quebradas

Nao fazer:

- nao misturar TAURUS com sessoes ISSF
- nao salvar TAURUS em arrays legacy/mock HCI Target
- nao reconstruir TaurusTargetPage do zero
- nao trocar o banco `TAURUS_TARGET_DB_V1` sem necessidade
- nao limpar IndexedDB sem exportar ou confirmar
- nao alterar fluxo `PENDING -> APPROVED -> ARCHIVED`
- nao fazer Smart Chart consumir `PENDING`
- nao fazer Humanoide puxar treino `DUELO 20`

## Correcoes provaveis

### Se for origin diferente

Escolher origin canonico e documentar.

Sugestao:

```text
http://127.0.0.1:5173
```

Atualizar orientacoes do projeto para sempre abrir esse endereco.

### Se save nao gravar `durationSeconds`

Confirmar em `taurusTargetStore.js`:

```js
durationSeconds: session.durationSeconds ?? null
```

### Se Admin nao carrega TAURUS

Confirmar que `AdminPage.jsx` chama:

```js
loadTaurusTargetSessions()
```

e filtra:

```js
workflowStatus === 'PENDING'
workflowStatus === 'APPROVED'
workflowStatus === 'ARCHIVED'
```

### Se Smart Chart nao carrega

Confirmar que `TaurusSmartChartPage.jsx` filtra:

```js
session.athleteName === currentAthlete
session.workflowStatus === 'APPROVED'
```

Se houver risco de variacao em espacos/caixa, normalizar:

```js
normalizeAthleteName(session.athleteName) === normalizeAthleteName(currentAthlete)
```

## Validacao final obrigatoria

Executar:

```powershell
npm.cmd run build
```

Depois validar manualmente:

```text
Taurus Target -> Humanoide -> Save
Admin -> Pending -> Approve
Smart Chart -> HUMANOIDE -> grafico aparece
```

## Resultado esperado

Ao final:

- sessoes TAURUS persistem ao recarregar a pagina
- Admin exibe Pending/Approved/Archived corretamente
- Smart Chart exibe sessoes aprovadas de `CAMPOS, FABIO`
- grafico Humanoide carrega
- tempo dos 20 disparos aparece no grafico e na tabela
- Humanoide continua consumindo apenas treinos humanoides da library

## Proximos passos depois do diagnostico

Executar nesta ordem, sem pular etapas:

### Passo 1 - Confirmar onde os dados foram salvos

Objetivo:

- descobrir se as sessoes de ontem estao em outro origin (`localhost` vs `127.0.0.1`) ou se realmente nao foram gravadas.

Acao:

- abrir DevTools em `http://localhost:5173`
- abrir DevTools em `http://127.0.0.1:5173`
- comparar `IndexedDB > TAURUS_TARGET_DB_V1`

Done:

- saber em qual origin esta o banco com dados, ou confirmar que o banco nao tem sessoes TAURUS.

### Passo 2 - Tornar o origin canonico

Objetivo:

- impedir perda aparente de dados por alternancia de endereco.

Acao:

- escolher um endereco padrao para desenvolvimento.
- recomendacao: `http://127.0.0.1:5173`
- documentar no README ou na proxima SPEC ativa.

Done:

- todos os testes TAURUS passam a usar o mesmo origin.

### Passo 3 - Validar save real do Humanoide

Objetivo:

- provar que uma sessao nova entra no banco e aparece no Admin.

Acao:

- criar uma sessao `Taurus Target > Humanoide`
- preencher zonas, `Max shots = 20`, `Tempo dos 20 disparos (s)`
- salvar
- verificar `PENDING HCI TAURUS REVIEWS`

Done:

- sessao aparece como `PENDING`.

### Passo 4 - Validar workflow Admin

Objetivo:

- provar `PENDING -> APPROVED`.

Acao:

- aprovar a sessao no Admin.
- confirmar que ela sai de Pending e entra em `HCI TAURUS RESULTS`.

Done:

- sessao com `workflowStatus = APPROVED`.

### Passo 5 - Validar Smart Chart Humanoide

Objetivo:

- provar que o visualizador consome somente sessoes aprovadas.

Acao:

- abrir `Smart Chart > HUMANOIDE`
- confirmar:
  - grafico desenha ponto
  - card de tempo mostra valor
  - tabela mostra `Tempo` e `Predicao tempo`
  - treino principal e Humanoide, nao Duelo 20

Done:

- Humanoide fecha ponta a ponta.

### Passo 6 - Ajustar grafico Humanoide

Objetivo:

- terminar a leitura visual do tempo.

Estado atual:

- foi solicitado eixo/régua de tempo de `0 a 20 segundos`.
- devem existir colunas de tempo correlacionadas aos pontos.
- linhas devem ser suavizadas, sem quebras anguladas.

Arquivos:

```text
src/components/taurus/TaurusSmartChart.jsx
src/index.css
```

Done:

- grafico mostra:
  - eixo de eficiencia em %
  - eixo/régua de tempo em segundos
  - colunas de tempo
  - linha de eficiencia suavizada
  - linha logaritmica de predicao suavizada

### Passo 7 - Aguardar diretrizes para Cartoes e Duelo

Objetivo:

- nao inventar regra antes da decisao do usuario.

Nao fazer ainda:

- nao aplicar regra de tempo em Cartoes Coloridos
- nao aplicar regra de tempo em Duelo 20
- nao alterar recomendacao de treino de Cartoes/Duelo sem diretriz

## Mapa dos MDs correspondentes

Use estes arquivos como fonte de contexto. Abrir somente o que for necessario para a tarefa atual.

### Entrada principal desta tarefa

```text
src/contracts/TAURUS_SESSION_PERSISTENCE_LOSS_DEBUG_SPEC_2026-06-26.md
```

Uso:

- diagnosticar perda/ausencia de sessoes TAURUS
- validar IndexedDB, Admin e Smart Chart
- orientar correcao do fluxo Humanoide

### Base historica do TAURUS Target

```text
src/contracts/CHATGPT_MIGRATION_SPEC_TAURUS_TARGET_2026-06-23.md
```

Uso:

- entender a separacao TAURUS vs HCI Target mock
- preservar `TAURUS_TARGET_DB_V1`
- preservar alvo humanoide real
- evitar reconstruir TaurusTarget do zero

### Dashboard comparativo e Smart Chart TAURUS

```text
src/contracts/TAURUS_ATHLETE_PERSISTENCE_AND_COMPARATIVE_DASHBOARD_SPEC_2026-06-25.md
```

Uso:

- entender o objetivo do dashboard/Smart Chart
- comparar alvos TAURUS por atleta
- validar que indicadores TAURUS sao proprios, nao copias ISSF
- orientar tabela/grafico/historico

### Migracao geral React/Admin/Sidebar

```text
src/contracts/CHATGPT_MIGRATION_SPEC_NEXT_5_HOURS_2026-06-23.md
```

Uso:

- contexto de Admin como fonte operacional
- sidebar e labels
- cuidado com mistura de idiomas e strings corrompidas

### Indices e Rhythm

```text
src/contracts/CHATGPT_MIGRATION_SPEC_INDICES_2026-06-23.md
```

Uso:

- somente se a tarefa tocar Indices/Rhythm.
- nao usar para reabrir Rhythm durante trabalho TAURUS.

### Arquitetura de metricas derivadas

```text
src/contracts/HCI_DERIVED_METRICS_ARCHITECTURE_2026-06-23.md
```

Uso:

- somente se for necessario entender metricas derivadas HCI.
- Smart Chart TAURUS deve manter indicadores proprios.

### Schema unificado HCI

```text
src/contracts/UNIFIED_SCHEMA_MASTER_V1.md
src/contracts/README_SPEC_V4_1.md
```

Uso:

- somente para contexto do snapshot HCI/ISSF.
- nao mover sessoes TAURUS para schema ISSF.

## Ordem recomendada de leitura para ChatGPT

1. `TAURUS_SESSION_PERSISTENCE_LOSS_DEBUG_SPEC_2026-06-26.md`
2. `CHATGPT_MIGRATION_SPEC_TAURUS_TARGET_2026-06-23.md`
3. `TAURUS_ATHLETE_PERSISTENCE_AND_COMPARATIVE_DASHBOARD_SPEC_2026-06-25.md`
4. Abrir arquivos de codigo indicados na secao "Arquivos envolvidos"

## Frase de retomada sugerida

```text
Continue o diagnostico TAURUS em C:\HCI_REACT_WEB\REACT_WEB_TAURUS usando src/contracts/TAURUS_SESSION_PERSISTENCE_LOSS_DEBUG_SPEC_2026-06-26.md como entrada principal. Primeiro confirme se as sessoes TAURUS sumiram por diferenca de origin localhost vs 127.0.0.1. Nao reconstruir TaurusTarget, nao misturar com ISSF e nao alterar Cartoes/Duelo sem novas diretrizes.
```
