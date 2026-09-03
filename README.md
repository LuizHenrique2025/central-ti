# Central TI

Sistema interno para gestão de computadores, materiais, recepções, equipamentos, redes, patrimônio, demandas e comunicação entre usuários.

## Iniciar

Requer Node.js 20 ou superior.

```powershell
npm start
```

Em desenvolvimento, abra `http://localhost:3000` no navegador.

## Estrutura do projeto

```text
public/
  index.html          Entrada da interface
  assets/js/          JavaScript do navegador
  assets/css/         Estilos da interface
server/
  core/               Configuração, HTTP, segurança e arquivos estáticos
  domain/             Definições e regras dos módulos
  services/           Integrações, como envio de e-mail
  server.js           Inicialização e rotas ainda não extraídas
tests/integration/    Testes do servidor e da interface pública
scripts/              Instalação e manutenção no Windows
storage/              Dados locais (não enviados ao GitHub)
backups/              Cópias locais (não enviadas ao GitHub)
```

## Fluxo de desenvolvimento

Toda correção, melhoria ou nova funcionalidade é rastreada por Issue e entregue por Pull Request. Consulte [AGENTS.md](AGENTS.md) para o fluxo obrigatório: Issue antes da implementação, branch por Issue, testes, PR com `Closes #<número>` e deploy somente após aprovação.

### Desenvolvimento na mesma rede

Por padrão, o servidor aceita o acesso pela rede local, usando o endereço exibido no painel, por exemplo `http://192.168.x.x:3000`. O tráfego direto é HTTP; use-o apenas em uma rede interna confiável. Para produção ou acesso fora da rede local, publique a Central TI por um reverse proxy HTTPS e compartilhe apenas a URL HTTPS do proxy.

## Primeiro administrador

Uma base nova não possui contas demonstrativas ou credenciais previsíveis. Antes do primeiro início, defina fora do Git as três variáveis `CENTRAL_TI_BOOTSTRAP_ADMIN_NAME`, `CENTRAL_TI_BOOTSTRAP_ADMIN_EMAIL` e `CENTRAL_TI_BOOTSTRAP_ADMIN_PASSWORD`. A senha precisa ter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo.

Depois que a primeira conta for criada, remova essas variáveis do ambiente. Instalações já existentes preservam os usuários e dados atuais. As senhas são guardadas somente como hash com `scrypt` e salt individual.

## Produção com HTTPS

Em produção, defina `NODE_ENV=production`. HTTPS passa a ser obrigatório e não pode ser desligado por variável de ambiente. A Central TI só inicia se `CENTRAL_TI_TRUST_PROXY=true` e `HOST` for local (`127.0.0.1`, `::1` ou `localhost`). Publique o sistema por um reverse proxy, como Caddy ou Nginx:

`Cliente → HTTPS → Reverse proxy → Central TI (127.0.0.1:3000)`

O proxy deve encaminhar `X-Forwarded-Proto: https`; então defina `CENTRAL_TI_TRUST_PROXY=true`. Não exponha diretamente a porta do Node. A aplicação retorna HTTP 426 para tráfego direto inseguro e envia HSTS. A opção `CENTRAL_TI_REQUIRE_HTTPS` pode ser usada apenas fora de produção para antecipar esse bloqueio em um ambiente controlado.

Para usar a base local, configure obrigatoriamente `CENTRAL_TI_DATA_ENCRYPTION_KEY` com uma chave Base64 de 32 bytes (o comando para gerá-la está no `.env.example`). A próxima gravação converte a base existente para AES-256-GCM; mantenha a chave fora do Git e em um gerenciador de segredos. Esta proteção vale para o modo de arquivo local, incluindo novos backups.

### Redefinir senha de um usuário

Entre com um perfil de **Administrador**, abra **Usuários**, localize o cadastro pelo e-mail e clique em **Redefinir senha**. Informe e confirme uma senha temporária. As sessões ativas daquele usuário serão encerradas e ele terá de trocar a senha no próximo acesso.

### Redefinir senha de um usuário

Entre com um perfil de **Administrador**, abra **Usuários**, localize o cadastro pelo e-mail e clique em **Redefinir senha**. Informe e confirme uma senha temporária. As sessões ativas daquele usuário serão encerradas e ele terá de trocar a senha no próximo acesso.

Para uma implantação corporativa, defina `DATABASE_URL` com a conexão PostgreSQL. Por segurança, a aplicação não cria, altera nem importa dados para esse banco automaticamente. Ela apenas verifica se a estrutura necessária já existe. Para uma criação ou atualização planejada da estrutura, com backup confirmado, defina também `CENTRAL_TI_RUN_MIGRATIONS=true` somente nessa execução. Use HTTPS, recuperação de senha e autenticação institucional antes de publicar fora da rede interna.

## Scripts para Windows

Os scripts em `scripts/` devem ser executados em PowerShell como administrador:

- `provision-postgres.ps1` prepara o banco PostgreSQL e deve ser revisado separadamente antes do uso em produção.
- `install-autostart.ps1` cria a tarefa de inicialização automática. Ele nunca encerra um processo desconhecido que esteja usando a porta configurada.
- `restart-autostart.ps1` reinicia somente a tarefa da Central TI.
- `install-microsip-dialer.ps1` registra, para o usuário atual, o botão **Ligar** dos Ramais e autoriza o protocolo somente nas origens da Central TI. Ele requer Python 3 e MicroSIP instalados na mesma máquina; cada ligação abre o MicroSIP daquele usuário sem uma segunda confirmação do Chrome. Reinicie o Chrome após a instalação.
- `distribution/microsip-client/` contém o pacote-base para distribuir o discador aos demais computadores.

Revise os parâmetros antes de executar. Esses scripts alteram serviços e tarefas do Windows e não são necessários para desenvolvimento local.

## Backup

No modo de arquivo local, a Central TI cria um backup diário em `backups/` e mantém os 30 mais recentes. Um administrador também pode gerar um backup imediato na tela **Usuários**. Essa pasta é ignorada pelo Git e não é publicada no GitHub.

## Validação em duas etapas por e-mail

Há suporte para exigir um código de seis dígitos enviado ao e-mail do usuário após a senha correta. Copie `.env.example` para `.env`, preencha os dados de SMTP e inicie o sistema com essas variáveis de ambiente. Para Gmail, ative a verificação em duas etapas na Conta Google e gere uma **Senha de app**; não use sua senha normal do Google.

Antes de ativar `EMAIL_2FA_REQUIRED=true`, crie usuários com e-mails reais na tela **Usuários**. As contas `@centralti.local` são somente demonstrativas e não recebem mensagens.
