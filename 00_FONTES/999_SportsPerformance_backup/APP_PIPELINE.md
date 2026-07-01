# SportsPerformance App Pipeline

## Decisoes De Escopo

- O app beta deve priorizar simplicidade para o atleta.
- Para o app, manter 1 treino por fundamento por periodo de treino.
- A biblioteca completa de treinos fica preservada para uso futuro do Coach/Admin.
- No momento, o foco e deixar poucos treinos impecaveis, claros e executaveis.
- A expansao do banco completo para o Coach entra depois que a experiencia base estiver validada.

## Perfis De Acesso

- Admin: acesso full, configuracao, dados e revisao.
- Coach: seleciona atleta/evento, define metas, aprova entradas do atleta e prescreve treinos.
- Atleta: visualiza o proprio plano, abre o treino prescrito e envia dados para revisao.

## Fluxo De Entrada Do Atleta

- O atleta informa tiros manualmente ou importa PDF.
- Toda entrada do atleta nasce com status `PENDING_COACH_REVIEW`.
- Coach/Admin revisa a entrada.
- So depois da aprovacao a serie vira dado oficial e passa a alimentar dashboards, graficos e comparativos.

## Training Plan

- Coach informa a meta na area de treinamento.
- A meta sobe para a primeira tela/dashboard.
- Coach informa os percentuais dos fundamentos no topo do plano.
- O app gera 30 dias de treino seguindo a estrutura da aba Training Plan.
- Coach/Admin toca em uma celula e escolhe entre treinos compativeis.
- Atleta toca na celula e abre direto o treino prescrito, sem lista de edicao.

## Biblioteca De Treinos No App

- Cada fundamento deve ter um treino principal por periodo de treino.
- O treino escolhido precisa estar completo: objetivo, passo a passo, volume, duracao, criterios de qualidade e observacoes de seguranca.
- O banco ampliado fica disponivel futuramente para Coach/Admin, mas nao deve confundir o atleta na beta.

## Physical Training

- Criar aba propria para treino fisico.
- A prescricao deve considerar STD_GLOBAL, queda final, fase da periodizacao, carga, volume, frequencia e notas de seguranca.
- A primeira versao deve ser conservadora e muito clara para execucao.

## Dados

- Por enquanto os dados estao no Room local do app.
- A migracao futura deve levar os dados para um backend compartilhado, mantendo permissao por perfil.
- O Excel deixa de ser a base operacional do app e passa a ser referencia de validacao/importacao.

## Beta

- Validar fluxo completo: atleta envia, coach aprova, dado entra nos indicadores, treino aparece no plano.
- Validar graficos principais contra o Excel.
- Incluir botao de idioma Portugues/Ingles ja na versao beta.

## Relatorio De Habitualidade

- Criar fluxo de `Relatorio de Habitualidade` no app do atleta e na area Admin.
- O mesmo botao de relatorio deve existir na area Admin e na area do atleta no app.
- O relatorio deve permitir selecionar o periodo por:
  - `mes`
  - `6 meses`
  - `12 meses`
  - selecao manual de quantos meses o atleta quiser
- O periodo manual deve ancorar sempre `mes + ano` no relatorio final.
- O ano isolado nao e o principal; o filtro precisa aceitar janelas que atravessem dois anos, por exemplo `7 meses`.

## Dados Necessarios No Relatorio

- Data da prova/treino.
- Numero de tiros por dia.
- Prova.
- Arma.
- Numero da arma.
- Nome completo do atleta.
- Clube onde realizou a prova/treino.
- Numero do CR.
- CPF do atleta.

## Regras De Entrada

- O campo `numero da arma` deve abrir somente quando o fluxo pedir para enviar/gerar o relatorio.
- O campo `clube` deve entrar ao lado da data.
- O relatorio pode ter mais de um clube no periodo; a estrutura deve aceitar isso.
- O relatorio deve usar `nome completo do atleta`, nunca apelido ou nome curto.

## Persistencia Dos Dados Do Atleta

- No primeiro relatorio gerado, os dados cadastrais do atleta devem ficar gravados.
- Nos relatorios seguintes, esses dados devem voltar preenchidos automaticamente.
- O atleta so deve editar esses dados quando quiser alterar alguma informacao.

## Entrega Funcional

- O relatorio deve ser gerado a partir de dados reais do periodo selecionado.
- A mesma logica de geracao deve servir para:
  - atleta no app
  - Admin no desktop/Admin area
- O relatorio final precisa identificar claramente o periodo usado com referencia de mes e ano.
