# HCI Target Intelligence - retomada da pipeline (2026-06-05)

## Regra arquitetural vigente

Matriz direcional gera diagnostico e insight.
`training_library_canonical.json` prescreve o treino.
Tela apenas exibe.
Motor decide.

Nao criar treino hardcoded em Composable e nao usar dados mockados para atleta, pontuacao, ranking, meta ou relatorio.

## Estado verificado no codigo

### Fechado

- `HciDashboardScreen.kt`: `HeaderSection` esta fechado corretamente e `DashboardContent` esta fora da funcao de header.
- `HciDashboardScreen.kt`: logout no topo usa `R.drawable.imgout` e chama `viewModel.logout()`.
- `HciViewModel.kt`: `logout()` limpa sessao, atleta, email, tela e estado de dashboard.
- `MainActivity.kt`: `isLoggedIn` e a trava principal das rotas internas.
- `LoginScreen.kt`: login exige nome e email valido; nao gera email local/mockado.
- `HciViewModel.kt`: apos login, o usuario vai para `ENTRY` para registrar dados reais antes do dashboard.
- `TargetIntelligenceEngine.kt`: `lookupTraining(...)` separa `DUEL_20`, `DEFENSE_HUMANOID` e `PRECISION_COLOR` por `targetType`, `trainingType`, `weaponClass` e `phase`.
- `TargetIntelligenceEngine.kt`: no `DUEL_20`, parametros `TARGET_*` sao convertidos para `PROCESS` ou `TRANSFER` para casar com a biblioteca de treinos.
- `TargetIntelligenceEngine.kt`: no `DUEL_20`, quando existe matriz direcional, o relatorio mostra apenas insights direcionais, sem o insight generico antigo.
- `ShotEntryScreen.kt`: Humanoide, Duelo 20 e Colorido salvam como `TargetSession` direto, sem aprovacao Admin.
- `ShotEntryScreen.kt`: geracao de PDF nas areas Target fica restrita a Coach/Admin ou usuario GOLD.
- `work/admin-desktop/hci_admin_control.py`: Admin local roda sob demanda em `http://127.0.0.1:8766`, sem polling continuo, sem internet e com botao de encerramento.
- `work/admin-desktop/hci_admin_control.py`: Admin mostra `Visao do atleta` espelhando as areas funcionais do app movel e permite selecionar quantos ultimos treinos/sessoes entram no cruzamento grafico.
- `work/admin-desktop/hci_admin_control.py`: botao de deletar sessao ISSF foi corrigido apos regressao de UI causada por JavaScript invalido no grafico radar.
- `work/admin-desktop/hci_admin_control.py`: Admin v3.4 trouxe o `Rhythm chart` principal como grafico hibrido de barras e linhas com dois eixos Y: eixo esquerdo para total/queda e eixo direito para media/desvio.
- `work/admin-desktop/hci_admin_control.py`: Admin v3.4 permite importar texto/TXT/CSV do TargetScan para o atleta selecionado, criando `athlete_submission` pendente (`TARGETSCAN_ADMIN`) para revisao/aprovacao do Admin.

### Ainda pendente

- `CoachReportScreen.kt` ainda nao le `targetSessions`.
- A aba geral `Report` ainda nao possui secao propria "Relatorios Target".
- `TargetSession` salva os campos basicos, mas ainda nao preserva percentuais/insights completos do `TargetReportPayload`.
- Cadastro persistente de atletas ainda nao existe em tabela Room propria.
- Relatorio Tecnico Posse/Porte GOLD continua aprovado apenas como pipeline futura.
- Admin desktop ainda precisa evoluir a equivalencia visual da `Visao do atleta` para ficar pixel a pixel igual ao app movel.
- Importacao direta de PDF TargetScan no Admin ainda depende de extracao textual desktop; por enquanto o Admin aceita texto/TXT/CSV exportado ou colado.

## Pipeline sugerida para reiniciar

1. Validar inicializacao do app em emulador limpo/cold boot.
2. Testar login real: nome + email valido, entrada direta em `ENTRY`, sem dados mockados.
3. Testar logout na tela 1: botao do topo deve voltar para login e limpar a sessao.
4. Auditar Target/Entry tela a tela em PT e EN, confirmando Duelo 20, Humanoide e Cartoes Coloridos.
5. Gravar sessoes reais de alvo e verificar `TargetSession`.
6. Integrar `targetSessions` no `CoachReportScreen` com uma secao "Relatorios Target".
7. Expandir `TargetSession` ou criar payload persistido para percentuais, insights e treino completo.
8. Criar cadastro persistente de atletas em Room.
9. So depois planejar a secao GOLD Posse/Porte dentro de `Report`.
10. Validar visualmente o `Rhythm chart` no Admin e no app contra `HCI_RHYTHM_TIMELINE` do Excel VBA.

## Observacao de QA

O bloqueio visual recorrente de tela preta/wallpaper deve ser tratado primeiro como problema de renderizacao do emulador quando: `pidof` mostra `com.example.sportsperformance` vivo, `dumpsys window` mostra `MainActivity` em foco, `uiautomator dump` mostra a UI do app e `logcat -b crash` nao mostra `FATAL EXCEPTION`. Nesse caso, preservar os dados, fazer force-stop/relaunch e usar `Cold Boot Now` no emulador antes de alterar codigo do app.
