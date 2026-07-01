# HCI HAPPY Forms

Formulário web estilo Google Forms para HCI HAPPY Check-in.

## Arquivos

- `index.html`: formulário principal.
- `manifest.json`: configuração PWA.
- `service-worker.js`: cache offline depois do primeiro acesso.

## Como usar no iPhone

1. Hospede a pasta em GitHub Pages, Netlify ou Cloudflare Pages.
2. Abra o link no Safari.
3. Toque em Compartilhar.
4. Toque em "Adicionar à Tela de Início".
5. Use como app.

## Google Drive

O Google Drive pode armazenar os arquivos, mas não é ideal para hospedar como site/app.
Para funcionar como formulário no iPhone, use GitHub Pages, Netlify ou Cloudflare Pages.

## Saída

O formulário gera JSON compatível com:

`HCI_HAPPY_IMPORT_ENGINE`

## HCI TAURUS Mobile

O app mobile TAURUS fica em `REACT_WEB_TAURUS`.

Link previsto apos GitHub Pages:

`https://clynson-png.github.io/Clynson_HCI/taurus-mobile/?mobile=1`

Fluxo inicial:

- `Entrada`: portal do atleta.
- `Target Taurus`: entrada de dados do alvo, salva como `PENDING`.
- `JSON para envio`: exporta somente entradas pendentes do atleta para WhatsApp/Admin.
- `Smart Chart`: recurso premium.
- `Library`: recurso premium.
- `Admin`: nao fica disponivel no mobile.

Publicacao:

- O workflow `.github/workflows/deploy-taurus-mobile.yml` compila `REACT_WEB_TAURUS`.
- O comando usado no Pages e `npm run build:pages`.
- O bundle publicado usa base `/Clynson_HCI/`.
- Enquanto o GitHub Pages estiver servindo a raiz do branch `main`, o pacote estatico fica em `taurus-mobile/`.
