const { createReportService } = require('../../server/services/report-service');

async function reportPdfFixture(count = 12) {
  const records = Array.from({ length: count }, (_, index) => ({
    ticket: `TI-${String(index + 1).padStart(4, '0')}`, createdAt: `2026-${String(index % 12 + 1).padStart(2, '0')}-15T14:20:00Z`,
    solicitante: ['José da Conceição', 'Márcia Gonçalves', 'João & Filhos <suporte>'][index % 3],
    tecnicoResponsavel: `Profissional ${index % 24 + 1} - Equipe de Tecnologia e Suporte`,
    categoria: 'Software', assunto: 'Configuração e manutenção do sistema de agendamento e integração dos equipamentos',
    setorSolicitante: 'Recepção e atendimento', status: index % 3 ? 'Concluída' : index % 2 ? 'Tdsa' : 'Aberta'
  }));
  const service = createReportService({ getStore: () => ({ users: async () => [], records: async () => records }), demandBelongsToUser: () => true });
  return service.demandReport({ perfil: 'admin' }, new URL('http://localhost/api/reports'));
}

module.exports = { reportPdfFixture };
