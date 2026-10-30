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

## Atualização das telas e histórico de demandas

O quadro consulta uma projeção leve das demandas, sem conversas ou anexos, e
carrega inicialmente até 25 registros de cada status concluído. Todas as demandas
ativas continuam visíveis. **Carregar mais concluídas** amplia o histórico; a
pesquisa e os filtros consultam também as concluídas ainda não carregadas.
Descrições, conversas e anexos são consultados ao abrir detalhes ou editar.

A API de listagem anterior continua disponível. A interface usa
`GET /api/resources/demandas?view=board`, com `completedLimit` e filtros de tipo,
pesquisa, responsável, solicitante e data. A resposta inclui os totais por status
e opções de filtros, sempre limitados ao escopo do usuário autenticado.

Os avisos periódicos usam `GET /api/messages/summary`, que retorna quantidade e
identificadores das mensagens não lidas e os dados do aviso mais recente, sem o
conteúdo das conversas. A caixa de e-mail completa é consultada ao abrir essa tela.
A atualização ocorre a cada 15 segundos nas telas visíveis; horários de
sincronização, isoladamente, não provocam reconstrução da interface.

### Quadro Demandas Hospital

O quadro Hospital usa cards inteiros como botões de detalhes. Quem pode alterar
demandas também encontra um menu de status no card e pode arrastá-lo entre
colunas. Colunas vazias ficam em trilhos expansíveis; **Aberta** permanece aberta.
Os filtros rápidos de SLA podem ser ativados e desativados sem novas consultas.

O calendário de abertura seleciona início e fim e aplica o período após a segunda
seleção. As setas navegam pelos dias, Page Up/Down trocam o mês e Escape fecha.
A API do quadro aceita `createdStart` e `createdEnd` no formato `YYYY-MM-DD`,
inclusive nas duas extremidades, com o `timezoneOffset` do usuário. O parâmetro
anterior `createdDate` continua disponível para uma única data. Datas inválidas
ou um período invertido retornam HTTP 422. Nenhuma migração é necessária.

Uma demanda concluída é identificada como **Concluída**: o quadro não afirma
cumprimento de SLA sem uma data de conclusão confiável. Temas e componentes
usam a estrutura HTML/CSS/JavaScript existente; a classe `dark` é um alias do
tema escuro, preservando a compatibilidade com `light-theme`.

## Backup

No modo de arquivo local, a Central TI cria um backup diário em `backups/` e mantém os 30 mais recentes. Um administrador também pode gerar um backup imediato na tela **Usuários**. Essa pasta é ignorada pelo Git e não é publicada no GitHub.

## Validação em duas etapas por e-mail

Há suporte para exigir um código de seis dígitos enviado ao e-mail do usuário após a senha correta. Copie `.env.example` para `.env`, preencha os dados de SMTP e inicie o sistema com essas variáveis de ambiente. Para Gmail, ative a verificação em duas etapas na Conta Google e gere uma **Senha de app**; não use sua senha normal do Google.

Antes de ativar `EMAIL_2FA_REQUIRED=true`, crie usuários com e-mails reais na tela **Usuários**. As contas `@centralti.local` são somente demonstrativas e não recebem mensagens.

### Demandas Internas

O quadro de Demandas Internas compartilha os componentes, temas, calendário e ações acessíveis do Hospital. Possui distribuição por etapa, alternância Quadro/Lista, atalho `/` para busca e filtros combináveis de SLA e prioridade. A lista conserva os mesmos registros paginados e o botão de carregar concluídas.

A consulta `GET /api/resources/demandas?view=board` aceita também `priority=Crítica|Alta|Média|Baixa` (opcional, ampliação autorizada). O filtro é aplicado antes da paginação e mantém as permissões existentes. Valores inválidos retornam 422. Não há alteração de schema, dependências ou variáveis de ambiente.

### Relatórios

A visão geral utiliza os indicadores e agrupamentos reais de `demandReport`, respeitando os filtros aplicados. Os atalhos de 7, 30 e 90 dias refazem a consulta existente; os gráficos agregam aberturas por dia, mês ou ano conforme o volume de datas. Taxa de conclusão, status, solicitantes distintos e desempenho por profissional são calculados a partir da mesma consulta.

Os filtros podem ser recolhidos. As abas de Demandas, Exclusões, Inventário e Auditoria e as ações reais de exportação CSV e impressão permanecem disponíveis. Não é exibido tempo médio de resolução ou comparação com período anterior sem dados confiáveis. A tela reutiliza os temas do quadro; não adiciona endpoints, dependências, schema ou variáveis de ambiente.

A apresentação de Internas utiliza um painel único de filtros, prioridades e fluxo segmentado, com cards compactos e borda por prioridade. A abertura ocorre pelo card e as ações de status ficam no menu acessível compartilhado com o Hospital. Todas as etapas permanecem visíveis, com rolagem horizontal quando necessário; os dois tipos reutilizam o mesmo card e as colunas recolhíveis. Os nomes dos status e o cálculo dos indicadores continuam vindo do sistema.

### Padrão visual compartilhado

As telas autenticadas utilizam `public/assets/css/central-ui.css` como fonte comum dos tokens claro/escuro, navegação, cabeçalhos, controles, painéis, tabelas e formulários. Os estilos específicos dos quadros e relatórios complementam essa base. O controle de tema fica no cabeçalho de todas as telas; login e troca obrigatória de senha ficam fora da classe de apresentação autenticada.

O contêiner da aplicação é neutro, com um único landmark principal por tela. Nos formulários modais, o contêiner recebe a semântica de diálogo e o formulário mantém seu comportamento de envio. O escopo local desta padronização está registrado em `docs/issues/padronizacao-visual-central.md`, sem publicação externa por orientação do responsável. Não há novas dependências, contratos de API, alterações de schema ou variáveis de ambiente.

### Tela de acesso — Novembro Azul

A apresentação de login está em `public/assets/js/features/login-view.js` e `public/assets/css/login-view.css`, com layout responsivo, laço SVG e temas claro/escuro. Identificação, senha, primeiro acesso, código de verificação e troca obrigatória usam os mesmos handlers e validações existentes. O controle de tema fica no rodapé da tela de acesso. A ajuda continua orientando a procurar o administrador; não cria solicitação ou canal externo.

A campanha Novembro Azul segue a referência solicitada e não possui agendamento automático. Os estilos ficam restritos à classe `auth-page`. Registro local do escopo: `docs/issues/nova-tela-login.md`. Nenhuma API, tabela, dependência ou variável de ambiente foi acrescentada.

### Quadros de demandas unificados

Demandas Internas e Demandas Hospital usam a mesma montagem de filtros, prioridades, fluxo, cards, menus e visão de lista. A página determina o tipo consultado e a identificação do contexto. Os cards abrem por botão semântico; ações de status ficam no menu acessível e o arraste respeita as permissões existentes. Não há botão redundante nem select no card. Colunas vazias podem ser expandidas no Kanban, com Aberta sempre aberta; na Lista, as etapas permanecem expandidas.

Prioridade, período, responsável e solicitante reutilizam a consulta de quadro existente nos dois tipos, com paginação de concluídas e totais por consulta. Escopo local: `docs/issues/unifica-quadros-demandas.md`. Nenhum contrato de API, schema ou variável de ambiente foi alterado.
