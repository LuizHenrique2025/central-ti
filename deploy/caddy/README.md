# HTTPS na base de teste

Este diretório contém somente a configuração da base de teste. Ele não altera
a instância de produção em `:3000` e não publica a porta HTTP da aplicação.

## Endereço de teste

O nome padrão é `centralti-teste.revitalite.com.br`, na porta `3443`. Antes de
iniciar o proxy, crie um registro DNS interno para esse nome apontando ao IP do
servidor de teste. Caso o DNS use outro nome, defina `CENTRAL_TI_TEST_HOST`
antes de iniciar o Caddy.

## Pré-requisitos

- Caddy instalado apenas no servidor.
- Uma base de teste isolada da produção, escutando em `127.0.0.1:3001`.
- A base de teste iniciada com `NODE_ENV=production`,
  `CENTRAL_TI_TRUST_PROXY=true` e `HOST=127.0.0.1`.
- Porta `3443` liberada apenas para a rede de testes.

## Validar e iniciar

```powershell
caddy validate --config deploy/caddy/Caddyfile.test --adapter caddyfile
caddy run --config deploy/caddy/Caddyfile.test --adapter caddyfile
```

O Caddy emite um certificado interno para o ambiente de teste. Para eliminar o
aviso do navegador, instale a autoridade certificadora interna do Caddy somente
nos computadores participantes do teste. Não copie chaves privadas, arquivos de
ambiente ou dados operacionais para este repositório.

## Critérios de validação

1. Abrir `https://centralti-teste.revitalite.com.br:3443` de outro computador.
2. Confirmar que o navegador confia no certificado.
3. Validar login, segundo fator, anexos e logout.
4. Confirmar que `http://IP-do-servidor:3001` não é acessível pela rede.

Após a validação, a configuração de produção usará
`centralti.revitalite.com.br` na porta HTTPS padrão e encaminhará apenas para
`127.0.0.1:3000`.
