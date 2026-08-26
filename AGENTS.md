# Fluxo obrigatório de desenvolvimento

Toda correção, melhoria ou nova funcionalidade deve seguir este fluxo:

1. Criar uma Issue no GitHub antes de iniciar a implementação. A Issue deve explicar o objetivo, escopo, riscos e critérios de aceite.
2. Criar uma branch dedicada, com o prefixo `codex/`, vinculada a uma única Issue.
3. Implementar e testar a alteração sem incluir arquivos locais, segredos, dados operacionais, backups ou logs no Git.
4. Abrir um Pull Request antes de qualquer deploy. A descrição deve incluir `Closes #<número-da-issue>`, resumo da mudança, testes executados e eventuais passos de implantação ou rollback.
5. Fazer deploy somente a partir de um Pull Request aprovado e com os testes aplicáveis concluídos.

Se uma alteração adicional não pertencer à Issue atual, crie uma nova Issue e trate-a em outro PR. Nunca exponha credenciais, tokens, senhas, chaves de criptografia ou dados pessoais em Issues, commits, PRs, testes ou logs.
