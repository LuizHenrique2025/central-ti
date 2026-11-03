const test = require('node:test');
const assert = require('node:assert/strict');
const { exclusionReportFixture } = require('../fixtures/exclusion-report-pdf');
const { validateReportPdfFilters } = require('../../server/services/report-pdf-service');
const { buildExclusionReportPdfDefinition, generateExclusionReportPdf } = require('../../server/services/exclusion-report-pdf-service');

const timestamp = '2026-11-03T17:30:00Z';
const url = query => new URL(`http://localhost/api/reports?${query}`);

test('exclusões reutilizam os mesmos indicadores, filtros e registros da tela sem filtros de Demandas', async () => {
  const { service, admin } = exclusionReportFixture();
  const query = url('start=2026-01-01&end=2026-01-08&exclusionReason=Atendimento%20duplicado&demandStatus=Inexistente');
  const screen = await service.report(admin, query, () => timestamp);
  const exported = await service.exclusionReport(admin, query);
  assert.deepEqual(exported, screen.exclusions);
  assert.equal(exported.total, 4);
  assert.equal(exported.completed, 2);
  assert.equal(exported.pending, 0);
  assert.equal(exported.declined, 2);
  assert.equal(exported.appliedFilters.reason, 'Atendimento duplicado');
  const definition = buildExclusionReportPdfDefinition(exported, screen.period, timestamp);
  assert.equal(definition.info.title, 'Relatório de Exclusões');
  assert.match(JSON.stringify(definition), /Motivo: Atendimento duplicado/);
  assert.doesNotMatch(JSON.stringify(definition), /Taxa de conclusão|Desempenho por profissional/);
});

test('exclusões respeitam período, visibilidade e cada filtro e fazem uma consulta de demandas', async () => {
  const fixture = exclusionReportFixture();
  fixture.records.push({ ...fixture.records[0], createdBy: 'other', ticket: 'OUTRO' }, { ...fixture.records[0], assunto: 'Instalação de software', ticket: 'NORMAL' });
  let calls = 0;
  const original = fixture.store.records;
  fixture.store.records = async resource => { calls++; return original(resource); };
  const report = await fixture.service.exclusionReport({ id: 'owner', perfil: 'consulta' }, url('start=2026-01-01&end=2026-01-04&exclusionUser=Jos%C3%A9%20da%20Concei%C3%A7%C3%A3o&exclusionSector=Recep%C3%A7%C3%A3o&exclusionType=Exclus%C3%A3o%20de%20procedimento&exclusionReason=Paciente%20incorreto&exclusionStatus=Aberta'));
  assert.equal(calls, 1);
  assert.equal(report.total, 1);
  assert.deepEqual(report.records.map(record => record.ticket), ['EX-0001']);
});

test('PDF de exclusões vazio é válido e não inclui anexo vazio', async () => {
  const { service, admin } = exclusionReportFixture(0);
  const report = await service.exclusionReport(admin, url(''));
  const definition = buildExclusionReportPdfDefinition(report, {}, timestamp);
  assert.match(JSON.stringify(definition), /Nenhuma solicitação de exclusão atende aos filtros aplicados/);
  assert.doesNotMatch(JSON.stringify(definition), /Anexo -/);
  const pdf = await generateExclusionReportPdf(report, {}, timestamp);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});

test('tipo do relatório e filtros de exclusões são validados sem restringir status personalizados', () => {
  for (const query of ['reportType=outro', 'reportType=', 'reportType=demands&reportType=exclusions', 'exclusionStatus=A&exclusionStatus=B', 'exclusionUser=%00', `exclusionReason=${'x'.repeat(501)}`]) assert.throws(() => validateReportPdfFilters(url(query)), { statusCode: 400 });
  for (const query of ['', 'reportType=demands', 'reportType=exclusions&exclusionStatus=Tdsa']) assert.doesNotThrow(() => validateReportPdfFilters(url(query)));
});

test('PDF de exclusões pagina muitas linhas com fonte embutida e dados de auditoria', async () => {
  const { service, admin } = exclusionReportFixture(90);
  const report = await service.exclusionReport(admin, url(''));
  const definition = buildExclusionReportPdfDefinition(report, {}, timestamp);
  const content = JSON.stringify(definition);
  assert.match(content, /Paciente fictício 90/);
  assert.match(content, /Técnico de demonstração/);
  assert.match(content, /Reincidência por usuário e motivo/);
  assert.equal(definition.footer(3, 8).text, 'Central TI · Página 3 de 8');
  const pdf = await generateExclusionReportPdf(report, {}, timestamp);
  assert.match(pdf.toString('latin1'), /\/FontFile2/);
  assert.ok((pdf.toString('latin1').match(/\/Type \/Page\b/g) || []).length > 3);
});
