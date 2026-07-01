# HCI_109 Comparative Charts - Status

Data: 2026-06-29

## Atualizacao Phase I - 2026-07-01

Status historico fechado.

Este documento registra a superficie comparativa inicial criada antes da frente TAURUS Audio. A regra canonica atual e:

```text
HCI_109 has no audio.
Audio belongs to Humanoide, Cartoes Coloridos, and Duelo 20.
```

Qualquer mencao abaixo a bloqueio de audio deve ser lida como bloqueio historico ja cumprido, nao como escopo atual do HCI_109.

## Contexto

Esta etapa executa a Fase C da SPEC:

```text
src/contracts/HCI_109_FOCUS_RECORDING_BEFORE_AUDIO_SPEC_2026-06-29.md
```

O mock visual foi aprovado e, antes de iniciar audio, foi criada a superficie inicial para consultar e comparar sessoes HCI_109 gravadas.

## Implementado

Arquivo principal:

```text
src/pages/LibraryPage.jsx
```

Adicionado painel:

```text
HCI_109 - Comparativo de sessoes gravadas
```

O painel aparece na Library quando o treino HCI_109 esta disponivel.

## Conteudo do painel

- contador total de sessoes gravadas;
- cards para total de sessoes de Ritmo e Visada;
- ultimo total de Ritmo;
- ultimo `visualDisciplineScore`;
- grafico de Ritmo com:
  - total da serie;
  - media de tempo de reacao;
  - dispersao media;
- grafico de Visada com:
  - `visualDisciplineScore`;
  - percentual olhando para o circulo preto;
  - percentual saindo do eixo Y;
  - percentual de perda de foco;
- tabela das ultimas sessoes salvas.

## Fonte de dados

O painel consome:

```text
src/services/hci109SessionStore.js
```

As sessoes continuam locais e pendentes de revisao:

```text
workflowStatus: PENDING_REVIEW
reviewFlag: ADMIN_REVIEW_REQUIRED
```

## Nao implementado nesta etapa historica

- revisao Admin das sessoes HCI_109;
- aprovacao/rejeicao;
- persistencia SQL canonica;
- graficos comparativos aprovados em area Admin;
- motor de audio no HCI_109, que permanece fora de escopo.

## Bloqueio de audio - Cumprido

O bloqueio descrito nesta etapa foi cumprido antes da frente TAURUS Audio. Audio continua fora do HCI_109 e pertence apenas aos fluxos TAURUS Target.

## Validacao

Comando executado:

```bash
npm.cmd run build
```

Resultado:

- Build concluido com sucesso.
- Aviso existente do Vite sobre chunk grande permanece sem bloquear a entrega.
