# Nova tela de login — referência Novembro Azul

Registro local, conforme orientação do responsável para manter as alterações apenas locais. Branch `dev/nova-tela-login`, baseada na padronização visual da Central. Não criar Issue, PR ou publicação externa sem nova autorização.

## Objetivo

Aplicar a imagem fornecida como direção visual: painel em duas colunas, identidade Central TI, Novembro Azul, ilustração vetorial, tipografia e formulário com etapas de identificação e senha.

## Escopo e limites

Apresentação compartilhada para identificação, senha, primeiro acesso, confirmação por código e troca obrigatória de senha. Reutilizar handlers, campos, validações, proteção contra envios repetidos e controle de visibilidade da senha. Manter o tema claro/escuro e a ajuda existente, sem criar canais de contato ou APIs. Não alterar área autenticada, banco, autenticação, dependências ou variáveis de ambiente.

## Riscos e critérios de aceite

Conferir formulários longos, nomes extensos, conteúdo escapado, teclado/foco, campos de senha, ações de retorno, layout móvel e temas. Autenticação da prévia deve continuar funcionando. Executar testes existentes e checagem de sintaxe. Manter a prévia local disponível e a produção intacta.

## Implementação e validação

Apresentação em `public/assets/js/features/login-view.js` e `public/assets/css/login-view.css`, integrada por wrappers em app.js e pelo controle de tema em bootstrap.js. A ilustração é SVG estático; os valores externos continuam escapados em textos e atributos.

58 testes aprovados; sintaxe de 41 arquivos JavaScript e diff sem erros. Conferência dos temas claro/escuro em 1440, 1222, 1024, 768 e 390 px sem overflow horizontal. Formulários de senha, primeiro acesso, conclusão de cadastro, código e troca obrigatória foram renderizados em desktop e celular sem overflow interno; formulários longos permitem rolagem vertical.

Login real da conta fictícia da prévia concluído; mostrar/ocultar senha, retorno à identificação, ajuda e navegação pelo primeiro acesso verificados. A revisão apontou transformação herdada que deslocava o botão de senha, corrigida e confirmada dentro dos limites do campo. Nenhum erro JavaScript ao concluir a sessão. Checagens automáticas de acessibilidade da identificação/senha e troca obrigatória sem violações reportadas, com um item inconclusivo; não constituem certificação integral.

Conclusão de cadastro, verificação de código e troca obrigatória foram verificadas na apresentação e pelos contratos dos formulários, sem enviar e-mails ou alterar credenciais de usuários. Não foram usados dados operacionais na prévia.

O projeto não oferece scripts separados de build, lint ou typecheck. Nenhuma API, schema, dependência, regra de autenticação ou variável de ambiente foi alterada. A prévia segue em http://127.0.0.1:3002. Nenhum envio ao GitHub, merge externo ou deploy de produção.
