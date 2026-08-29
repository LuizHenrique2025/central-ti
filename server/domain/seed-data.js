function createSeedData({ id, now, passwordHash, bootstrapAdmin }) {
  if (!bootstrapAdmin) {
    throw new Error('Nenhuma base foi encontrada. Configure as variáveis CENTRAL_TI_BOOTSTRAP_ADMIN_* para criar o primeiro administrador com segurança.');
  }

  const { salt, hash } = passwordHash(bootstrapAdmin.password);
  const admin = {
    id: id(),
    nome: bootstrapAdmin.name,
    email: bootstrapAdmin.email,
    perfil: 'admin',
    active: true,
    salt,
    hash,
    mustChangePassword: false,
    createdAt: now()
  };

  return {
    users: [admin],
    computadores: [],
    materiais: [],
    recepcoes: [],
    equipamentos: [],
    redes: [],
    patrimonio: [],
    demandas: [],
    demandStatuses: ['Aberta', 'Em andamento', 'Concluída'],
    messages: [],
    auditLogs: []
  };
}

module.exports = { createSeedData };
