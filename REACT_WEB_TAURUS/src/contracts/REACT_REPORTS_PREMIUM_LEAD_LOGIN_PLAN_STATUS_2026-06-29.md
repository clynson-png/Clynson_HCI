# REACT Reports Premium - Lead Login Plan Status

Data: 2026-06-29

## Escopo executado

- Login do atleta permanece sem senha e usa somente o nome cadastrado nos leads.
- O lead passa a carregar `subscriptionTier`.
- Leads novos criados no Admin nascem como `FREE`.
- O Admin agora consegue salvar o plano do lead como `FREE`, `PREMIUM` ou `ADMIN`.
- O schema unificado propaga `subscriptionTier` e `role` do lead para o atleta derivado.
- A sessao de login herda o plano salvo no lead.

## Regra operacional

- `FREE`: acessa area do atleta e Taurus Target, mas nao libera PDF premium.
- `PREMIUM`: libera PDF premium e Smart Chart conforme gates de assinatura.
- `ADMIN`: herda acesso premium e perfil administrativo.

## Observacao de uso

Se o plano de um atleta for alterado no Admin enquanto ele ja estiver logado, ele deve sair e entrar novamente pelo nome para renovar a sessao local.

## Validacao

Comando executado:

```bash
npm.cmd run build
```

Resultado:

- Build concluido com sucesso.
- Aviso existente do Vite sobre chunk grande permanece sem bloquear a entrega.
