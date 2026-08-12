# Central TI

Sistema interno para gestão de computadores, materiais, recepções, equipamentos, redes, patrimônio, demandas e comunicação entre usuários.

## Iniciar

Requer Node.js 20 ou superior.

```powershell
npm start
```

Abra `http://localhost:3000` no navegador.

### Compartilhar na mesma rede

Com o sistema iniciado nesta máquina, o painel mostra o endereço de rede local, por exemplo `http://192.168.x.x:3000`. Envie esse endereço ao seu amigo: ambos trabalharão com os mesmos cadastros e mensagens em tempo real ao atualizar a página.

Se o Windows solicitar permissão de rede para o Node.js, permita o acesso em **Redes privadas**. O computador que executa `npm start` deve ficar ligado enquanto houver usuários acessando.

## Acessos iniciais

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Administrador | admin@centralti.local | 123456 |
| TI | ti@centralti.local | 123456 |
| Recepção | recepcao@centralti.local | 123456 |

No primeiro acesso, as contas demonstrativas devem trocar a senha. A senha precisa ter ao menos 12 caracteres, incluindo letra maiúscula, minúscula, número e símbolo. Os dados são persistidos em `storage/central-ti.json`, que é criado no primeiro início. Para uma implantação corporativa, defina a variável de ambiente `DATABASE_URL` com a conexão PostgreSQL antes de iniciar o sistema; ele criará e migrará as tabelas automaticamente. Use HTTPS, recuperação de senha e autenticação institucional antes de publicar fora da rede interna.

## Backup

No modo de arquivo local, a Central TI cria um backup diário em `backups/` e mantém os 30 mais recentes. Um administrador também pode gerar um backup imediato na tela **Usuários**. Essa pasta é ignorada pelo Git e não é publicada no GitHub.

## Validação em duas etapas por e-mail

Há suporte para exigir um código de seis dígitos enviado ao e-mail do usuário após a senha correta. Copie `.env.example` para `.env`, preencha os dados de SMTP e inicie o sistema com essas variáveis de ambiente. Para Gmail, ative a verificação em duas etapas na Conta Google e gere uma **Senha de app**; não use sua senha normal do Google.

Antes de ativar `EMAIL_2FA_REQUIRED=true`, crie usuários com e-mails reais na tela **Usuários**. As contas `@centralti.local` são somente demonstrativas e não recebem mensagens.
