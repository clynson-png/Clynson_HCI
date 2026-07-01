# HCI Unified Schema Master V1

Native system language: English.  
Lingua nativa do sistema: Ingles.

All JSON keys, SQL fields, internal enums and API payloads must use English.  
Todas as chaves JSON, campos SQL, enums internos e payloads de API devem usar ingles.

Portuguese must exist as a UI translation layer, labels, help text and documentation mirror.  
O portugues deve existir como camada de traducao de interface, rotulos, textos de ajuda e espelho documental.

## Goal

One single schema must serve:
- data entry
- persistence
- summary/viewer rendering
- athlete export packages

Um unico schema deve servir:
- entrada de dados
- persistencia
- renderizacao do resumo/visualizador
- pacotes de exportacao do atleta

## Core Rule

The storage model must stop mixing Portuguese and English field names.  
O modelo de armazenamento deve parar de misturar nomes de campos em portugues e ingles.

Target convention:
- English keys in storage and transport
- Portuguese labels only in UI/documentation

Convencao alvo:
- chaves em ingles na persistencia e no transporte
- rotulos em portugues apenas na UI/documentacao

## Master Mapping Table

| Domain | Target entity / Entidade alvo | Target key / Chave alvo | Current variants found / Variantes atuais encontradas | English meaning | Portugues |
|---|---|---|---|---|---|
| Athlete identity | `athlete` | `athleteId` | `leadId`, derived athlete name | Stable athlete identifier | Identificador estavel do atleta |
| Athlete identity | `athlete` | `athleteName` | `athleteName`, `athlete`, `atleta` | Athlete full display name | Nome completo exibido do atleta |
| Athlete identity | `athlete` | `athleteEmail` | `athleteEmail`, email from leads | Athlete e-mail | E-mail do atleta |
| Session header | `sessionHeader` | `sessionId` | `sessionId`, `idBloco`, derived composite key | Stable session identifier | Identificador estavel da sessao |
| Session header | `sessionHeader` | `eventCode` | `event`, `evento` | Event code like `EV1` | Codigo do evento como `EV1` |
| Session header | `sessionHeader` | `sessionType` | `sessionType`, `session`, `sessao` | `TRAINING`, `SIMULATION`, `COMPETITION` | `TREINO`, `SIMULADO`, `COMPETICAO` na interface |
| Session header | `sessionHeader` | `modality` | `modality`, `prova` | `PISTOL` or `RIFLE` | `PISTOL` ou `RIFLE` |
| Session header | `sessionHeader` | `sessionDate` | `date`, `dataColeta`, `data` | Session date/time | Data/hora da sessao |
| Session header | `sessionHeader` | `sourceType` | `source`, `sourceType` | Data origin | Origem do dado |
| Session header | `sessionHeader` | `sessionStatus` | pending/approved/archive split by arrays | Current lifecycle state | Estado atual do ciclo de vida |
| Session header | `sessionHeader` | `reviewStatus` | `complete`, dismissed key list, admin flags | Review workflow state | Estado do fluxo de revisao |
| Session header | `sessionHeader` | `seriesCount` | `seriesCount`, derived | Number of series | Numero de series |
| Session header | `sessionHeader` | `shotCount` | `shotCount`, derived | Number of shots | Numero de disparos |
| Session header | `sessionHeader` | `totalScore` | `total`, derived totals | Session total score | Total da sessao |
| Session series | `sessionSeries` | `seriesId` | `chaveSerie`, derived | Stable series identifier | Identificador estavel da serie |
| Session series | `sessionSeries` | `seriesCode` | `serie` | `SR1` to `SR6` | `SR1` a `SR6` |
| Session series | `sessionSeries` | `seriesOrder` | `hciSerieOrder` | Ordered position of series | Ordem da serie |
| Session series | `sessionSeries` | `eventStatus` | `statusEvento` | `PARTIAL` or `FINAL` | `PARCIAL` ou `FINAL` na interface |
| Session series | `sessionSeries` | `seriesTotal` | `total`, derived from shots | Total score of series | Total da serie |
| Session series | `sessionSeries` | `shotValuesCsv` | `tiros` | CSV of shot values | CSV de valores dos disparos |
| Session shot | `sessionShot` | `shotNumber` | position in arrays | Shot order inside series | Ordem do disparo na serie |
| Session shot | `sessionShot` | `score` | values inside `scores`, inside `tiros` | Individual shot score | Valor individual do disparo |
| Session shot | `sessionShot` | `directionCode` | `directions`, `direction` | Direction/quadrant code | Codigo de direcao/quadrante |
| Session shot | `sessionShot` | `xValue` | `x` | Cartesian X if present | X cartesiano se existir |
| Session shot | `sessionShot` | `yValue` | `y` | Cartesian Y if present | Y cartesiano se existir |
| Session shot | `sessionShot` | `innerTen` | `innerTen` | Inner ten flag | Marcacao de inner ten |
| Pending ISSF | `sessionHeader` | `sessionStatus` | `pendingGroups`, audit incomplete rows | Pending review session | Sessao pendente de revisao |
| Approved ISSF | `sessionHeader` | `sessionStatus` | rows living in `shotSeries` | Approved active session | Sessao aprovada ativa |
| Archived ISSF | `sessionHeader` | `sessionStatus` | `archivedIssfSessions` | Archived non-graph session | Sessao arquivada fora do grafico |
| Pending target | `targetSession` | `sessionStatus` | `targetSessions` | Pending target intelligence session | Sessao HCI target pendente |
| Approved target | `targetSession` | `sessionStatus` | `approvedTargetSessions` | Approved active target session | Sessao HCI target aprovada |
| Archived target | `targetSession` | `sessionStatus` | `archivedTargetSessions` | Archived target session | Sessao HCI target arquivada |
| Training output | `prescription` | `trainingCode` | `code` | Training code | Codigo do treino |
| Training output | `prescription` | `trainingTitle` | `trainingTitle` | Training title | Titulo do treino |
| Training output | `prescription` | `blockCode` | `block` | Plan block | Bloco do plano |
| Viewer aggregate | `athleteView` | `parameters` | `athlete360.parameters` | HCI parameter readings | Leituras dos parametros HCI |
| Viewer aggregate | `athleteView` | `sessions` | `athlete360.sessions` | Renderable session history | Historico renderizavel de sessoes |

## Unified Input Contracts

### 1. Manual ISSF entry

Target payload:

```json
{
  "athleteId": "string",
  "athleteName": "string",
  "eventCode": "EV1",
  "sessionType": "TRAINING",
  "modality": "PISTOL",
  "sessionDate": "2026-06-23",
  "sourceType": "MANUAL_ADMIN",
  "sessionStatus": "APPROVED",
  "reviewStatus": "REVIEWED",
  "shots": [
    {
      "seriesCode": "SR1",
      "shotNumber": 1,
      "score": 10.2,
      "directionCode": "CENTER"
    }
  ]
}
```

Portuguese UI mirror:
- `sessionType`: `TREINO`, `SIMULADO`, `COMPETICAO`
- `directionCode`: translated only on screen if needed

### 2. HCI IA import result

Target payload:

```json
{
  "sourceType": "HCI_IA_RESULT",
  "athleteId": "string|null",
  "athleteName": "string",
  "eventCode": "EV1",
  "sessionType": "TRAINING",
  "modality": "RIFLE",
  "sessionDate": "2026-06-23",
  "sessionStatus": "PENDING_REVIEW",
  "reviewStatus": "PENDING",
  "shots": []
}
```

### 3. Target intelligence entry

Target payload:

```json
{
  "targetSessionId": "string",
  "athleteId": "string",
  "athleteName": "string",
  "eventCode": "EV1",
  "sessionType": "TRAINING",
  "modality": "PISTOL",
  "targetType": "DUEL20",
  "totalShots": 20,
  "zoneLabels": ["Q1", "Q2", "Q3", "Q4"],
  "zoneCounts": [3, 7, 5, 5],
  "recommendedTrainingCode": "TR001",
  "recommendedTrainingLabel": "Trigger control",
  "sessionStatus": "PENDING_REVIEW",
  "sourceType": "TARGETSCAN_ADMIN"
}
```

## Unified Persistence Rule

The SQL layer must store one concept once.

English storage entities:
- `athlete`
- `session_header`
- `session_series`
- `session_shot`
- `target_session`
- `prescription`
- `athlete_view_cache`
- `export_package`

Rules:
1. `shotSeries` becomes compatibility output, not primary truth.
2. `athlete360` becomes derived/cache output, not primary truth.
3. Pending, approved and archived must be states, not separate incompatible schemas.
4. Arrays split by screen convenience must not define data truth.

Camada SQL unica:
1. `shotSeries` vira saida de compatibilidade, nao verdade primaria.
2. `athlete360` vira saida derivada/cache, nao verdade primaria.
3. Pendente, aprovado e arquivado devem ser estados, nao schemas separados e incompativeis.
4. Arrays separados por conveniencia de tela nao devem definir a verdade do dado.

## Unified Viewer Rule

Resumo, Admin and Athlete View must read from the same canonical entities.

Rendering adapters may shape:
- cards
- charts
- dropdowns
- export packages

But they must not rename the stored meaning of fields.

Resumo, Admin e Athlete View devem ler das mesmas entidades canonicas.

Adaptadores de renderizacao podem montar:
- cards
- graficos
- listas
- pacotes de exportacao

Mas nao podem renomear o significado armazenado dos campos.

## Portuguese Translation Layer

Recommended bilingual dictionary:

| English code | Portuguese UI |
|---|---|
| `TRAINING` | `TREINO` |
| `SIMULATION` | `SIMULADO` |
| `COMPETITION` | `COMPETICAO` |
| `PENDING_REVIEW` | `PENDENTE` |
| `APPROVED` | `APROVADO` |
| `ARCHIVED` | `ARQUIVADO` |
| `DELETED` | `DELETADO` |
| `eventCode` | `evento` |
| `sessionType` | `sessao` |
| `modality` | `disciplina` |
| `sessionDate` | `data` |
| `totalScore` | `total` |
| `seriesCode` | `serie` |
| `directionCode` | `direcao` |

## Immediate Migration Priority

Priority 1:
- stop writing new mixed keys
- normalize all new Admin writes to English target keys first

Priority 2:
- persist canonical SQL entities
- derive `shotSeries` and `athlete360` from canonical SQL

Priority 3:
- retire compatibility arrays after all screens read from canonical adapters

## Decision Locked For This Project

Native data language: English.  
UI language set: English + Portuguese.  
React Admin, Resumo and Athlete Viewer must speak the same schema.  
SQL must be the single truth source per license/tenant.
