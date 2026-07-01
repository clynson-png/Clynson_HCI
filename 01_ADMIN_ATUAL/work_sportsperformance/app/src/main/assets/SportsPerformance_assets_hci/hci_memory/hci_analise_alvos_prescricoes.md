# HCI_analise_alvos - Prescricoes padrao

Modelo complementar para transformar a leitura direcional/radial de alvos em frases e prescricoes curtas.

## Regra de saida aprovada

Toda prescricao sintetica deve entregar apenas:

1. Dois insights.
2. Um exercicio principal.

O texto deve ser direto, em linguagem de atleta, e baseado no `IDD_MEDIO`, nao na maior distancia isolada.

Para Duelo 20, as frases base de Pistola (8 setores) sao aplicaveis, considerando que 'X' (Centro) indica precisao ideal.

## Indice principal

Usar sempre:

`IDD_MEDIO = QTDE_TIROS * DIST_MEDIA_MM`

O setor com maior `IDD_MEDIO` indica o defeito direcional dominante.

## Tipos de combinacao

### 1. Dominante isolado

Uso: quando um setor tem o maior `IDD_MEDIO` e os setores adjacentes nao passam de 70% do indice dominante.

Leitura: defeito direcional claro naquele setor.

### 2. Zona adjacente

Uso: quando o setor dominante e pelo menos um setor vizinho passam de 70% do `IDD_MEDIO` dominante.

Leitura: tendencia de zona, nao defeitos separados.

Exemplo: `270 + 315` = tendencia para baixo / baixo-direita.

### 3. Eixo oposto

Uso: quando dois setores opostos estao entre os maiores indices e ambos passam de 70% do dominante.

Leitura: instabilidade de eixo, oscilacao tecnica ou dificuldade de repetir posicao/acionamento.

### 4. Zona inferior

Uso: quando `225 + 270 + 315` concentram peso relevante.

Leitura: queda no final do disparo, antecipacao, gatilho agressivo, follow through curto ou perda de pulso.

### 5. Zona superior

Uso: quando `45 + 90 + 135` concentram peso relevante.

Leitura: sustentacao excessiva, tensao, cabeca/postura ou tentativa de segurar/mirar demais.

### 6. Zona lateral esquerda

Uso: quando `135 + 180 + 225` concentram peso relevante.

Leitura: alinhamento de miras, empunhadura, posicao do dedo no gatilho ou desvio de postura.

### 7. Zona lateral direita

Uso: quando `315 + 0 + 45` concentram peso relevante.

Leitura: pulso, empunhadura, respiracao/posicao interna e saida lateral no acionamento.

## Direcoes de pistola - frases base

### 0 graus - direita

Insight 1: o agrupamento foge para a direita, indicando interferencia lateral no final do disparo.

Insight 2: o foco deve ser area de visada, pulso firme e follow through.

Exercicio: disparo seco com mira mantida por 2 segundos apos o clique, conferindo se o pulso nao empurra a arma para a direita.

### 45 graus - superior direita

Insight 1: o erro sobe e sai para a direita, sugerindo respiracao alta ou posicao interna instavel.

Insight 2: o foco deve ser respirar abdominalmente, ajustar empunhadura e sentir a posicao antes do acionamento.

Exercicio: sustentacao com respiracao abdominal, entrando na area de visada e baixando a arma sem disparar quando houver tensao.

### 90 graus - acima

Insight 1: os tiros altos indicam excesso de sustentacao, ativacao muscular ou tentativa de segurar demais a mira.

Insight 2: o foco deve ser reduzir tensao e deixar o disparo acontecer dentro da area de visada.

Exercicio: serie de disparo seco com tempo limite de 6 a 8 segundos, baixando a arma se o disparo nao acontecer com naturalidade.

### 135 graus - superior esquerda

Insight 1: o erro para superior esquerda aponta possivel desalinhamento de gatilho, cabeca ou pressao irregular na empunhadura.

Insight 2: o foco deve ser posicao da cabeca, menos pressao na empunhadura e gatilho reto.

Exercicio: disparo seco com checagem do dedo no gatilho e da cabeca antes de cada acionamento.

### 180 graus - esquerda

Insight 1: a fuga para esquerda indica problema de alinhamento de miras, area de visada ou pressao lateral de empunhadura.

Insight 2: o foco deve ser acionar de forma gradual sem empurrar a arma para fora da linha.

Exercicio: disparo seco contra parede branca, observando se a massa de mira desloca para a esquerda durante o clique.

### 225 graus - inferior esquerda

Insight 1: o erro baixo-esquerda sugere antecipacao, gatilho agressivo ou perda de estrutura no acionamento.

Insight 2: o foco deve ser alinhamento de miras, ajuste de empunhadura e pressao progressiva no gatilho.

Exercicio: disparo seco com pausa no pre-disparo, aumentando a pressao do gatilho de forma continua e sem decidir o instante do disparo.

### 270 graus - abaixo

Insight 1: os tiros baixos indicam queda no final do disparo ou abandono do follow through.

Insight 2: o foco deve ser posicao do dedo no gatilho, posicao dos pes, pulso firme e permanencia depois do disparo.

Exercicio: disparo seco com follow through de 2 segundos, mantendo mira e punho na mesma posicao apos o clique.

### 315 graus - inferior direita

Insight 1: o erro principal esta no final do disparo, com perda de estabilidade para baixo-direita.

Insight 2: o foco deve ser follow through e gatilho progressivo, sem puxao ou antecipacao.

Exercicio: disparo seco com follow through: subir a arma, respirar abdominalmente, acionar gradual e manter mira e punho parados por 2 segundos apos o clique.

## Combinacao validada - zona inferior direita em pistola

Quando 315 graus for dominante e houver peso relevante nos setores inferiores, a prescricao aprovada e:

Insight 1: o erro principal esta no final do disparo. O padrao para baixo-direita, somado aos setores inferiores, indica perda de estabilidade no momento do acionamento ou logo apos o disparo.

Insight 2: o foco deve ser follow through + gatilho progressivo. A prioridade nao e mirar mais forte, mas manter mira, punho e posicao depois do disparo, deixando o gatilho acontecer de forma continua, sem puxao ou antecipacao.

Exercicio: disparo seco com follow through. Subir a arma e entrar na area de visada, respirar abdominalmente, acionar o gatilho de forma gradual e, apos o clique, manter mira e punho parados por 2 segundos antes de baixar. Volume sugerido: 30 repeticoes em seco + 20 tiros reais aplicando a mesma regra.

Frase-chave: o tiro so termina 2 segundos depois do disparo.

## Rifle/carabina - regra de quadrantes

Para rifle/carabina, a leitura direcional do `HCI_analise_alvos` usa 4 quadrantes de 90 graus, nao os 8 setores de pistola.

Convencao:

| Quadrante | Faixa angular | Direcao |
| --------- | ------------- | ------- |
| Q1 | 0 a 90 graus | Superior direita |
| Q2 | 90 a 180 graus | Superior esquerda |
| Q3 | 180 a 270 graus | Inferior esquerda |
| Q4 | 270 a 360 graus | Inferior direita |

O indice principal continua sendo:

`IDD_MEDIO = QTDE_TIROS * DIST_MEDIA_MM`

### Tipos de combinacao para rifle/carabina

#### 1. Quadrante dominante isolado

Uso: quando um quadrante tem o maior `IDD_MEDIO` e nenhum quadrante vizinho fica proximo de 90% do dominante.

Leitura: tendencia direcional clara naquele quadrante.

#### 2. Lado dominante

Uso: quando dois quadrantes do mesmo lado concentram os maiores pesos.

Exemplos:

- Q1 + Q4 = lado direito.
- Q2 + Q3 = lado esquerdo.
- Q1 + Q2 = zona superior.
- Q3 + Q4 = zona inferior.

Leitura: em rifle, quando dois quadrantes do mesmo lado aparecem fortes, tratar como tendencia de posicao/estrutura, nao como mira isolada.

#### 3. Eixo oposto

Uso: quando quadrantes opostos aparecem fortes.

Exemplos:

- Q1 + Q3 = diagonal superior direita / inferior esquerda.
- Q2 + Q4 = diagonal superior esquerda / inferior direita.

Leitura: indica oscilacao de posicao, centro de gravidade, respiracao ou repeticao de apoio.

## Rifle/carabina - frases base

### Q1 - superior direita

Insight 1: o agrupamento sobe e vai para a direita, indicando que a posicao natural pode estar levando a arma para fora do centro.

Insight 2: o foco deve ser centro de gravidade, apoio/contato da arma e relaxamento da posicao antes do acionamento.

Exercicio: checagem de posicao natural com olhos fechados, ajustando o corpo ate a mira voltar ao centro sem correcao muscular.

### Q2 - superior esquerda

Insight 1: o agrupamento sobe e vai para a esquerda, sugerindo tensao de postura, cabeca ou ajuste lateral de apoio.

Insight 2: o foco deve ser repetir cabeca, apoio e respiracao sem empurrar a arma para o centro.

Exercicio: posicao natural com pausa respiratoria curta, conferindo se a mira retorna ao centro apos abrir os olhos.

### Q3 - inferior esquerda

Insight 1: o agrupamento cai para a esquerda, sugerindo perda de sustentacao, centro de gravidade baixo ou interferencia no acionamento.

Insight 2: o foco deve ser estabilidade do apoio, respiracao e manutencao da linha da arma depois do disparo.

Exercicio: disparo seco com permanencia, mantendo a mira na area por 2 segundos apos o clique.

### Q4 - inferior direita

Insight 1: o agrupamento cai para a direita, indicando perda de posicao ou pressao lateral no final da execucao.

Insight 2: o foco deve ser posicao natural, contato da arma e finalizacao sem corrigir no braco.

Exercicio: checagem de posicao natural seguida de disparo seco com follow through de 2 segundos.

## Combinacao validada - lado direito em rifle/carabina

Quando Q1 e Q4 aparecem como os dois maiores indices e ficam muito proximos, a prescricao aprovada e:

Insight 1: o alvo mostra predominancia do lado direito. Mais da metade do peso direcional esta nos quadrantes direitos, sugerindo ajuste de posicao, centro de gravidade, contato da arma ou pressao lateral na execucao.

Insight 2: a oscilacao entre superior direita e inferior direita indica instabilidade de posicao. Como o erro aparece tanto acima quanto abaixo no lado direito, o problema provavel nao e apenas mira; pode ser repeticao de posicao, tensao corporal, apoio/ombro ou acionamento interferindo na linha da arma.

Exercicio: checagem de posicao natural + disparo seco. Entrar na posicao completa, fechar os olhos por 3 segundos, respirar normalmente, abrir os olhos e observar para onde a mira aponta naturalmente. Se estiver a direita, ajustar a posicao do corpo, nao corrigir no braco. Fazer o disparo seco mantendo a mira na area por 2 segundos apos o clique. Volume sugerido: 20 repeticoes de posicao natural + 20 disparos secos.

Frase-chave: nao traga a mira para o centro com forca; ajuste a posicao ate o centro aparecer naturalmente.
