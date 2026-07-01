# Documentação Oficial - SportsPerformance HCI (Versão PT-BR)

Esta é a documentação consolidada do aplicativo **SportsPerformance**, um ecossistema inteligente voltado para a análise de desempenho em tiro esportivo e operacional, utilizando algoritmos avançados (HCI - Interação Humano-Computador) para diagnóstico e prescrição técnica.

---

## 1. Módulos de Entrada e Acesso

### 1.1 Tela de Login e Segurança
- **Mecanismo atual:** login local operacional com nome do atleta e email valido.
- **Fluxo atual:** o aplicativo exige identidade minima antes de liberar as rotas internas. O email informado e salvo como lead qualificado local em Room (`qualified_lead`), sem fabricar email local ou atleta mockado.
- **Entrada apos login:** o app direciona o usuario para a area de lancamento/registro (`ENTRY`) para gravar dados reais antes de gerar relatorio ou dashboard.
- **Logout:** existe botao visivel no topo da tela 1, ao lado do seletor PT/EN, usando o icone `R.drawable.imgout`. O logout limpa a sessao em memoria e retorna para a tela de login.
- **Limite atual:** autenticacao Firebase, recuperacao de senha e persistencia remota de sessao nao estao ativas neste fluxo atual.

---

## 2. Motores de Análise de Alvos (Intelligence Engine)

O aplicativo processa diferentes tipos de alvos para identificar tendências técnicas e falhas de execução.

### 2.1 Alvo Duelo 20 (ISSF/Manual)
- **Modos:** 10 metros e 25 metros.
- **Regras de Pontuação:**
    - **Modo 10m:** Pontuação máxima 240 (20 disparos). O 'X' (Centro) vale **12 pontos**.
    - **Modo 25m:** Pontuação máxima 200 (20 disparos). O 'X' (Centro) vale **10 pontos**.
- **Regra de Direção:** O 'X' deve ser obrigatoriamente registrado no **Centro (C)**.

### 2.2 Alvo Humanoide (Defesa/Operacional)
- **Estrutura:** 8 zonas de interesse (Cabeça, Tórax, Abdômen, Pélvis, Ombros e Quadrantes Inferiores).
- **Algoritmo de Prescrição:**
    - Se houver **tiros zerados**, a prioridade hierárquica é corrigir a **POSIÇÃO**.
    - Se houver dispersão em 4 ou mais zonas (tiros espalhados), o foco é **MIRA (AIMING)**.
    - Se houver concentração em zonas baixas e à direita, o foco é **ACIONAMENTO (TRIGGERING)**.
    - Se houver lateralização consistente (esquerda ou direita), o foco é **EMPUNHADURA (GRIP)**.

### 2.3 Cartões Coloridos (Precisão Visual e Reação)
- **Estrutura:** 4 quadrantes coloridos (Amarelo, Verde, Vermelho, Azul).
- **Algoritmo de Prescrição:**
    - Mais de um erro zerado indica falha primordial na **IDENTIFICAÇÃO DE CORES**.
    - Erros em quadrantes específicos (ex: superior esquerdo) indicam falhas de **POSIÇÃO** ou **MIRA**.
    - Erros concentrados na parte inferior indicam falhas de **ACIONAMENTO** ou **EMPUNHADURA**.

---

## 3. Métricas de Desempenho e Motores de Cálculo

O sistema opera sobre dois eixos principais: métricas regulamentares ISSF e métricas diagnósticas HCI.

### 3.1 Métricas ISSF (Padrão Internacional)
- **Total de Prova:** Soma absoluta de todos os disparos (inteiros para Pistola, decimais para Rifle).
- **Subtotais por Série (SR1-SR6):** Agrupamento rítmico e regulamentar de 10 disparos.
- **Olympic Benchmarking:** Comparação direta com scores de elite mundial:
    - **Rifle:** Top 8 (>= 631.0), Elite (>= 628.0).
    - **Pistola:** Top 8 (>= 582), Elite (>= 578).

### 3.2 Métricas Analíticas HCI (Structure & Targets)
O motor HCI decompõe a prova em dimensões de "Estrutura" (capacidade de sustentar a prova) e "Alvos" (qualidade técnica pura).

#### A. Gráfico Radial de Alvos (Targets)
Focado no **Processo** e **Refinamento**:
- **Process Score:** Razão entre sequências de tiros "limpos" (>= 9.0) e o volume total.
- **Deepening Score:** Mede a profundidade da zona de excelência (tiros >= 10.0 consecutivos).
- **Consistency Score:** Avalia a estabilidade entre séries (amplitude máxima vs mínima).

#### B. Gráfico Radial de Estrutura (Structure)
Avalia a resiliência física e mental:
- **Resilience Score:** Capacidade de recuperação rítmica após um "drop" (tiro ruim).
- **Pressure Score:** Impacto do estresse na estabilidade rítmica (desvio padrão rítmico).
- **Physical Score:** Degradação de performance da primeira metade para a segunda metade da prova.
- **Emotional Score:** Penalização baseada na recorrência de sequências negativas.

#### C. Rhythm Path (Gráfico de Linhas)
Análise micro-rítmica da prova:
- Divide cada série de 10 tiros em 3 janelas (P1: tiros 1-3, P2: 4-7, P3: 8-10).
- Identifica padrões de "entrada lenta", "perda de foco no final da série" ou "estabilidade central".

#### D. Histórico e Tendência (Gráfico de Barras)
- Comparação visual entre o evento atual e o **Baseline (Contexto Histórico)** do atleta.
- Permite identificar se o desvio técnico é um evento isolado ou uma mudança de patamar (Tier Change).

---

## 4. Hierarquia e Lógica de Prescrição Técnica

O aplicativo utiliza uma hierarquia lógica inteligente para selecionar exercícios da **Biblioteca de Treinos (JSON)**.

### 3.1 Níveis de Prioridade (Flow de Decisão)
1.  **Segurança e Base (Position):** Ativada quando há perda total do alvo ou erros grosseiros de alinhamento.
2.  **Processo de Execução (Aiming/Triggering/Grip):** Ativada quando o atleta atinge o alvo, mas apresenta padrões de erro técnico.
3.  **Refinamento Visual (Color Identification):** Específico para drills de tomada de decisão e processamento cognitivo.

### 3.2 Biblioteca de Exercícios (V4)
O arquivo `training_library_canonical.json` é a fonte única de verdade ("Master Library") que contém:
- **ID de Treino:** Identificador único para cada exercício.
- **Parâmetro Vinculado:** Conecta o diagnóstico do motor de inteligência ao exercício específico (ex: `TARGET_TRIGGERING`).
- **Fases de Treinamento:** Preparação Geral, Preparação Específica, Pré-Competição e Competição.
- **Classes de Armas:** PISTOL, RIFLE e alvos especializados (HUMANOIDE/COLOR_CARD).

---

## 4. Algoritmo HCI de Análise Direcional

### 4.1 Índice de Defeito Dominante (IDD)
Para evitar que "tiros fora da curva" (outliers) distorçam o diagnóstico, o app utiliza o cálculo do **IDD Médio**:
`IDD_MEDIO = QTDE_TIROS * DIST_MEDIA_MM`

### 4.2 Leitura Angular e Setorização
- **Pistola/Duelo:** Utiliza 8 setores radiais de 45 graus.
- **Rifle/Carabina:** Utiliza 4 quadrantes de 90 graus para maior precisão de estabilidade de posição.

---

## 5. Extração de Dados do TargetScan (PDF Parsing)

O aplicativo possui um módulo especializado para importar e processar relatórios gerados pelo **TargetScan**, permitindo a transição fluida de alvos físicos para o diagnóstico digital.

### 5.1 Mecanismo de Parsing
- **Tecnologia:** Utiliza a biblioteca `PDFBox` para extração de texto estruturado.
- **Identificação Automática:** O motor identifica automaticamente o nome do atleta, data do evento, tipo de prova (Rifle ou Pistola) e a sessão.
- **Extração de Scores:** 
    - Realiza o "stripping" das tabelas de pontuação do PDF.
    - Reconhece padrões de tiro regulamentares (ex: `10.5`, `9.8`).
    - Valida o total das séries para garantir a integridade dos dados importados.

### 5.2 Mapeamento de Séries
- O sistema reconstrói as 6 séries oficiais de 10 disparos (SR1 a SR6).
- **Tratamento de Decimais:** Preserva decimais para provas de Rifle (ex: 10.9) e converte para inteiros em provas de Pistola conforme a regra ISSF, alimentando o motor HCI com a precisão correta para cada modalidade.

---

## 6. Exportação, Relatórios e BI
O aplicativo permite a geração e exportação de relatórios profissionais em PDF para atletas e treinadores, contendo:
- **Métricas Oficiais:** Total de disparos, zona dominante, dispersão média e peak concentration.
- **Insights Dinâmicos:** Textos gerados pela IA interpretando o padrão de erro do atleta.
- **Prescrição Técnica:** Sugestão direta de treino com guias de "Como fazer", "Dicas do Treinador" e carga sugerida.

### 6.1 Estado atual dos Relatorios Target
- A tela Target/Entry gera e salva `TargetSession` com atleta, evento, sessao, tipo de alvo, zonas, contagens, total de disparos, treino recomendado e timestamp.
- A aba geral `Report` ainda esta orientada ao fluxo HCI olimpico e revisao de entradas completas; ela ainda nao exibe uma secao propria para relatorios Target.
- Proxima integracao: fazer `CoachReportScreen` observar `targetSessions` e mostrar uma secao "Relatorios Target" separada para Duelo 20, Humanoide e Cartoes Coloridos.

### 6.2 Relatorio Tecnico Posse/Porte GOLD
- Pipeline futura aprovada, mas nao implementada: deve ficar como secao interna da area de relatorios para usuarios GOLD.
- Nao deve ser um botao solto. Dados pesados devem ser coletados apenas quando o usuario abrir/gerar esse relatorio tecnico.
- Nota obrigatoria futura: "Este relatorio e um documento tecnico de treino/simulado. Nao substitui avaliacao oficial, laudo, exame legal ou procedimento formal exigido pela autoridade competente."

---

## 7. Atualizacao operacional - Admin, Target e relatorios (2026-06-05)

- A plataforma Admin desktop e local e sob demanda, acessada em `http://127.0.0.1:8766` durante desenvolvimento.
- O Admin nao deve ficar rodando continuamente, nao faz polling automatico e nao depende de internet ou servidor externo.
- A entrada principal e o ajuste final dos dados oficiais sao responsabilidade do Admin/Coach no desktop.
- O atleta pode inserir dados, mas entradas ISSF do atleta seguem para revisao quando aplicavel; o dado oficial e fechado pelo Admin/Coach.
- Humanoide, Duelo 20 e Cartoes Coloridos salvam direto como `TargetSession`; essas areas nao precisam de aprovacao Admin.
- As sessoes Target ficam disponiveis para visualizacao, cruzamento de dados e geracao futura de relatorios.
- A geracao de PDF/relatorio nas areas Target fica restrita a Coach/Admin ou usuario GOLD.
- O Admin desktop deve mostrar a mesma area que o atleta ve, com as areas funcionais `Resumo`, `Indices`, `Ritmo`, `Target` e `Plano`.
- Controles administrativos, como aprovar ISSF, criar lead, prescrever treino extra ou deletar sessao, ficam separados da visao do atleta.
- O Admin pode escolher quantos ultimos treinos/sessoes entram no cruzamento grafico; o padrao operacional e 5.
- O botao de deletar sessao ISSF e uma acao administrativa sensivel e deve manter confirmacao antes de apagar dados locais.
- A regressao de UI causada por JavaScript invalido no grafico radar do Admin foi corrigida; futuras mudancas de HTML/JS devem validar a pagina antes de uso operacional.
- O `Rhythm chart` do Admin deve ser validado contra `HCI_RHYTHM_TIMELINE` do Excel VBA, respeitando series reais e o recorte de ultimos treinos escolhido pelo Admin.

---
*Documento consolidado para fins de licenciamento e auditoria técnica.*
*Atualizado em: Junho de 2026*
