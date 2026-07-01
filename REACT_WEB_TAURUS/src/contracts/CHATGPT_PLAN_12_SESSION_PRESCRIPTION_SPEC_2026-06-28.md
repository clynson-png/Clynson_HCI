# CHATGPT_PLAN_12_SESSION_PRESCRIPTION_SPEC_2026-06-28

## Objetivo

Revisar e corrigir as ligacoes dos motores de prescricao para a aba `Plano`, criando um planejamento premium de 12 sessoes de tiro a partir dos piores rendimentos do atleta.

O plano deve ser exibido na aba `Plano` e tambem sair em relatorio imprimivel/exportavel pelo fluxo premium.

## Superficies Envolvidas

- `src/pages/PlanoPage.jsx`
- `src/services/trainingPlanEngine.js`
- `src/services/trainingLibraryService.js`
- `src/pages/ReportPage.jsx`
- `src/services/athleteViewMapper.js`
- `src/contracts/TRAINING_PLAN_CONTRACT_V1.js`, se existir no checkout
- repositorio `FONTES` / canonicos de treino, dicas, hidratacao, atividade fisica e mental

## Regra Principal Do Plano

O plano deve gerar 12 cards de sessao, de `Dia 1` a `Dia 12`.

Cada dia deve conter:

- 1 hora de treino tecnico
- parametro HCI treinado
- defeito principal atacado
- treino prescrito
- objetivo tecnico do dia
- foco temporal do dia, quando houver dado de tempo
- dica complementar do card
- origem da dica, quando disponivel
- marcador premium para impressao em relatorio

## Distribuicao Obrigatoria

O plano deve usar os dois piores rendimentos atuais do atleta.

Distribuicao:

- 60% das 12 sessoes para o pior rendimento: 7 sessoes
- 40% das 12 sessoes para o segundo pior rendimento: 5 sessoes

Regra de arredondamento:

- 12 * 0.60 = 7.2, arredondar para 7
- 12 * 0.40 = 4.8, arredondar para 5
- total obrigatorio: 12 sessoes

## Identificacao Dos Piores Rendimentos

O motor deve localizar os dois piores parametros a partir dos dados reais do atleta.

Para `ISSF_HCI`, ordem preferencial de fonte:

1. `athleteView.summary.levels` ou estrutura equivalente de niveis por parametro.
2. `athleteView.summary.scores` ou estrutura equivalente de scores por parametro.
3. indices derivados ja calculados no HCI.
4. fallback manual somente se o atleta nao tiver dados suficientes.

O pior rendimento deve ser o parametro com menor score ou pior classificacao. O segundo pior deve ser o proximo parametro valido.

Nao usar filtro manual da tela como substituto da leitura do atleta. O filtro manual pode existir, mas o plano automatico deve nascer dos motores.

## Separacao ISSF E HCI TAURUS

Dados ISSF nao podem ser usados para leituras `HCI_TAURUS`.

`HCI_TAURUS` deve ter motores novos. Esses motores podem reaproveitar a logica metodologica ISSF de leitura de pior rendimento, tendencia, estabilidade, agrupamento, tempo e prescricao corretiva, mas nao podem reaproveitar a parametrizacao ISSF.

Regra essencial:

- permitido: usar a logica ISSF como inspiracao estrutural de decisao;
- proibido: usar parametros ISSF como `OUTCOME`, `PROCESS`, `RHYTHM`, `CONSISTENCY`, `TRANSFER`, `PRESSURE`, `RESILIENCE`, `EMOTIONAL`, `PHYSICAL` para decidir `HCI_TAURUS`;
- obrigatorio: emitir parametros TAURUS proprios por alvo/card.

Regra de dominio:

- `ISSF_HCI` pode usar `athleteView.indices.allParameters`, series ISSF, disparos ISSF e metricas derivadas do HCI ISSF.
- `HCI_TAURUS` nao pode usar `athleteView.indices.allParameters`, pontuacao ISSF, ritmo ISSF, series ISSF ou qualquer baseline ISSF.
- `HCI_TAURUS` deve usar somente sessoes TAURUS aprovadas do alvo/card selecionado.
- uma leitura de Duelo 20 nunca pode prescrever Humanoide;
- uma leitura de Humanoide nunca pode prescrever Cartoes Coloridos;
- uma leitura de Cartoes Coloridos nunca pode prescrever Duelo 20.

Fontes obrigatorias para `HCI_TAURUS`:

- sessoes persistidas em `TAURUS_TARGET_DB_V1`, via `taurusTargetStore`;
- analisadores especificos por alvo/card:
  - `taurusHumanoidIntelligence.js`;
  - `taurusColorIntelligence.js`;
  - `taurusDuelIntelligence.js`.
- vocabulario proprio em `taurusDecisionEngines.js`.

Se o alvo TAURUS selecionado nao tiver sessoes TAURUS aprovadas suficientes, o motor deve retornar `INSUFFICIENT_TAURUS_TARGET_DATA`.

E proibido completar a lacuna com dados ISSF.

## Tempo Como Fator De Decisao

A medida de tempo deve entrar como fator de decisao para melhor ou pior desempenho quando o dado existir.

Regras:

- tempo nao deve ser tratado como zero quando estiver ausente;
- ausencia de tempo deve ser `INSUFFICIENT_TIMING_DATA`;
- tempo deve influenciar a classificacao de desempenho TAURUS;
- tempo deve entrar nos cards de treino quando houver fonte temporal;
- a leitura temporal deve ser individualizada por tipo de alvo/card.

Por dominio:

- `ISSF_HCI`: usar tempo apenas quando ja existir como dado derivado de ritmo/serie; nao inventar cronometro externo.
- `TAURUS/HUMANOID`: usar `durationSeconds` junto com eficiencia de zonas, Alpha/Charlie/Delta e disparos sem registro.
- `TAURUS/COLOR`: usar `durationSeconds` junto com equilibrio entre cores, reconhecimento visual e disparos sem registro.
- `TAURUS/DUEL20`: usar `seriesTimeSeconds` por serie como fonte preferencial; usar `durationSeconds` apenas como complemento.

O tempo de um alvo nunca pode servir para prescrever outro alvo.

Exemplos proibidos:

- tempo de Duelo 20 influenciar prescricao de Humanoide;
- tempo de Humanoide influenciar Cartoes Coloridos;
- tempo de Cartoes Coloridos influenciar Duelo 20.

Os cards de treino devem aceitar:

```js
timingPrescription: {
  source: 'SESSION_DURATION' | 'SERIES_TIME' | 'NONE',
  observed: '...',
  focus: '...',
  cue: '...'
}
```

## Ligacao Com Os Motores De Prescricao

A implementacao deve revisar antes de alterar:

- se `PlanoPage.jsx` esta consumindo `trainingPlanEngine.js` ou apenas filtrando a biblioteca localmente;
- se `trainingPlanEngine.js` recebe `athleteView`, `coachInput` e `trainingLibrary`;
- se as recomendacoes geradas viram `prescribedTrainings`;
- se decisoes de aprovacao/rejeicao persistem em `snapshot.prescriptions` quando o checkout tiver snapshot ativo;
- se o relatorio premium le a mesma fonte que a aba Plano.

Aceitacao minima:

- a aba `Plano` nao pode ser apenas uma vitrine filtrada da biblioteca;
- ela deve mostrar resultado do motor de prescricao;
- o mesmo plano aprovado deve ser visivel no relatorio premium.

## Calendario 12 Sessoes

Gerar estrutura:

```js
{
  planId: 'PLAN_12_SHOOTING_<athleteId>_<timestamp>',
  planType: '12_SHOOTING_SESSIONS',
  durationDays: 12,
  sessionDurationMinutes: 60,
  distribution: {
    primaryWorst: { parameter, sessions: 7, percent: 60 },
    secondaryWorst: { parameter, sessions: 5, percent: 40 }
  },
  sessions: [
    {
      day: 1,
      label: 'Dia 1',
      durationMinutes: 60,
      parameter: 'RHYTHM',
      defect: 'Quebra de ritmo na entrada do disparo',
      trainingId: '...',
      trainingTitle: '...',
      technicalObjective: '...',
      timingPrescription: {
        source: 'SESSION_DURATION',
        observed: '18.5s',
        focus: 'manter decisao sob tempo sem perder qualidade',
        cue: 'Controle o tempo, mas nao sacrifique o processo.'
      },
      coachCue: { id, defect, category, text, source },
      premiumPrintable: true
    }
  ]
}
```

Distribuicao sugerida para evitar blocos longos demais:

- Dia 1: pior rendimento
- Dia 2: segundo pior
- Dia 3: pior rendimento
- Dia 4: pior rendimento
- Dia 5: segundo pior
- Dia 6: pior rendimento
- Dia 7: segundo pior
- Dia 8: pior rendimento
- Dia 9: pior rendimento
- Dia 10: segundo pior
- Dia 11: pior rendimento
- Dia 12: segundo pior

Resultado: 7 sessoes do pior rendimento e 5 sessoes do segundo pior.

## Dicas Complementares

Criar 7 dicas diferentes, cada uma ligada a um defeito principal.

As dicas devem vir do repositorio `FONTES` quando houver fonte correspondente. Quando a fonte for adaptada de canonico, marcar como `source: 'FONTES_ADAPTED'`. Nao inventar como se fosse fonte original.

Categorias obrigatorias:

- hidratacao
- atividade fisica
- mental
- rotina tecnica
- respiracao
- foco/atencao
- recuperacao

Modelo de dica:

```js
{
  id: 'CUE_HYDRATION_01',
  defect: 'Queda de estabilidade no fim da sessao',
  category: 'hidratacao',
  text: 'Inicie a sessao hidratado e use pequenos goles planejados entre blocos para evitar perda de estabilidade.',
  source: 'FONTES'
}
```

As 7 dicas devem acompanhar os cards do plano de forma aleatoria controlada:

- nao repetir a mesma dica em dias consecutivos;
- priorizar dica cuja categoria combine com o defeito do dia;
- se nao houver combinacao direta, sortear entre as restantes;
- manter determinismo por `planId` quando possivel, para o plano nao mudar a cada render.

## Relatorio Premium

O card do plano deve ser imprimivel em relatorio premium.

Requisitos:

- botao ou acao de impressao/exportacao no fluxo premium existente;
- cada sessao deve sair com `Dia 1` a `Dia 12`;
- mostrar 1 hora de treino tecnico por dia;
- destacar a distribuicao 60/40;
- mostrar o pior e o segundo pior rendimento;
- incluir a dica complementar no card de cada dia;
- preservar identidade visual premium ja usada nos relatorios;
- nao depender de estado local perdido ao trocar de aba.

## Criterios De Aceite

1. `Plano` identifica os dois piores rendimentos reais do atleta.
2. `Plano` gera exatamente 12 sessoes.
3. O pior rendimento aparece em 7 sessoes.
4. O segundo pior rendimento aparece em 5 sessoes.
5. Cada sessao mostra `1 hora de treino tecnico`.
6. Existem 7 dicas complementares diferentes, ligadas a defeitos principais.
7. As dicas sao incorporadas aos cards de forma aleatoria controlada.
8. O plano aprovado aparece no relatorio premium.
9. O relatorio pode ser impresso/exportado.
10. A implementacao preserva a separacao entre motor, UI e relatorio.
11. Quando houver tempo real, o Plano usa tempo como fator de desempenho e prescricao.
12. Tempo e desempenho permanecem individualizados por alvo/card.
13. `HCI_TAURUS` nunca usa dados ISSF para leitura, ranking de pior desempenho, fallback ou prescricao.
14. `HCI_TAURUS` usa motores novos com parametros `TAURUS_*`; nomes de parametros ISSF nao podem ser saida de decisao.

## Fora De Escopo Nesta SPEC

- mudar calculo HCI central;
- alterar treino HCI_109 da Library;
- criar nova metodologia de periodizacao;
- substituir a biblioteca canonica de treinos;
- misturar dados ISSF com leituras `HCI_TAURUS`.

## Sequencia Recomendada De Execucao

1. Auditar ligacoes atuais entre `PlanoPage.jsx`, `trainingPlanEngine.js`, snapshot e relatorio.
2. Criar funcao pura para detectar os dois piores rendimentos.
3. Criar funcao pura para montar o calendario 12 sessoes com distribuicao 7/5.
4. Criar fonte canonica local das 7 dicas, apontando para `FONTES` quando confirmado.
5. Renderizar o calendario na aba `Plano`.
6. Persistir/aprovar o plano usando a mesma fonte que alimenta relatorio.
7. Expor o plano no relatorio premium imprimivel.
8. Validar com build e teste manual em atleta com dados reais.
