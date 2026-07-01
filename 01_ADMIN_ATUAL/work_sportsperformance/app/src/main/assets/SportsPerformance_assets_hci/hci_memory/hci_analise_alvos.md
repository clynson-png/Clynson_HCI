# HCI_analise_alvos

Modelo aprovado para leitura direcional e radial de alvos no HCI.

## Objetivo

O modelo `HCI_analise_alvos` mede a distribuicao dos disparos em relacao ao centro do alvo, classificando cada tiro por direcao angular e distancia radial. O objetivo e identificar o principal defeito tecnico do atleta a partir da combinacao entre recorrencia e afastamento medio, sem dar peso excessivo a pontos fora da curva.

## Escopo inicial

- Modalidade inicial validada: Pistola de Ar 10m.
- Fonte inicial validada: TargetScan, alvo principal com 60 disparos.
- O modelo tambem pode ser adaptado para carabina/rifle, preservando decimais e usando escala apropriada.
- Regra de rifle validada em 2026-06-01: para rifle/carabina, a leitura direcional usa 4 quadrantes, nao 8 setores de 45 graus.
- Regra de Duelo 20 validada em 2026-06-01: modalidade com 20 disparos, usando 8 direcoes radiais e centro.

## Modalidade Duelo 20

O Duelo 20 possui regras especificas de pontuacao e direcao:

### Modos e Pontuacoes Maximas
- **Duelo 20 - 10m**: Pontuacao maxima de 240 (20 disparos x 12). O 'X' vale 12 pontos.
- **Duelo 20 - 25m**: Pontuacao maxima de 200 (20 disparos x 10). O 'X' vale 10 pontos.

### Regras de 'X' e Direcao
- O 'X' deve ser SEMPRE registrado no **Centro (C)**.
- Qualquer disparo marcado como 'X' assume automaticamente a direcao central, invalidando outras direcoes radiais para esse tiro especifico.

### Referencia Direcional (Duelo 20)
Usa as mesmas 8 direcoes radiais de pistola mais o Centro:
`C` (Centro), `N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`.

## Referencia angular

Usar 8 setores de 45 graus, a partir do eixo zero.

Esta regra de 8 setores e padrao para pistola. Para rifle/carabina, usar a referencia especifica de 4 quadrantes.

Convencao:

| Angulo | Direcao |
| -----: | ------- |
| 0      | Direita |
| 45     | Superior direita |
| 90     | Acima |
| 135    | Superior esquerda |
| 180    | Esquerda |
| 225    | Inferior esquerda |
| 270    | Abaixo |
| 315    | Inferior direita |

Cada disparo deve ser classificado no setor angular mais proximo, com tolerancia operacional de +/- 22,5 graus em torno do eixo do setor.

## Referencia angular para rifle/carabina

Para rifle/carabina, usar 4 quadrantes de 90 graus, a partir do eixo zero.

Convencao operacional:

| Quadrante | Faixa angular | Direcao |
| --------- | ------------- | ------- |
| Q1 | 0 a 90 graus | Superior direita |
| Q2 | 90 a 180 graus | Superior esquerda |
| Q3 | 180 a 270 graus | Inferior esquerda |
| Q4 | 270 a 360 graus | Inferior direita |

Para cada quadrante, calcular `QTDE_TIROS`, `PERCENTUAL_TIROS`, `DIST_MEDIA_MM` e `IDD_MEDIO`.

O quadrante com maior `IDD_MEDIO` indica a tendencia tecnica principal. Quando dois quadrantes ficarem muito proximos, tratar como eixo ou zona de tendencia, nao como erro isolado.

## Medicao radial

Para cada disparo:

1. Identificar o centro oficial do alvo.
2. Identificar o centro do impacto/disparo.
3. Calcular o deslocamento horizontal e vertical em relacao ao centro.
4. Calcular a distancia radial em mm, sempre que houver escala confiavel.

Em TargetScan, quando o PDF trouxer objetos vetoriais, usar as coordenadas dos disparos e calibrar a escala pelos aneis oficiais do alvo. Conferir a calibracao comparando:

- deslocamento medio do grupo com as setas do TargetScan;
- diametro maximo calculado entre os impactos com o diametro `Ø` informado pelo TargetScan.

## Metricas por setor

Para cada setor angular, calcular:

- QTDE_TIROS: numero de disparos classificados no setor.
- PERCENTUAL_TIROS: QTDE_TIROS / total de tiros.
- DIST_MEDIA_MM: media das distancias radiais dos tiros daquele setor.
- IDD_MEDIO: indice direcional medio aprovado.

## Indice direcional medio aprovado

O indice padrao do modelo e:

`IDD_MEDIO = QTDE_TIROS * DIST_MEDIA_MM`

Justificativa:

- O indice combina recorrencia e intensidade do erro.
- A distancia maxima isolada nao deve ser usada como indice principal, pois pode representar ponto fora da curva estatistica.
- O setor com maior IDD_MEDIO indica o principal defeito direcional do atleta.

## Indice maximo

O indice baseado na maior distancia do setor nao deve ser usado como criterio principal.

Ele pode aparecer apenas como informacao auxiliar, quando o usuario pedir especificamente analise de tiro extremo ou dispersao maxima.

## Saida padrao

Tabela 1 - distribuicao direcional:

| ANGULO | DIRECAO | QTDE_TIROS | PERCENTUAL_TIROS | DIST_MEDIA_MM | IDD_MEDIO |
| -----: | ------- | ---------: | ---------------: | ------------: | --------: |

Tabela 2 - ranking de defeito direcional:

| RANK | ANGULO | DIRECAO | QTDE_TIROS | DIST_MEDIA_MM | IDD_MEDIO | LEITURA_HCI |
| ---: | -----: | ------- | ---------: | ------------: | --------: | ----------- |

## Saida grafica padrao

O modelo `HCI_analise_alvos` deve gerar, quando solicitado, um grafico radial preenchido para representar o peso direcional do alvo.

Regra visual:

- O raio de cada eixo representa o percentual do `IDD_MEDIO` daquele setor/quadrante em relacao ao `IDD_MEDIO` total.
- Os pontos devem ser ligados por uma linha.
- A area interna deve ser preenchida para mostrar o peso direcional do alvo.
- A distancia maxima nao deve ser usada como criterio principal do grafico.

Pistola:

- Usar 8 setores: 0, 45, 90, 135, 180, 225, 270 e 315 graus.
- Cada raio mostra `%IDD_MEDIO` do setor.

Rifle/carabina:

- Usar 4 quadrantes: Q1, Q2, Q3 e Q4.
- Cada raio mostra `%IDD_MEDIO` do quadrante.
- No grafico radial, cada quadrante deve ser representado pelo angulo central do quadrante, nao pelo limite inicial:
  - Q1, 0 a 90 graus, radial em 45 graus.
  - Q2, 90 a 180 graus, radial em 135 graus.
  - Q3, 180 a 270 graus, radial em 225 graus.
  - Q4, 270 a 360 graus, radial em 315 graus.

Leitura do grafico:

- O maior raio indica o setor/quadrante dominante.
- Raios vizinhos altos indicam zona de tendencia.
- Em rifle/carabina, Q1 + Q4 altos indicam predominancia do lado direito; Q2 + Q3 altos indicam predominancia do lado esquerdo.

## Saida de prescricao sintetica

Quando o usuario pedir prescricao, recomendacao ou resumo pratico para o atleta a partir da analise direcional, usar preferencialmente uma saida curta com:

1. Dois insights principais.
2. Um exercicio tecnico principal.

Para pistola, no caso validado com tendencia dominante em 315 graus e setores inferiores relevantes, a prescricao aprovada foi:

Insight 1: o erro principal esta no final do disparo. O padrao para baixo-direita, somado aos setores inferiores, indica perda de estabilidade no momento do acionamento ou logo apos o disparo.

Insight 2: o foco deve ser follow through + gatilho progressivo. A prioridade nao e mirar mais forte, mas manter mira, punho e posicao depois do disparo, deixando o gatilho acontecer de forma continua, sem puxao ou antecipacao.

Exercicio: disparo seco com follow through. Subir a arma, entrar na area de visada, respirar abdominalmente, acionar o gatilho de forma gradual e, apos o clique, manter mira e punho parados por 2 segundos antes de baixar. Volume sugerido: 30 repeticoes em seco + 20 tiros reais aplicando a mesma regra.

Frase-chave: o tiro so termina 2 segundos depois do disparo.

## Leitura HCI

Interpretacao principal:

- O maior IDD_MEDIO indica o defeito direcional dominante.
- Setores adjacentes com IDD_MEDIO alto devem ser lidos como zona de tendencia, nao como defeitos isolados.
- Setores opostos com IDD_MEDIO alto podem indicar instabilidade geral, oscilacao de alinhamento ou variabilidade de execucao.
- A leitura tecnica final deve considerar modalidade, prova, arma e contexto do treino/competicao.

## Regras de seguranca

- Nao inventar impactos, coordenadas ou medidas ausentes.
- Se a imagem nao permitir medir com confianca, informar que a leitura e estimada.
- Quando nao houver escala confiavel, usar pixels ou porcentagem relativa e marcar a unidade claramente.
- Nao usar distancia maxima como defeito principal salvo pedido explicito do usuario.
- Preservar a tabela de tiros/pontuacao original quando a analise radial for feita junto com extracao de pontuacao.

## Nome do modelo

Nome oficial aprovado pelo usuario:

`HCI_analise_alvos`
