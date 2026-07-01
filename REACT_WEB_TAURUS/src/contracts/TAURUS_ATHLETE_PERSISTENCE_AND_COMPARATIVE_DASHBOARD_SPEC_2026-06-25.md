# SPEC: Persistencia por Atleta e Dashboard Comparativo TAURUS

Data: 2026-06-25

Projeto: `C:\HCI_REACT_WEB\REACT_WEB_TAURUS`

## Objetivo

Organizar a persistencia dos dados de entrada TAURUS por atleta e construir um dashboard comparativo de treinos. O dashboard deve seguir a logica visual dos graficos de ritmo ISSF: comparar sessoes, mostrar evolucao, destacar tendencia e permitir leitura tecnica rapida. Mas os indicadores devem ser proprios dos alvos TAURUS, nao copias dos indicadores ISSF.

## Regras travadas

1. TAURUS continua sendo produto separado.
2. `TAURUS_TARGET_DB_V1` continua isolado.
3. Os dados de entrada devem ficar vinculados ao atleta.
4. As chaves internas continuam em ingles.
5. A interface em portugues deve ser limpa e sem mistura de idioma.
6. `Indice` e `Ritmo` ISSF nao entram no sidebar TAURUS.
7. Nao recriar mock HCI Target.
8. Nao apagar as telas antigas ainda; apenas nao usa-las no fluxo TAURUS.
9. A implementacao deve ser por partes, com validacao visual antes de avanco.

## Estado atual da persistencia

Arquivos:

- `src/services/taurusTargetSchema.js`
- `src/services/taurusTargetStore.js`
- `src/pages/TaurusTargetPage.jsx`

Banco atual:

- `TAURUS_TARGET_DB_V1`

Stores atuais:

- `taurus_target_session`
- `taurus_target_hit`

Campos ja existentes em `taurus_target_session`:

- `sessionId`
- `athleteName`
- `targetType`
- `sessionMode`
- `sessionLabel`
- `notes`
- `maxShots`
- `maxScore`
- `totalShots`
- `totalScore`
- `shotDetailsJson`
- `recordedAt`
- `updatedAt`

Campos ja existentes em `taurus_target_hit`:

- `hitId`
- `sessionId`
- `zoneCode`
- `zoneLabel`
- `hitCount`
- `displayOrder`
- `metaJson`

## Lacuna atual

O sistema salva sessoes TAURUS, mas ainda nao oferece uma leitura longitudinal por atleta.

Hoje a tela mostra:

- entrada manual
- saida da ultima sessao por tipo de alvo
- grafico individual do alvo
- relatorio tecnico da sessao

Ainda falta:

- comparar sessoes do mesmo atleta
- comparar os tres alvos TAURUS no tempo
- calcular tendencia por tipo de alvo
- destacar melhor treino, pior treino, queda, estabilidade e evolucao
- criar um dashboard que substitua a necessidade de `Ritmo` e `Indices` no fluxo TAURUS

## Modelo de leitura por atleta

O dashboard deve montar uma camada derivada em memoria, sem duplicar dados brutos.

Entrada:

- todas as sessoes de `loadTaurusTargetSessions()`

Agrupamento:

```text
athleteName
  HUMANOID
    sessions[]
  COLOR
    sessions[]
  DUEL20
    sessions[]
```

Ordem:

- mais recente primeiro para listas
- cronologica crescente para graficos de evolucao

## Indicadores por tipo de alvo

### Humanoide

Indicadores de comparacao:

- total de impactos
- percentual de Alfa
- percentual de Intermediaria
- percentual de Periferica
- zona dominante
- pior zona recorrente
- indice de eficiencia tática

Formula inicial proposta:

```text
indiceEficienciaTatica =
  (alfaHits * 1.0 + intermediariaHits * 0.55 + perifericaHits * 0.2) / totalHits
```

Leitura:

- quanto mais alto, melhor a concentracao nas zonas prioritarias
- quedas sucessivas indicam perda de controle, visada, gatilho ou decisao

### Cartoes Coloridos

Indicadores de comparacao:

- total de impactos
- distribuicao por cor
- cor mais falha
- equilibrio entre cores
- aderencia a regra LINADE 4 cores

Formula inicial proposta:

```text
equilibrioCores =
  1 - (desvioMedioEntreCores / maximoPorCor)
```

Leitura:

- melhor quando o atleta distribui os impactos com consistencia entre as cores
- queda indica falha de reconhecimento, transicao visual ou execucao sob tempo

### Duelo 20

Indicadores de comparacao:

- total de disparos lancados
- pontuacao total
- percentual da pontuacao maxima
- media por disparo
- direcao dominante de erro
- serie mais fraca
- variacao entre series

Formula inicial proposta:

```text
percentualPontuacao =
  totalScore / maxScore
```

```text
consistenciaSeries =
  1 - (desvioMedioDasSeries / mediaDasSeries)
```

Leitura:

- o grafico deve mostrar se o atleta cresce, cai ou oscila entre treinos
- a direcao dominante aponta tendencia tecnica de erro

## Dashboard proposto

Nova area dentro da pagina TAURUS:

```text
Entrada de Dados | Saida | Comparativo
```

Nome visivel da nova aba:

```text
Comparativo
```

## Como a tela deve ficar

### Estrutura visual

```text
ALVOS TAURUS

[Atleta ativo: CAMPOS, FABIO]

[Entrada de Dados] [Saida] [Comparativo]

------------------------------------------------------------
RESUMO DO ATLETA
------------------------------------------------------------
Treinos TAURUS     Ultimo treino     Melhor alvo     Tendencia
12                 25/06/2026        Duelo 20        Evoluindo

------------------------------------------------------------
EVOLUCAO POR TREINO
------------------------------------------------------------
Grafico de linha comparativo:

Data        Humanoide      Cores       Duelo 20
Treino 1       62%          70%          58%
Treino 2       68%          66%          61%
Treino 3       74%          72%          69%

Visual esperado:
- uma linha para Humanoide
- uma linha para Cartoes Coloridos
- uma linha para Duelo 20
- eixo X por data/treino
- eixo Y por eficiencia normalizada em %

------------------------------------------------------------
COMPARACAO DOS ALVOS
------------------------------------------------------------
[Humanoide]     [Cartoes Coloridos]     [Duelo 20]
Alfa: 54%       Equilibrio: 71%         Pontuacao: 166/200
Periferica: 9%  Cor critica: Azul       Direcao critica: NE
Tendencia: +    Tendencia: estavel      Tendencia: +

------------------------------------------------------------
ULTIMOS TREINOS
------------------------------------------------------------
Data        Alvo                Resultado principal    Leitura
25/06       Duelo 20            166/200                Evolucao
24/06       Humanoide           Alfa 54%               Estavel
23/06       Cartoes Coloridos   Equilibrio 71%         Atencao
```

### Inspiracao nos graficos de ritmo ISSF

Manter do ritmo ISSF:

- comparacao por treino
- leitura de tendencia
- linha temporal
- pontos de sessao
- destaque de queda ou evolucao

Adaptar para TAURUS:

- usar eficiencia por alvo, nao ritmo de serie ISSF
- usar zonas, cores e direcoes
- usar percentual normalizado para permitir comparar alvos diferentes
- mostrar leitura de treino tatico, nao metrica ISSF

## Componentes sugeridos

### 1. `TaurusComparativeDashboard`

Responsabilidade:

- receber sessoes ja carregadas
- filtrar pelo atleta ativo
- montar os blocos do comparativo

Entrada:

```js
{
  sessions,
  athleteName
}
```

Saida visual:

- resumo do atleta
- grafico de evolucao
- cards por alvo
- tabela de ultimos treinos

### 2. `buildTaurusAthleteComparison`

Responsabilidade:

- criar a leitura derivada por atleta
- nao persistir dados derivados
- nao alterar o banco

Entrada:

```js
sessions[]
athleteName
```

Saida:

```js
{
  athleteName,
  totals,
  timeline,
  targetSummaries,
  latestSessions,
}
```

### 3. `buildTaurusSessionScore`

Responsabilidade:

- converter cada sessao em score comparavel de 0 a 100

Regras:

- Humanoide: eficiencia tática normalizada
- Cartoes Coloridos: equilibrio e aderencia
- Duelo 20: percentual de pontuacao e consistencia

## Persistencia proposta

### Fase 1

Nao alterar schema.

Usar os campos atuais:

- `athleteName`
- `targetType`
- `sessionMode`
- `totalShots`
- `totalScore`
- `maxScore`
- `shotDetailsJson`
- `recordedAt`
- `hits`

Motivo:

- reduz risco
- aproveita dados ja salvos
- permite construir dashboard primeiro

### Fase 2

Se necessario, criar `athleteId` e `trainingBlockId`.

Campos candidatos futuros:

- `athleteId`
- `trainingBlockId`
- `trainingSessionNumber`
- `coachTag`
- `comparisonGroup`

Nao implementar agora sem aprovacao.

## Ordem de implementacao proposta

### Passo 1 - Visual estatico aprovado

Criar a aba `Comparativo` com layout estatico e dados derivados simples.

Done:

- aba aparece
- nao quebra Entrada/Saida
- mostra cards e tabela com sessoes reais se existirem

### Passo 2 - Motor derivado por atleta

Criar `buildTaurusAthleteComparison`.

Done:

- cada atleta tem timeline propria
- sessoes de outros atletas nao aparecem

### Passo 3 - Grafico de evolucao

Criar grafico de linha com eficiencia normalizada.

Done:

- Humanoide, Cartoes e Duelo aparecem juntos
- datas/sessoes aparecem em ordem
- cada ponto representa uma sessao real salva

### Passo 4 - Cards tecnicos por alvo

Criar resumo por alvo.

Done:

- melhor/pior tendencia por alvo
- zona/cor/direcao critica
- ultima leitura tecnica

### Passo 5 - Tabela de ultimos treinos

Criar tabela final.

Done:

- lista cronologica
- alvo
- resultado
- leitura
- botao futuro para abrir detalhes

## Validacao

Antes de considerar pronto:

1. `Alvos TAURUS` continua no sidebar.
2. `Ritmo` e `Indices` continuam fora do sidebar.
3. Entrada manual continua salvando.
4. Saida individual continua funcionando.
5. Comparativo filtra por atleta ativo.
6. Sessoes de outro atleta nao entram no mesmo grafico.
7. Build passa.
8. Interface PT nao tem texto quebrado.
9. Nenhum dado TAURUS volta para mock HCI Target.

## Decisao pendente para o usuario

Antes de iniciar codigo, aprovar:

1. A nova aba deve se chamar `Comparativo`?
2. O grafico principal deve comparar os tres alvos juntos em percentual?
3. A primeira versao pode usar apenas `athleteName`, sem criar `athleteId` agora?
4. O dashboard deve ficar dentro da pagina TAURUS atual, e nao em uma nova pagina do sidebar?

## Recomendacao

Implementar primeiro dentro da pagina TAURUS atual, como terceira aba:

```text
Entrada de Dados | Saida | Comparativo
```

Nao alterar schema na primeira entrega.

Usar o banco atual e derivar a comparacao em memoria.

Depois de aprovado visualmente, evoluir para novos campos de persistencia se o uso real pedir.
