# Padronizar a interface autenticada da Central TI

Registro local do escopo, conforme orientação do responsável para manter as alterações apenas locais. Não foi criada Issue externa nem enviado código ao GitHub. Branch: `dev/padronizacao-visual-central`.

## Objetivo e escopo

Unificar a interface autenticada com a direção visual aprovada para Demandas Internas: tokens de tema, navegação, cabeçalhos, controles, filtros, tabelas, painéis, estados vazios e modais. Cobrir painel, cadastros, usuários, e-mail, relatórios e quadros sem alterar regras de negócio. Manter o visual de login fora do escopo.

## Riscos

Conflitos com seletores legados, contraste, rolagem de tabelas/modais, menu móvel, navegação e componentes de seleção. Não alterar API, banco, permissões ou dados operacionais. Nenhuma dependência nova.

## Critérios de aceite

- Temas claro e escuro consistentes em todas as telas autenticadas.
- Navegação, pesquisa, filtros, botões e abertura de formulários preservados.
- Tabelas e modais acessíveis em desktop e celular, com rolagem adequada.
- Um único landmark principal na área autenticada.
- Testes existentes, sintaxe e verificação de arquivos aprovados.
- Prévia local funcional; produção e GitHub permanecem sem publicação.

O fluxo de Issue e PR externos deverá ser retomado somente se o responsável autorizar publicação.

## Validação realizada

54 testes aprovados e sintaxe de 39 arquivos JavaScript validada. Foram conferidas as 11 telas habilitadas, em claro/escuro e nas larguras 1440 e 390, totalizando 44 cenários sem overflow horizontal do documento ou botões recortados. Tabelas extensas mantêm rolagem própria. Pesquisa com registro e estado vazio, menu móvel, abertura/fechamento de formulário e posicionamento do tema foram exercitados na base fictícia da prévia.

A checagem automática de acessibilidade não registrou violações no painel nem no modal verificado; não representa certificação de todos os fluxos. Foi corrigida a restauração assíncrona do foco ao fechar formulários, além dos landmarks e títulos compartilhados. A sessão final de navegador não registrou erros JavaScript.

O projeto não possui scripts de build, lint ou typecheck; a aplicação é servida diretamente por Node. Nenhuma API, schema, dependência ou variável de ambiente foi alterada. Nenhuma mudança foi enviada ao GitHub ou publicada no servidor de produção. A prévia local continua em http://127.0.0.1:3002 com dados fictícios.
