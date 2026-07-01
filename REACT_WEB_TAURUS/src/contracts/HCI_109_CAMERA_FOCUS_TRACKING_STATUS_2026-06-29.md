# HCI_109 Camera Focus Tracking - Status

Data: 2026-06-29

## Escopo

Implementar leitura por camera no Focus Drill integrado ao alvo HCI_109 antes da fase de audio.

## Implementado

Arquivo principal:

```text
src/pages/LibraryPage.jsx
```

No modo `Abrir Visada`, foi adicionado painel:

```text
Camera Focus
```

Controles:

- `Ligar camera`
- `Desligar`

## Como funciona na V1

- Usa `navigator.mediaDevices.getUserMedia` para abrir a camera.
- Usa `@mediapipe/tasks-vision` com `FaceLandmarker` para obter landmarks faciais.
- Usa `outputFaceBlendshapes` para medir piscadas e estado ocular.
- Carrega o WASM do MediaPipe pela versao instalada `0.10.35`.
- Carrega o modelo oficial `face_landmarker.task`.
- Mapeia olhos + nariz para coordenadas funcionais do alvo HCI_109.
- Alimenta o `HciMovingFocusTrackerEngineV1` durante a descida.
- Mantem ponteiro/mouse/toque como fallback quando camera, rede, WASM ou modelo nao estao disponiveis.

## Substituicao tecnica

O uso de `window.FaceDetector` foi removido porque no Edge/Chrome ele pode abrir a camera e ainda assim falhar com:

```text
Face detection service unavailable
```

A leitura passa a depender do MediaPipe, que e mais estavel para esta fase do Focus Drill.

## Gravacao

A sessao `Gravar sessao HCI - Visada` agora salva:

```text
visualFocusMetrics
visualFocusSourceType
shots[].visualFocusMetrics
shots[].visualFocusSourceType
```

`visualFocusSourceType` pode ser:

```text
CAMERA
POINTER
```

## Metrica principal por disparo

Cada disparo da Visada passa a receber sua propria nota visual.

Campos principais por disparo:

```text
shots[].visualFocusMetrics.visualDisciplineScore
shots[].visualFocusMetrics.followingMovingObjectMs
shots[].visualFocusMetrics.followingMovingObjectPct
shots[].visualFocusMetrics.blinkCount
shots[].visualFocusMetrics.eyeOpenMs
shots[].visualFocusMetrics.eyeClosedMs
shots[].visualFocusMetrics.eyeOpenPct
```

`followingMovingObjectMs` e o tempo estimado em que o olho ficou acompanhando a maca/objeto no intervalo daquele disparo. Esta e a metrica principal de medicao do Focus Drill.

`blinkCount`, `eyeOpenMs` e `eyeClosedMs` sao calculados por disparo a partir dos blendshapes faciais do MediaPipe.

A tabela do HCI_109 Visada apresenta por disparo:

- Nota visual
- Olho no objeto
- Olho aberto
- Piscadas
- Reacao
- Disparo decimal
- Ponto pistola

## Limites da V1

Esta leitura por camera e funcional, nao clinica.

Ela nao promete rastreamento ocular preciso. A V1 estima foco funcional a partir da face/camera e preserva a regra de governanca:

```text
DETECT -> REVIEW -> ADMIN APPROVE -> SQL PERSISTENCE
```

## Validacao

Comando executado:

```bash
npm.cmd run build
```

Resultado:

- Build concluido com sucesso.
- Aviso existente do Vite sobre chunk grande permanece sem bloquear a entrega.
