# Central TI

Sistema interno para gestão de computadores, materiais, recepções, equipamentos, redes, patrimônio, demandas e comunicação entre usuários.

## Iniciar

Requer Node.js 20 ou superior.

```powershell
npm start
```

Abra `http://localhost:3000` no navegador.

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

### Compartilhar na mesma rede

Com o sistema iniciado nesta máquina, o painel mostra o endereço de rede local, por exemplo `http://192.168.x.x:3000`. Envie esse endereço ao seu amigo: ambos trabalharão com os mesmos cadastros e mensagens em tempo real ao atualizar a página.

Se o Windows solicitar permissão de rede para o Node.js, permita o acesso em **Redes privadas**. O computador que executa `npm start` deve ficar ligado enquanto houver usuários acessando.

## Acessos iniciais

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | admin@centralti.local | 123456 |
| TI | ti@centralti.local | 123456 |
| Recepção | recepcao@centralti.local | 123456 |

No primeiro acesso, as contas demonstrativas devem trocar a senha. A senha precisa ter ao menos 8 caracteres, incluindo letra maiúscula, minúscula, número e símbolo. As senhas são guardadas somente como hash com `scrypt` e salt individual. Os dados são persistidos em `storage/central-ti.json`, que é criado no primeiro início.

Para criptografar a base local em repouso, configure `CENTRAL_TI_DATA_ENCRYPTION_KEY` com uma chave Base64 de 32 bytes (o comando para gerá-la está no `.env.example`). A próxima gravação converte a base existente para AES-256-GCM; mantenha a chave fora do Git e em um gerenciador de segredos. Esta proteção vale para o modo de arquivo local, incluindo novos backups.

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
