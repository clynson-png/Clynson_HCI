
# PLAN_12_SESSION_IMPLEMENTATION_AUDIT_2026-06-28

## Passo 1 - Auditoria das ligacoes atuais

Status: concluido.

## O que foi verificado

- `src/App.jsx`
- `src/pages/PlanoPage.jsx`
- `src/services/trainingPlanEngine.js`
- `src/services/athleteViewMapper.js`
- `src/services/trainingLibraryService.js`
- paginas existentes em `src/pages`
- classes e fluxo premium/impressao existentes em `src/index.css` e `src/pages/TaurusTargetPage.jsx`

## Estado atual encontrado

### Aba Plano

`App.jsx` passa para `PlanoPage`:

- `snapshot`
- `lang`
- `athletes`
- `selectedAthlete`
- `onAthleteChange`

Mas `PlanoPage.jsx` atualmente declara apenas:

```js
function PlanoPage({ lang = 'pt' }) {
```

Consequencia: a aba Plano ignora `snapshot`, atleta selecionado e dados reais do atleta.

### Motor de prescricao

`trainingPlanEngine.js` ja possui funcoes de entrada/saida:

- `buildTrainingPlanEngineInput`
- `selectRecommendedTrainings`
- `buildTrainingPlanOutput`

Mas `PlanoPage.jsx` nao importa nem chama esse motor. Hoje ela cria recomendacoes com:

```js
const engineRecommendations = filteredTrainings.slice(0, 3)
```

Consequencia: a aba Plano ainda e uma vitrine filtrada da biblioteca, nao uma prescricao real do motor.

### Dados do atleta

`athleteViewMapper.js` ja materializa dados reais do atleta:

- `indices.allParameters`
- `summary`
- `trainingPlan.coachPrescriptions`
- `trainingPlan.prescribedTrainings`
- `reports`

Esse mapper e o caminho certo para derivar os piores rendimentos.

### Persistencia

O snapshot ativo ja tem campo canonico de prescricoes:

- `snapshot.prescriptions`

`AdminPage.jsx` ja grava prescricoes nesse caminho. `PlanoPage.jsx` ainda nao grava no snapshot; usa estado local:

```js
const [approvedTrainings, setApprovedTrainings] = useState([])
```

Consequencia: aprovacao na aba Plano se perde ao trocar/recarregar e nao alimenta relatorio.

### Relatorio premium

Neste checkout nao existe `src/pages/ReportPage.jsx`.

Superficie premium/imprimivel existente:

- `TaurusTargetPage.jsx` usa `window.print()`
- `index.css` ja tem classes premium/report, como `taurus-report-card`, `taurus-premium-card`, `report-prescription-card`, e regras `@media print`

Consequencia: para cumprir a SPEC, a implementacao deve criar uma superficie de relatorio premium para Plano ou incorporar o bloco imprimivel dentro da propria aba Plano.

## Decisao tecnica recomendada

Executar em blocos pequenos:

1. Atualizar `trainingPlanEngine.js` com funcoes puras:
   - detectar dois piores rendimentos;
   - montar distribuicao 7/5;
   - montar calendario de 12 sessoes.
2. Atualizar `PlanoPage.jsx` para consumir `snapshot` e `selectedAthlete`.
3. Renderizar o calendario premium de 12 dias na aba Plano.
4. Adicionar aprovacao persistente em `snapshot.prescriptions`.
5. Adicionar bloco imprimivel premium na propria aba Plano, usando `window.print()` e CSS existente.

## Adendo - Diretrizes TAURUS e separacao por alvo

Status: concluido.

Pedido do usuario: verificar contratos para garantir que treinos especificos de Duelo, Cartoes Coloridos e Humanoide nao sejam misturados de forma alguma.

Fontes verificadas:

- `src/contracts/TAURUS_SESSION_PERSISTENCE_LOSS_DEBUG_SPEC_2026-06-26.md`
- `src/contracts/TAURUS_ATHLETE_PERSISTENCE_AND_COMPARATIVE_DASHBOARD_SPEC_2026-06-25.md`
- `src/services/taurusSmartChartEngine.js`

Regra confirmada:

- Humanoide tem biblioteca propria:
  - `category === 'HUMANOID'`
  - `targetType === 'DEFENSE_HUMANOID'`
  - `trainingType === 'TARGET_BASIC'`
  - `weaponClass === 'HUMANOID_BASIC'`
  - `phase === 'GENERAL_PREPARATION'`
- Cartoes Coloridos tem biblioteca propria:
  - `category === 'COLOR_CARD'`
  - `targetType === 'PRECISION_COLOR'`
  - `trainingType === 'TARGET_BASIC'`
  - `weaponClass === 'COLOR_CARD_BASIC'`
  - `phase === 'GENERAL_PREPARATION'`
- Duelo 20 tem biblioteca propria:
  - `category === 'DUEL_20'`
  - `targetType === 'DUEL_20'`
  - `trainingType === 'TECHNICAL'`
  - `weaponClass === 'PISTOL'`
  - `phase === 'SPECIFIC_PREPARATION'`

Regra de implementacao para o Plano:

- se o plano estiver em modo HCI/ISSF geral, nao pode puxar treinos TAURUS;
- se o plano estiver em modo TAURUS, deve exigir `targetType` explicito;
- quando `targetType` for Humanoide, so pode usar treinos Humanoide;
- quando `targetType` for Cartoes Coloridos, so pode usar treinos Cartoes Coloridos;
- quando `targetType` for Duelo 20, so pode usar treinos Duelo 20;
- nunca usar fallback geral que misture `DEFENSE_HUMANOID`, `PRECISION_COLOR` e `DUEL_20`.

Essa trava deve entrar no motor antes da montagem do calendario.

## Adendo - Desempenho individualizado por tipo de card/alvo

Status: concluido.

Nova diretriz do usuario:

> A leitura de desempenho tem que ser individualizada por tipo de card. Uma leitura de Duelo nao pode servir para prescricao de Humanoide e nem vice versa.

Reanalise dos motores:

### Pontos corretos ja existentes

Existem analisadores separados por alvo:

- `src/services/taurusHumanoidIntelligence.js`
- `src/services/taurusColorIntelligence.js`
- `src/services/taurusDuelIntelligence.js`

Cada analisador:

- infere seu proprio `parameter`;
- busca treino apenas na biblioteca do proprio alvo;
- gera relatorio e insights especificos daquele tipo de sessao.

No `src/services/taurusSmartChartEngine.js`, a selecao principal de parametro tambem chama o analisador certo:

- `HUMANOID` -> `analyzeTaurusHumanoidSession`
- `COLOR` -> `analyzeTaurusColorSession`
- `DUEL20` -> `analyzeTaurusDuelSession`

### Risco encontrado

O `taurusSmartChartEngine.js` ainda mantem algumas funcoes genericas de historico:

- `buildTaurusHistoryRow`
- `calculateSessionIndex`
- `getBiggestOpportunity`

Essas funcoes calculam campos como `indexValue`, `dominantZone` e `biggestOpportunity` dentro de uma logica compartilhada. Mesmo havendo ramificacoes por `session.targetType`, o Plano nao deve usar esses campos genericos como leitura de prescricao entre alvos.

Regra nova:

- `latest.biggestOpportunity` so pode ser fallback visual dentro do mesmo alvo, nunca fonte principal de prescricao.
- a prescricao TAURUS deve usar `latestSessionReport.parameter`, gerado pelo analisador especifico do alvo.
- se nao houver `latestSessionReport` para o alvo selecionado, o plano deve exibir `INSUFFICIENT_TARGET_DATA`, nao puxar leitura de outro alvo.
- a leitura de Duelo 20 nunca pode alimentar Humanoide ou Cartoes Coloridos.
- a leitura de Humanoide nunca pode alimentar Duelo 20 ou Cartoes Coloridos.
- a leitura de Cartoes Coloridos nunca pode alimentar Humanoide ou Duelo 20.

### Implicacao para a aba Plano

O motor do Plano deve receber contexto explicito:

```js
{
  planDomain: 'ISSF_HCI' | 'TAURUS',
  targetType: null | 'HUMANOID' | 'COLOR' | 'DUEL20',
  performanceSource: 'ATHLETE_HCI_PARAMETERS' | 'TAURUS_HUMANOID_REPORT' | 'TAURUS_COLOR_REPORT' | 'TAURUS_DUEL20_REPORT'
}
```

Para `planDomain: 'TAURUS'`, o Plano deve:

1. filtrar sessoes aprovadas do atleta pelo `targetType` selecionado;
2. rodar somente o analisador daquele alvo;
3. montar piores rendimentos apenas a partir daquele relatorio;
4. buscar treinos somente na biblioteca daquele alvo;
5. se nao houver dados daquele alvo, bloquear a prescricao daquele alvo.

Para `planDomain: 'ISSF_HCI'`, o Plano deve:

1. usar `athleteView.indices.allParameters`;
2. ignorar treinos TAURUS;
3. nao usar historico Duelo/Humanoide/Color como fonte de score.

### Ajuste recomendado antes da implementacao

Antes de criar calendario 12 sessoes, adicionar uma funcao pura no motor:

```js
resolvePlanPerformanceContext({ athleteView, targetType, taurusSessions })
```

Essa funcao deve devolver:

- `domain`
- `targetType`
- `performanceSource`
- `eligibleParameters`
- `blockedReason`, quando nao houver dados suficientes

Nenhum calendario deve ser montado sem esse contexto.

## Adendo - Tempo como fator de desempenho e prescricao

Status: concluido.

Nova diretriz do usuario:

> A medida de tempo nao existia antes, precisa entrar como fator de decisao para o melhor ou pior desempenho, bem como entrar nos treinos.

### Impacto sobre diretrizes anteriores

O contrato `TAURUS_SESSION_PERSISTENCE_LOSS_DEBUG_SPEC_2026-06-26.md` registrava que nao deveria ser aplicada regra de tempo em Cartoes Coloridos e Duelo 20 sem nova diretriz.

Esta nova diretriz substitui essa pendencia:

- tempo agora deve entrar na decisao de desempenho;
- tempo agora deve entrar na prescricao dos treinos;
- a regra continua individualizada por alvo;
- tempo de Duelo nao pode influenciar Humanoide ou Cartoes;
- tempo de Humanoide nao pode influenciar Duelo ou Cartoes;
- tempo de Cartoes nao pode influenciar Humanoide ou Duelo.

### Estado atual encontrado no codigo

O dado de tempo ja aparece no fluxo TAURUS:

- `TaurusTargetPage.jsx` coleta `durationSeconds` para Humanoide e Cartoes.
- `TaurusTargetPage.jsx` coleta `seriesTimeSeconds` por serie em Duelo 20.
- `taurusTargetStore.js` preserva `durationSeconds`.
- `taurusSmartChartEngine.js` usa `durationSeconds` em timeline e predicao visual.
- `taurusColorIntelligence.js` usa `durationSeconds` para modelo visual de tempo.
- `taurusDuelIntelligence.js` inclui `timeSeconds` por serie nas metricas e relatorio.

Mas o tempo ainda nao esta consolidado como fator formal para escolher melhor/pior desempenho no Plano.

### Regra nova por alvo

#### Humanoide

Fonte temporal:

- `session.durationSeconds`

Leitura de desempenho:

- melhor desempenho: maior eficiencia de zonas prioritarias com tempo controlado ou menor tempo sem perda de qualidade;
- pior desempenho: baixa eficiencia com tempo alto, tempo alto recorrente, ou reducao brusca de tempo acompanhada de dispersao/perda de Alpha.

Tempo deve entrar como fator secundario junto com:

- percentual Alpha;
- percentual Charlie/Delta;
- disparos sem registro;
- dispersao periférica.

#### Cartoes Coloridos

Fonte temporal:

- `session.durationSeconds`

Leitura de desempenho:

- melhor desempenho: equilibrio entre cores com tempo controlado;
- pior desempenho: desequilibrio de cores, falha de reconhecimento, disparos sem registro ou tempo alto para completar a tarefa.

Tempo deve entrar como fator ligado a:

- reconhecimento visual;
- troca de referencia;
- decisao antes do disparo.

#### Duelo 20

Fontes temporais:

- `session.durationSeconds`, quando existir;
- `shotDetails[].seriesTimeSeconds`, fonte preferencial para tempo por serie.

Leitura de desempenho:

- melhor desempenho: pontuacao relativa alta, consistencia entre series e tempo por serie estavel;
- pior desempenho: baixa pontuacao, grande variacao entre series, direcao critica recorrente ou tempo por serie ruim/instavel.

Tempo deve entrar como fator ligado a:

- ritmo de serie;
- manutencao de processo sob tempo;
- variacao de performance entre blocos.

### Requisito para o motor do Plano

O contexto de performance deve passar a incluir:

```js
{
  timing: {
    source: 'NONE' | 'SESSION_DURATION' | 'SERIES_TIME',
    valueSeconds: number | null,
    trend: 'IMPROVING' | 'STABLE' | 'DECLINING' | 'INSUFFICIENT_DATA',
    decisionWeight: 'PRIMARY' | 'SECONDARY'
  }
}
```

Para `ISSF_HCI`, tempo deve continuar entrando via `RHYTHM` quando for dado derivado de ritmo, sem inventar cronometro inexistente.

Para `TAURUS`, tempo deve entrar como campo proprio do desempenho do alvo.

### Requisito para os treinos

Cada card do plano deve poder mostrar uma orientacao temporal quando o alvo/tipo de treino tiver tempo disponivel:

- tempo alvo;
- tempo observado;
- foco temporal do dia;
- cue de ritmo/decisao sob tempo.

Exemplo:

```js
timingPrescription: {
  observed: 'SR2 5.4s',
  focus: 'reduzir variacao entre series sem perder pontuacao',
  cue: 'Execute dentro do tempo planejado, mas nao sacrifique processo por velocidade.'
}
```

### Aceite adicional

- o Plano nao pode classificar melhor/pior desempenho TAURUS ignorando tempo quando o tempo existir;
- o Plano nao pode usar tempo de um tipo de alvo para prescrever outro;
- cards de treino TAURUS devem exibir foco temporal quando houver `durationSeconds` ou `seriesTimeSeconds`;
- ausencia de tempo deve aparecer como `INSUFFICIENT_TIMING_DATA`, nao como zero.

## Adendo - Proibido usar dados ISSF nas leituras HCI TAURUS

Status: concluido.

Nova diretriz do usuario:

> Os dados ISSF nao podem ser usados para as leituras HCI TAURUS.

Contratos confirmados:

- `TAURUS_ATHLETE_PERSISTENCE_AND_COMPARATIVE_DASHBOARD_SPEC_2026-06-25.md` diz que TAURUS e produto separado, usa `TAURUS_TARGET_DB_V1`, e que `Indice` e `Ritmo` ISSF nao entram no sidebar TAURUS.
- O mesmo contrato diz que o dashboard TAURUS pode se inspirar visualmente no ritmo ISSF, mas deve usar eficiencia por alvo e leitura de treino tatico, nao metrica ISSF.
- `TAURUS_SESSION_PERSISTENCE_LOSS_DEBUG_SPEC_2026-06-26.md` reforca: nao misturar TAURUS com sessoes ISSF e nao mover sessoes TAURUS para schema ISSF.

Regra absoluta para o Plano:

- `ISSF_HCI` pode usar `athleteView.indices.allParameters`, `sessionHeaders`, `sessionSeries`, `sessionShots`, `shotSeries` e metricas derivadas ISSF.
- `HCI_TAURUS` nao pode usar `athleteView.indices.allParameters` nem scores ISSF.
- `HCI_TAURUS` deve usar somente sessoes TAURUS aprovadas vindas de `TAURUS_TARGET_DB_V1` via `taurusTargetStore`.
- leituras HCI TAURUS devem vir dos motores:
  - `taurusHumanoidIntelligence.js`
  - `taurusColorIntelligence.js`
  - `taurusDuelIntelligence.js`
- visualmente, TAURUS pode reaproveitar padroes de dashboard/relatorio, mas os dados, scores e parametros decisorios nao podem vir do ISSF.

Implicacao para `resolvePlanPerformanceContext`:

```js
if (planDomain === 'HCI_TAURUS') {
  // proibido ler athleteView.indices.allParameters
  // obrigatorio ler somente sessoes TAURUS do alvo selecionado
}
```

Qualquer tentativa de montar plano TAURUS sem sessoes TAURUS aprovadas deve retornar:

```js
{
  blockedReason: 'INSUFFICIENT_TAURUS_TARGET_DATA'
}
```

Nao usar fallback para ISSF.

## Adendo - Atleta real de teste

Atleta definido pelo usuario para testes: `OLIVEIRA, CLYNSON`.

Dados reais lidos de `public/snapshot_v3_4_1.json` com normalizacao somente em memoria dos escapes do arquivo:

- prova: `PISTOL`
- HCI: `3.43`
- nivel: `INICIANTE`
- latestTotal: `531`
- medianTotal: `552`
- sessionsCount: `3`

Parametros:

| Parametro | Score | Nivel |
|---|---:|---|
| TRANSFER | 0 | SEM BASELINE |
| OUTCOME | 1.87 | INICIANTE |
| PROCESS | 2.33 | INICIANTE |
| DEEPENING | 2.86 | INICIANTE |
| EMOTIONAL | 3.1 | INTERMEDIARIO |
| RHYTHM | 4.77 | INICIANTE |
| CONSISTENCY | 5.1 | INTERMEDIARIO |
| PRESSURE | 6.23 | ALTO RENDIMENTO |
| RESILIENCE | 7 | ALTO RENDIMENTO |
| PHYSICAL | 10 | ELITE |

Decisao pendente antes de implementar o ranking dos dois piores:

- `TRANSFER = 0` esta marcado como `SEM BASELINE`.
- O motor deve decidir se `SEM BASELINE` entra como pior rendimento ou se deve ser ignorado por falta de base comparativa.
- Se ignorar `SEM BASELINE`, os dois piores de `OLIVEIRA, CLYNSON` sao `OUTCOME` e `PROCESS`.
- Se incluir `SEM BASELINE`, os dois piores sao `TRANSFER` e `OUTCOME`.

## Adendo - Motores novos TAURUS com logica ISSF, sem parametrizacao ISSF

Correcao de arquitetura:

- `HCI_TAURUS` nao deve montar decisao com a parametrizacao ISSF;
- a logica ISSF pode orientar a forma de decidir pior rendimento, estabilidade, agrupamento, tendencia, tempo e prescricao corretiva;
- os nomes de parametros ISSF nao podem ser a saida dos motores TAURUS;
- Duelo, Humanoide e Cartoes Coloridos precisam ter vocabulario proprio por alvo/card.

Implementacao iniciada:

- criado `src/services/taurusDecisionEngines.js`;
- novo dominio declarado: `HCI_TAURUS`;
- parametros TAURUS proprios:
  - `TAURUS_HUMANOID_POSITION`;
  - `TAURUS_HUMANOID_AIMING`;
  - `TAURUS_HUMANOID_TRIGGERING`;
  - `TAURUS_HUMANOID_GRIP`;
  - `TAURUS_COLOR_IDENTIFICATION`;
  - `TAURUS_COLOR_AIMING`;
  - `TAURUS_COLOR_TRIGGERING`;
  - `TAURUS_COLOR_GRIP`;
  - `TAURUS_COLOR_POSITION`;
  - `TAURUS_DUEL_BASE_REBUILD`;
  - `TAURUS_DUEL_SERIES_STABILITY`;
  - `TAURUS_DUEL_DIRECTIONAL_CONTROL`;
  - `TAURUS_DUEL_CENTER_RETENTION`;
  - `TAURUS_DUEL_TIMING_CONTROL`.

Observacao operacional:

- a ponte de compatibilidade ainda pode localizar treinos antigos na biblioteca quando estes estiverem com `TARGET_*` ou parametros legados;
- isso nao significa decisao por ISSF;
- a saida do motor TAURUS deve permanecer `TAURUS_*`.

## Entrega deste passo

Nenhum comportamento foi alterado. Esta etapa apenas registrou a auditoria e o caminho de implementacao.
