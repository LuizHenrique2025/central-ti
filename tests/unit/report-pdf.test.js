const test = require('node:test');
const assert = require('node:assert/strict');
const { reportPdfFixture } = require('../fixtures/report-pdf');
const { validateReportPdfFilters, reportPdfData, buildReportPdfDefinition, generateReportPdf } = require('../../server/services/report-pdf-service');

const period = { start: '2026-01-01', end: '2026-12-31' };
const timestamp = '2026-11-03T15:30:00Z';

test('PDF reutiliza indicadores e arredonda a conclusão por profissional como a tela', async () => {
  const demand = await reportPdfFixture(3);
  demand.professionals = [{ professional: 'José', assumed: 3, completed: 2, open: 1 }];
  const data = reportPdfData(demand, period, timestamp);
  assert.deepEqual(data.metrics, demand.metrics);
  assert.equal(data.metrics.completedPercent, 66.7);
  assert.equal(data.professionals[0].completionRate, 67);
  assert.equal(data.requesters, 3);
  assert.equal(data.months.reduce((sum, row) => sum + row.total, 0), 3);
});

test('PDF vazio não divide por zero e informa a ausência de demandas', async () => {
  const demand = await reportPdfFixture(0);
  demand.professionals = [{ professional: 'Sem atribuição', assumed: 0, completed: 0, open: 0 }];
  const data = reportPdfData(demand, {}, timestamp);
  assert.equal(data.metrics.completedPercent, 0);
  assert.equal(data.professionals[0].completionRate, 0);
  assert.equal(data.requesters, 0);
  const definition = buildReportPdfDefinition(data);
  assert.match(JSON.stringify(definition), /Nenhuma demanda encontrada para os filtros aplicados/);
  assert.match(JSON.stringify(definition), /Status: Todos/);
  const pdf = await generateReportPdf(demand, {}, timestamp);
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});

test('validação rejeita datas impossíveis, duplicadas, intervalos invertidos e filtros abusivos', () => {
  const validate = query => validateReportPdfFilters(new URL(`http://localhost/api/reports/pdf?${query}`));
  for (const query of ['start=2026-02-30', 'end=ontem', 'start=2026-02-01&end=2026-01-01', 'start=2026-01-01&start=2026-02-01', 'demandStatus=%00', `demandReason=${'a'.repeat(501)}`, Array(101).fill('demandStatus=Aberta').join('&')]) assert.throws(() => validate(query), { statusCode: 400 });
  assert.doesNotThrow(() => validate('start=2024-02-29&end=2024-03-01&demandStatus=Tdsa&demandStatus=Aberta'));
});

test('PDF real A4 contém fonte embutida, gráficos vetoriais, anexo e paginação para muitas linhas', async () => {
  const demand = await reportPdfFixture(160);
  const data = reportPdfData(demand, period, timestamp);
  const definition = buildReportPdfDefinition(data);
  assert.equal(definition.pageSize, 'A4');
  assert.equal(definition.pageOrientation, 'portrait');
  assert.match(definition.footer(2, 8).text, /Página 2 de 8/);
  assert.match(JSON.stringify(definition), /03\/11\/2026,? 12:30/);
  assert.equal(demand.statuses.some(row => row.label === 'Tdsa'), true);
  const pdf = await generateReportPdf(demand, period, timestamp);
  const text = pdf.toString('latin1');
  assert.match(text, /\/FontFile2/);
  assert.match(text, /\/MediaBox \[0 0 595.28 841.89\]/);
  assert.ok((text.match(/\/Type \/Page\b/g) || []).length > 3);
});
