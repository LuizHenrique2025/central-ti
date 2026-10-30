# Unificar Demandas Internas e Demandas Hospital

Registro local, conforme orientação do responsável para manter alterações sem publicação externa. Branch `dev/unifica-quadros-demandas`.

## Objetivo

As duas páginas devem usar a mesma montagem de quadro, painel de filtros, prioridades, fluxo, cards e alternância Kanban/lista. Apenas identificação, texto de contexto e registros consultados variam por tipo.

## Implementação prevista

Reutilizar o painel de Internas e o card semântico com menu acessível do Hospital em ambas as páginas. Preservar abertura pelo card, ações de status e arraste conforme permissão, SLA, período, paginação e pesquisa no histórico. Colunas vazias recolhíveis em ambas, com Aberta sempre expandida. Reutilizar o parâmetro opcional de prioridade já existente, sem mudar o contrato da API.

## Critérios e riscos

Não misturar registros entre tipos. Confirmar igualdade dos componentes em claro/escuro e desktop/celular, filtros e totais reais, menus e paginação. Preservar login, demais módulos, banco e permissões. Nenhuma dependência nova, envio ao GitHub ou implantação de produção.

## Arquivos principais

Montagem compartilhada em `public/assets/js/features/internal-board.js`; card e eventos em `public/assets/js/features/hospital-board.js`; layout em `public/assets/css/internal-board.css`; integração de tipo e prioridade em `public/assets/js/app.js`. Testes de regressão em `tests/unit/hospital-board.test.js`.

## Validação

60 testes aprovados, incluindo isolamento entre os tipos e uso da mesma estrutura de card. Conferência das duas páginas em claro/escuro e larguras 1920, 1440, 1024, 768 e 390: 20 cenários sem overflow do documento, cards ou conteúdo interno das colunas. Diferenças de título, contexto e dados são intencionais.

No Hospital, filtro Alta consultou o histórico completo (107 concluídas, primeira página 25); Ver mais carregou 50. Alteração de status pelo teclado no menu confirmada. Expansão e recolhimento de etapa vazia e visão Lista com rolagem vertical verificados. Na Lista não é exibido controle de recolhimento sem efeito. Nenhum erro JavaScript na sessão verificada. Login e demais telas não foram modificados.

Nenhuma API, schema, dependência ou variável de ambiente foi alterada. Aplicação sem scripts separados de build, lint ou typecheck. Prévia local preservada na porta 3002; produção e GitHub sem publicação.
