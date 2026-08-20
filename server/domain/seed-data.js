function createSeedData({ id, now, passwordHash }) {
  const user = (nome, email, perfil, senha) => {
    const { salt, hash } = passwordHash(senha);
    return { id: id(), nome, email, perfil, active: true, salt, hash, mustChangePassword: true, createdAt: now() };
  };
  const admin = user('Administrador', 'admin@centralti.local', 'admin', '123456');
  const ti = user('Equipe de TI', 'ti@centralti.local', 'ti', '123456');
  const recepcao = user('Recepção', 'recepcao@centralti.local', 'recepcao', '123456');
  const record = data => ({ id: id(), ...data, createdAt: now(), updatedAt: now() });
  return {
    users: [admin, ti, recepcao],
    computadores: [
      record({ patrimonio: 'PC-0048', responsavel: 'Mariana Costa', localizacao: 'Financeiro', status: 'Ativo', avaliacao: 'Bom' }),
      record({ patrimonio: 'PC-0051', responsavel: 'João Victor', localizacao: 'Recepção', status: 'Em manutenção', avaliacao: 'Precisa de manutenção' })
    ],
    materiais: [
      record({ item: 'Toner HP 85A', categoria: 'Impressão', quantidade: '8', minimo: '4' }),
      record({ item: 'Cabo de rede CAT6', categoria: 'Rede', quantidade: '42', minimo: '20' })
    ],
    recepcoes: [record({ visitante: 'Carlos Mendes', empresa: 'Mendes & Filhos', destino: 'Compras', data: '11/08/2026' })],
    equipamentos: [record({ equipamento: 'Projetor', modelo: 'Epson PowerLite X49', responsavel: 'Sala de reuniões', condicao: 'Operacional', avaliacao: 'Bom' })],
    redes: [record({ nome: 'Firewall principal', ip: '192.168.1.1', localizacao: 'Rack TI', status: 'Online' })],
    patrimonio: [record({ codigo: 'PAT-1022', descricao: 'Mesa de escritório', localizacao: 'Financeiro', situacao: 'Em uso' })],
    demandas: [
      record({ titulo: 'Instalar impressora no RH', solicitante: 'Sandra Lima', prioridade: 'Média', status: 'Em andamento' }),
      record({ titulo: 'Acesso ao sistema financeiro', solicitante: 'Felipe Rocha', prioridade: 'Alta', status: 'Aberta' })
    ],
    demandStatuses: ['Aberta', 'Em andamento', 'Concluída'],
    messages: [record({ senderId: ti.id, recipientId: admin.id, subject: 'Bem-vindo à Central TI', body: 'Seu acesso ao painel foi configurado com sucesso.', readAt: null })],
    auditLogs: []
  };
}

module.exports = { createSeedData };
