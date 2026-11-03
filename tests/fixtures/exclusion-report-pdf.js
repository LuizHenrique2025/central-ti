const { createReportService } = require('../../server/services/report-service');
const { buildExclusionReport } = require('../../server/domain/exclusion-rules');
const { demandBelongsToUser } = require('../../server/domain/demand-access');

function exclusionReportFixture(count = 8) {
  const records = Array.from({ length: count }, (_, index) => {
    const status = ['Aberta', 'Concluída', 'Recusada', 'Cancelada'][index % 4];
    return {
      id: `exclusion-${index + 1}`, ticket: `EX-${String(index + 1).padStart(4, '0')}`, numeroAtendimento: `ATD-${index + 1}`, nomePaciente: `Paciente fictício ${index + 1}`,
      createdBy: 'owner', createdAt: new Date(Date.UTC(2026, 0, index + 1, 15)).toISOString(),
      usuarioSolicitante: ['José da Conceição', 'Márcia Gonçalves', 'João & Filhos <suporte>'][index % 3],
      setorSolicitante: index % 2 ? 'Faturamento' : 'Recepção', assunto: index % 2 ? 'Exclusão de exame' : 'Exclusão de procedimento',
      categoriaMotivoExclusao: index % 2 ? 'Atendimento duplicado' : 'Paciente incorreto',
      motivoExclusao: 'Solicitação de correção de lançamento duplicado após conferência da equipe.', status,
      ...(status === 'Concluída' ? { exclusaoConcluidaPor: 'Técnico de demonstração', exclusaoConcluidaEm: '2026-02-01T16:00:00Z' } : {})
    };
  });
  const store = { records: async resource => resource === 'demandas' ? records : [], users: async () => [], audits: async () => [] };
  const service = createReportService({ getStore: () => store, resourceDefinitions: { demandas: [] }, canAccess: (user, resource) => resource === 'demandas', demandBelongsToUser, buildExclusionReport });
  return { records, store, service, admin: { id: 'admin', perfil: 'admin' } };
}

module.exports = { exclusionReportFixture };
