# SPEC - HCI_109 Focus And Session Recording Before TAURUS Audio

Data: 2026-06-29

Status: historico fechado; fase obrigatoria concluida antes da fase TAURUS Audio

## Atualizacao Phase I - 2026-07-01

Este documento permanece como registro historico da ordem de implementacao.

Regra canonica atual:

```text
HCI_109 has no audio.
Audio belongs to Humanoide, Cartoes Coloridos, and Duelo 20.
```

As restricoes abaixo que falam em "antes de iniciar audio" foram cumpridas para liberar a frente TAURUS Audio. Elas nao significam que o HCI_109 passou a possuir audio.

## Decisao de ordem

Antes de iniciar qualquer implementacao de motor de audio dos alvos TAURUS, o fluxo HCI_109 deve fechar a fase de:

1. foco na maca / visada;
2. gravacao de sessao HCI - Ritmo;
3. gravacao de sessao HCI - Visada;
4. armazenamento local das sessoes;
5. preparacao para comparacao posterior;
6. graficos comparativos de Ritmo e Visada.

Somente depois dessa fase estar aprovada a implementacao de audio dos alvos TAURUS pode comecar.

## Correcao De Escopo - Audio Nao Pertence Ao HCI_109

Audio nao faz parte do HCI_109.

O audio pertence aos alvos:

```text
Humanoide
Cartoes Coloridos
Duelo 20
```

O HCI_109 permanece restrito a:

- foco na maca / visada;
- ritmo visual/reacao;
- gravacao de sessao HCI - Ritmo;
- gravacao de sessao HCI - Visada;
- governanca Admin;
- comparativos de Ritmo e Visada.

Os botoes de audio, marcacao de tempo por audio e aprovacao de sequencia de audio pertencem aos fluxos TAURUS Target, nao ao HCI_109.

## Fase A - Moving Focus Tracker

Nome tecnico:

```text
HciMovingFocusTrackerEngineV1
```

Nome visual:

```text
Visual Focus Drill
```

Objetivo:

- avaliar se o atleta acompanha a maca/imagem movel;
- detectar saida do eixo Y;
- detectar olhar para o circulo preto;
- calcular percentuais de acerto e erro;
- gerar `visualDisciplineScore`;
- exibir resultado final em card simples.

Regra antes da fase TAURUS Audio:

- o mock visual pode existir apenas para aprovacao de layout;
- antes de iniciar audio, o mock deve ser removido;
- a V1 deve ser testada com entrada real do usuario;
- na implementacao React Web atual, mouse/toque funciona como proxy de gaze;
- se nao houver entrada de ponteiro durante a descida, o motor deve classificar como `NO_GAZE_DETECTED`.

Regra de integracao no HCI_109:

- o Focus Drill deve operar tambem dentro do proprio alvo HCI_109;
- a leitura deve iniciar apos a calibracao/descida do modo Visada;
- a maca/imagem movel do alvo deve ser a referencia do `movingObject`;
- o circulo preto real do alvo deve ser usado como `blackCircleZone`;
- o eixo vertical real do alvo deve ser usado como `yAxisCorridor`;
- a leitura final integrada deve entrar em `visualFocusMetrics` na gravacao da sessao HCI - Visada.

## Fase B - Gravar Sessao HCI_109

Adicionar botoes no treino HCI_109:

```text
Gravar sessao HCI - Ritmo
Gravar sessao HCI - Visada
```

Regras:

- o botao so deve habilitar apos completar 10 disparos;
- a sessao deve ser salva com `PENDING_REVIEW`;
- a sessao nao deve ser aprovada automaticamente;
- a sessao nao deve entrar no SQL canonico sem revisao Admin.

Payload minimo:

```js
{
  sessionId,
  athleteName,
  trainingId: "HCI_109_SIGHT_RHYTHM_CORE",
  drillCode,
  sessionType: "RHYTHM" | "SIGHT",
  workflowStatus: "PENDING_REVIEW",
  reviewFlag: "ADMIN_REVIEW_REQUIRED",
  totalShots,
  decimalTotal,
  pistolTotal,
  seriesTotal,
  averageRadius,
  shots,
  visualFocusMetrics
}
```

## Fase C - Comparacao HCI_109

Antes da fase TAURUS Audio, criar a superficie de comparacao das sessoes gravadas.

Comparativos de Ritmo:

- total da serie por sessao;
- tempo de reacao por disparo;
- media de reacao por sessao;
- dispersao/raio medio;
- evolucao por data.

Comparativos de Visada:

- `visualDisciplineScore`;
- percentual seguindo a maca;
- percentual olhando para o circulo preto;
- percentual saindo do eixo Y;
- percentual de perda de foco;
- evolucao por data.

## Governanca

Fluxo oficial:

```text
HCI_109 DRILL -> RECORD SESSION -> REVIEW QUEUE -> ADMIN APPROVE -> SQL PERSISTENCE -> COMPARATIVE CHARTS
```

Na fase atual, a persistencia e local e pendente de revisao.

## Bloqueio Para TAURUS Audio - Cumprido

Bloqueio historico cumprido antes da abertura da frente TAURUS Audio. Durante esta fase, nao iniciar:

- motor de audio dos alvos TAURUS;
- componentes de grafico de audio para Humanoide, Cartoes Coloridos ou Duelo 20;
- captura de audio nesses alvos;
- revisao/aprovacao de sequencia de audio no Admin;
- injecao de tempos de audio na tabela de resultados TAURUS;

ate que as fases A, B e C estejam aprovadas.

## Criterios De Aceite Antes Do Audio

- Visual Focus Drill renderiza no modo Visada.
- Mock visual removido como fonte de classificacao.
- Ponteiro/mouse/toque alimenta a classificacao funcional do foco.
- Focus Drill roda dentro do proprio alvo HCI_109 no modo Visada.
- Leitura de foco integrada entra na gravacao da sessao HCI - Visada.
- Sessao HCI - Ritmo pode ser gravada apos 10 disparos.
- Sessao HCI - Visada pode ser gravada apos 10 disparos.
- Sessoes ficam armazenadas como `PENDING_REVIEW`.
- Existe uma tela/lista ou superficie para consultar sessoes HCI_109 gravadas.
- Existem graficos comparativos iniciais de Ritmo e Visada.
- Build passa.
