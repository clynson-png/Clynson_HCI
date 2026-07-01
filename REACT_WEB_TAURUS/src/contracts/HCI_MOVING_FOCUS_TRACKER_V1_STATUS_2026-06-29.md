# HCI Moving Focus Tracker V1 - Status

Data: 2026-06-29

## Atualizacao Phase I - 2026-07-01

Status historico fechado.

Esta fase continua sendo somente HCI_109/foco visual. A regra canonica atual e:

```text
HCI_109 has no audio.
Audio belongs to Humanoide, Cartoes Coloridos, and Duelo 20.
```

A mencao a ordem "antes da fase de motores de audio" indica apenas sequenciamento historico ja cumprido.

## Ordem de execucao

Esta fase foi executada antes da fase de motores de audio, conforme a ordem correta da SPEC.

SPEC de ordem:

```text
src/contracts/HCI_109_FOCUS_RECORDING_BEFORE_AUDIO_SPEC_2026-06-29.md
```

## Implementado

Criado motor analitico:

```text
src/engines/HciMovingFocusTrackerEngineV1.js
```

Funcoes implementadas:

- `isLookingAtMovingObject`
- `isLookingAtBlackCircle`
- `isInsideYAxisCorridor`
- `classifyMovingFocusFrame`
- `calculateMovingFocusMetrics`
- `interpretVisualDiscipline`

Criados componentes React:

```text
src/components/visualFocus/MovingFocusTrackerPanel.jsx
src/components/visualFocus/MovingFocusOverlay.jsx
src/components/visualFocus/VisualFocusMetricsCard.jsx
```

Dataset mockado removido apos aprovacao visual.

A V1 agora usa captura real de ponteiro dentro do overlay como proxy funcional de gaze para teste:

- mouse no desktop;
- toque/ponteiro em telas compativeis;
- ausencia de ponteiro gera `NO_GAZE_DETECTED`.

## Integracao

O painel `Visual Focus Drill` foi integrado ao treino HCI_109 dentro da Library, no modo:

```text
Abrir Visada
```

O painel:

- renderiza alvo, circulo preto, corredor vertical e objeto movel de foco;
- recebe ponteiro/gaze funcional na V1;
- classifica cada frame durante `DESCENT`;
- calcula percentuais de acerto/erro;
- calcula `visualDisciplineScore`;
- exibe resultado final em card simples.

## Integracao dentro do alvo HCI_109

Apos ajuste de governanca, a leitura principal tambem foi integrada diretamente ao alvo HCI_109 no modo Visada.

Arquivo:

```text
src/pages/LibraryPage.jsx
```

Comportamento:

- o proprio `hci-pistol-range` captura mouse/toque como gaze funcional;
- o proprio alvo preto e usado como `blackCircleZone`;
- a propria maca/alca movel e usada como `movingObject`;
- o corredor vertical e calculado a partir do alvo real;
- os frames sao classificados durante a descida;
- `visualFocusMetrics` e atualizado dentro do treino;
- a gravacao `Gravar sessao HCI - Visada` salva essa leitura integrada.

## Governanca preservada

- Nao altera dados canonicos.
- Nao aprova sessao.
- Nao persiste resultado automaticamente.
- Mantem a regra `DETECT -> REVIEW -> ADMIN APPROVE -> SQL PERSISTENCE` para fases futuras.

## Nao iniciado nesta fase

- Motor de audio no HCI_109, que permanece fora de escopo.
- Persistencia SQL dos resultados do foco visual.
- Captura real de eye tracker/camera.

## Validacao

Comando executado:

```bash
npm.cmd run build
```

Resultado:

- Build concluido com sucesso.
- Aviso existente do Vite sobre chunk grande permanece sem bloquear a entrega.
