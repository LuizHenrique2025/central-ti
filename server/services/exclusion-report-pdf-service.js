const { exclusionValue } = require('../domain/exclusion-rules');
const { reportPdfLayout } = require('./report-pdf-service');
const { pdfHeader, pdfIndicators, pdfDocument, monthlyCharts, statusCharts, reportTable, dateTime, renderPdfDefinition, exclusionFilters } = reportPdfLayout;

function buildExclusionReportPdfDefinition(exclusions, period, generatedAt) {
  const filters = Object.entries(exclusionFilters).map(([key, label]) => `${label}: ${exclusions.appliedFilters[key] || 'Todos'}`).join(' · ');
  const content = [
    ...pdfHeader('Relatório de Exclusões', period, generatedAt, filters),
    pdfIndicators([
      ['Solicitações', exclusions.total, 'Exclusões nos filtros aplicados'],
      ['Concluídas', exclusions.completed, 'Solicitações concluídas'],
      ['Pendentes', exclusions.pending, 'Aguardam conclusão'],
      ['Recusadas / canceladas', exclusions.declined, 'Solicitações não executadas']
    ])
  ];
  if (!exclusions.total) content.push({ text: 'Nenhuma solicitação de exclusão atende aos filtros aplicados', color: '#526274', margin: [0, 30, 0, 20] });
  const months = exclusions.months.filter(row => /^\d{4}-(0[1-9]|1[0-2])$/.test(row.month)).map(row => ({ label: row.month, total: row.total }));
  content.push(...monthlyCharts(months, 'Evolução das exclusões por mês', exclusions.total), ...statusCharts(exclusions.statuses, exclusions.total, 'Exclusões'));
  for (const [title, rows] of [
    ['Usuários que mais solicitam', exclusions.users], ['Setores que mais solicitam', exclusions.sectors],
    ['Tipos de exclusão', exclusions.types], ['Categorias de motivo', exclusions.reasons],
    ['Reincidência por usuário e motivo', exclusions.recurring]
  ]) {
    if (rows.length) content.push(reportTable(title, ['Descrição', 'Quantidade'], rows.map(row => [row.label, row.total]), ['*', 65], [1]));
  }
  if (exclusions.records.length) {
    const rows = exclusions.records.map(record => [
      record.ticket || '—',
      `Nº: ${record.numeroAtendimento || '—'}\nPaciente: ${record.nomePaciente || '—'}`,
      `Usuário: ${exclusionValue(record, 'user')}\nSetor: ${exclusionValue(record, 'sector')}\nTipo: ${exclusionValue(record, 'type')}\nEm: ${record.createdAt ? dateTime(record.createdAt) : 'Sem data'}`,
      `${exclusionValue(record, 'reason')}\n${record.motivoExclusao || '—'}`,
      `${exclusionValue(record, 'status')}\nPor: ${record.exclusaoConcluidaPor || '—'}\nEm: ${record.exclusaoConcluidaEm ? dateTime(record.exclusaoConcluidaEm) : '—'}`
    ]);
    const annex = reportTable('Anexo - Solicitações de exclusão', ['Ticket', 'Atendimento / paciente', 'Solicitação', 'Motivo', 'Status / conclusão'], rows, [38, 90, 98, '*', 88]);
    // O anexo usa células multilinha: mantenha registros comuns inteiros, permitindo continuidade de textos excepcionais.
    const compactAnnex = rows.every(row => row.every(value => String(value).length <= 200 && String(value).split(/[\r\n\u2028\u2029]/).length <= 8));
    annex.table.dontBreakRows = compactAnnex;
    annex.table.keepWithHeaderRows = compactAnnex ? 1 : 0;
    annex.pageBreak = 'before';
    annex.fontSize = 8;
    content.push(annex);
  }
  return pdfDocument('Relatório de Exclusões', content);
}

async function generateExclusionReportPdf(exclusions, period, generatedAt) {
  return renderPdfDefinition(buildExclusionReportPdfDefinition(exclusions, period, generatedAt));
}

module.exports = { buildExclusionReportPdfDefinition, generateExclusionReportPdf };
