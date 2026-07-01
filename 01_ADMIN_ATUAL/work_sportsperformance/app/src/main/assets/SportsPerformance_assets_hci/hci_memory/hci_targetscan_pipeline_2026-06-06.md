# HCI TargetScan Pipeline - estado aprovado para retomada (2026-06-06)

## Objetivo

Fechar primeiro a leitura do `TargetScan` antes de reabrir a pipeline de inteligencia direcional, insights e treino.

Regra central:

- primeiro transportar os tiros com fidelidade;
- depois apresentar para conferencia;
- depois consolidar leitura vetorial e diametro;
- so depois alimentar atleta/app;
- so depois reabrir a camada de inteligencia da matriz.

## Fonte de verdade atual

### Extracao base aprovada

O ponto de partida aprovado e o extrator do Admin desktop:

- `work/admin-desktop/hci_admin_control.py`

Funcoes-base aprovadas:

- `parse_target_scan_text(...)`
- `parse_target_scan_series_table(...)`
- `extract_targetscan_series_from_pdf_layout(...)`
- `extract_targetscan_series_from_exploded_pages(...)`
- `import_target_scan(...)`

Essas funcoes ja implementam a regra correta de transporte:

- tentar ler o layout do PDF;
- se nao fechar, cair para texto;
- montar `SR1..SR6`;
- nao inventar tiros;
- falhar explicitamente quando a serie nao fecha.

### Inteligencia direcional aprovada

A matriz de inteligencia direcional ja existe em:

- `app/src/main/assets/target_intelligence_direction_matrix.json`

O motor que consome essa matriz ja existe em:

- `app/src/main/java/com/example/sportsperformance/logic/TargetIntelligenceEngine.kt`

Limitacao atual verificada:

- hoje a consulta rica da matriz ainda esta aberta na pratica apenas para `DUEL_20`;
- ISSF ainda nao esta plenamente conectado a essa mesma matriz.

## Pipeline aprovada do TargetScan

### Fase 1 - Extracao conservadora

Entradas aceitas:

- PDF TargetScan
- texto extraido do TargetScan
- TXT/CSV exportado do TargetScan

Ordem de leitura:

1. Tentar extracao por layout do PDF.
2. Se nao fechar, tentar extracao por texto do PDF.
3. Se ainda nao fechar, aceitar texto/TXT/CSV colado/exportado.
4. Se nao houver 6 series completas de 10 tiros, falhar e reportar.

Saida obrigatoria desta fase:

- `DATA`
- `PROVA`
- `ATLETA` quando legivel
- `EVENTO`
- `SESSAO`
- `SR1..SR6`
- `T1..T10` por serie
- soma por serie apenas para conferencia

Regras:

- pistola: inteiro por padrao
- rifle/carabina: decimal
- preservar ordem oficial dos tiros
- nao ajustar tiro para fechar subtotal ou total
- total oficial serve para auditoria, nao para correcao artificial

### Fase 2 - Conferencia humana

Antes de gravar no atleta, apresentar:

- data do PDF
- tabela `SR1..SR6`
- tiro a tiro
- soma por serie
- total geral quando aplicavel
- observacao de incerteza quando houver

Contrato:

- primeiro apresentar aqui;
- so gravar depois de aprovacao do usuario.

### Fase 3 - Leitura vetorial do alvo

Depois da extracao dos tiros estar fechada:

- localizar centro oficial do alvo;
- localizar impactos vetoriais reais do PDF;
- classificar direcao angular;
- calcular distancia radial;
- calcular `QTDE_TIROS`, `PERCENTUAL_TIROS`, `DIST_MEDIA_MM` e `IDD_MEDIO`.

Modelo aprovado:

- pistola: 8 setores
- rifle/carabina: 4 quadrantes
- `IDD_MEDIO = QTDE_TIROS * DIST_MEDIA_MM`

Regra de seguranca:

- nao inventar coordenadas
- se o PDF nao entregar leitura vetorial confiavel, sinalizar

### Fase 4 - Diametro maximo

O `Ø` do TargetScan deve entrar como segunda leitura do alvo.

Uso aprovado:

- direcao responde: para onde o erro vai
- diametro responde: quao concentrado ou disperso o grupo esta

Classificacao aprovada:

Carabina:

- Elite: `<= 7 mm`
- Alto rendimento: entre `7 mm` e `14 mm`
- Iniciante: `<= 14 mm` como limite de referencia inicial

Pistola:

- Elite: `<= 1,6 mm`
- Alto rendimento: entre `1,6 mm` e `2,9 mm`
- Iniciante: `<= 2,9 mm` como limite de referencia inicial

Observacao operacional:

- o diametro nao substitui o `IDD_MEDIO`
- o diametro complementa a leitura de concentracao

### Fase 5 - Relatorio de aprovacao

Para cada PDF, apresentar um relatorio individual com:

1. identificacao do arquivo
2. data
3. prova
4. tiro a tiro `SR1..SR6`
5. soma por serie
6. total geral
7. diametro maximo
8. classificacao de concentracao
9. leitura direcional
10. formato do grafico esperado

### Fase 6 - Gravacao em atleta

So depois de aprovacao:

- gravar `athlete_submission`
- gravar `TargetSession` vetorial
- gravar data correta do PDF
- gravar contexto do atleta

Atleta-alvo aprovado nesta rodada:

- `OLIVEIRA, CLYNSON`

## Estado exato desta retomada

Ja confirmado:

- o radar ISSF no app ja foi adaptado para consumir `ISSF_PISTOL_VECTOR` quando existir `TargetSession`;
- o extrator do Admin e a melhor base atual para `TargetScan`;
- a matriz de inteligencia ja existe, mas a conexao rica ainda precisa ser aberta para ISSF;
- o usuario quer relatorios apresentados um a um antes de qualquer gravacao definitiva;
- a data do PDF deve entrar junto com os dados;
- o tiro a tiro e parte obrigatoria da aprovacao.

## Proxima sequencia obrigatoria

1. fechar leitura do primeiro PDF usando a base do Admin;
2. apresentar `DATA + SR1..SR6 + tiro a tiro + somas`;
3. adicionar `Ø` e classificacao de concentracao;
4. adicionar leitura vetorial;
5. obter aprovacao;
6. gravar em `Clynson`;
7. repetir para o proximo PDF;
8. so depois reabrir a pipeline de inteligencia/matriz ISSF.
