# SportsPerformance Admin Control

## Regra operacional

A plataforma Admin e sob demanda. Ela nao deve ficar rodando o tempo todo.

- O admin abre `Start-HciAdminControl.ps1` apenas quando for revisar/atualizar.
- O launcher padrao agora sobe `hci_admin_control_v4.0.py`, restaurada sobre o motor estavel da `v3.4`.
- A leitura do banco acontece quando a tela abre ou quando o admin clica em `Atualizar sob demanda`.
- A escrita no banco acontece somente quando o admin aprova uma prova ou envia um treino extra.
- Ao terminar, clicar em `Encerrar`.
- Nao existe polling, sincronizacao continua, dependencia de internet ou dependencia de servidor externo.

## Escopo atual

- Lista leads locais: nome e email.
- Lista entradas ISSF pendentes.
- Aprova prova ISSF completa e grava em `shot_series`.
- Lista resultados ISSF gravados.
- Lista sessoes HCI Target.
- Envia treinos extras manuais para o app do atleta sem substituir o plano atual.
- Lanca treino extra a partir de uma sessao HCI Target ja registrada, usando o treino recomendado como sugestao editavel.
- Mostra a `Visao do atleta` no desktop Admin seguindo as mesmas areas do app movel: Resumo, Indices, Ritmo, Target e Plano.
- A visao do atleta permite escolher quantos ultimos treinos/sessoes entram no cruzamento grafico. O padrao e 5.
- As sessoes HCI Target (`DEFENSE_HUMANOID`, `DUEL_20`, `PRECISION_COLOR`) sao dados diretos de visualizacao e relatorio futuro; nao passam por aprovacao Admin.
- A versao `v3.3` restaurou as areas que haviam sumido na regressao: Leads, Entradas dos atletas/ISSF pendente, Historico ISSF com deletar confirmado, Resultados ISSF gravados, HCI Target Sessions, Enviar treino extra e Plan/prescricoes.
- O `Rhythm chart` do Admin usa agora a serie real, o `rhythmPath` P1/P2/P3 e o comparativo dos ultimos N treinos/sessoes selecionados pelo Admin.

## Limite atual

Este controle local usa ADB para acessar o banco Room do app no emulador/dispositivo de desenvolvimento. Em producao, a mesma regra deve ser mantida com sincronizacao local/offline ou exportacao/importacao sob demanda, sem servico permanente.

O importador direto de PDF TargetScan dentro do Admin desktop ainda nao foi implementado. O fluxo pronto usa as sessoes HCI Target que ja estao gravadas no banco do app.

A `Visao do atleta` no Admin usa os mesmos dados reais locais e a mesma organizacao funcional do app movel. A equivalencia visual pixel a pixel ainda nao foi fechada; este e o primeiro espelho desktop funcional para validar as metricas e os cruzamentos.

A regressao causada pelo JavaScript invalido no grafico radar foi corrigida na `v3.3`; antes de novos upgrades de HTML/JS, validar `python -m py_compile work\admin-desktop\hci_admin_control.py` e abrir `/api/snapshot`.

## Sincronizacao App vs Admin (Login)

Para que o atleta consiga visualizar os dados importados/lancados pelo Admin no celular, a regra de "casamento" e o **NOME DO ATLETA**:

1.  **No Admin:** O nome que aparece na coluna `ATLETA` da aba `INPUT` (ou o nome que voce digita ao aprovar) deve ser **exatamente igual** ao nome que o atleta usara para logar no App.
2.  **No App:** Na tela de Login, o atleta deve digitar o nome identico ao do Admin.
    *   Exemplo: Se no Admin esta `CAMPOS, FÁBIO LUCIANO DE`, no App ele deve digitar exatamente `CAMPOS, FÁBIO LUCIANO DE`.
3.  **Leads:** Ao logar no App, o sistema cria automaticamente um registro na aba de **Leads** do Admin com o Nome e Email usados. Isso confirma que o login "casou" com o banco de dados.

**Dica:** Use o menu de "Leads" no Admin para conferir quais emails estao associados a quais nomes e garantir que a comunicacao coach-atleta esteja alinhada.

Relatorios das areas HCI Target devem ser gerados somente por Coach/Admin ou usuario GOLD. A geracao futura no Admin deve respeitar a mesma regra de permissao.
