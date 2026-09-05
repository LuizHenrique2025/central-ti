# Central TI — Contexto de produto

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

O público principal é a equipe de TI, responsável por demandas, equipamentos,
patrimônio e infraestrutura. O público secundário são colaboradores de outros
setores, que registram e acompanham demandas e consultam ramais, conforme as
permissões de seu perfil.

## Product Purpose

Centralizar a gestão interna de TI e facilitar o atendimento das demandas.
A prioridade de produto é permitir identificar pendências, responsáveis e
próximos passos rapidamente. Essa prioridade orienta melhorias futuras; não
constitui uma afirmação de que todos os fluxos atuais já a atendem.

## Operating Context

O sistema apoia o trabalho interno da equipe de TI e a comunicação com os demais
setores. Reúne gestão de computadores, materiais, recepções, equipamentos,
redes, patrimônio e demandas, além de comunicação entre usuários.

## Capabilities and Constraints

- Aplicação web existente, com interface HTML, CSS e JavaScript e servidor Node.js.
- As funções disponíveis a cada usuário devem respeitar as permissões do perfil.
- Dados internos e operacionais exigem proteção; exemplos, documentação e
  artefatos de design não devem expor dados pessoais ou credenciais.
- A configuração inicial do Impeccable e eventuais validações de interface
  deste trabalho devem usar a base de teste, conforme orientação do responsável.
- Mudanças seguem o fluxo de AGENTS.md: Issue, branch dedicada, validação e PR;
  deploy somente após aprovação do PR e conclusão dos testes aplicáveis.
- Necessidades específicas de acessibilidade e metas quantitativas de sucesso
  ainda não foram definidas com o responsável pelo produto.

## Brand Commitments

Preservar o nome Central TI e a terminologia dos processos internos. Este
registro não estabelece uma nova identidade visual.

## Evidence on Hand

- README.md: escopo funcional, operação e requisitos técnicos existentes.
- public/index.html: entrada da interface atual.
- public/assets/js/ e public/assets/css/: comportamento e estilos existentes.
- AGENTS.md: regras obrigatórias de desenvolvimento e proteção de informações.

## Product Principles

1. Facilitar o atendimento das demandas e a identificação do próximo passo.
2. Manter a navegação simples para a equipe de TI e os demais colaboradores.
3. Apresentar informações e estados com clareza.
4. Respeitar permissões por perfil em todos os fluxos.
5. Proteger os dados internos durante o uso e a evolução do sistema.
