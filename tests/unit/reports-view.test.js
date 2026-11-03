const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/features/reports-view.js'), 'utf8');
function context() {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const ui = vm.createContext({ document: { addEventListener: () => {} }, state: {}, URLSearchParams, Date, Intl, Set, Map, esc, isModuleEnabled: () => true, modules: {}, reportTable: () => '', demandReportFilters: () => '', formatDate: value => value });
  vm.runInContext(source, ui);
  return ui;
}
test('períodos rápidos incluem o dia atual sem ultrapassar mês e ano', () => {
  const ui = context();
  const period = ui.reportRecentPeriod(7, new Date(2026, 0, 3, 12));
  assert.equal(period.start, '2025-12-28');
  assert.equal(period.end, '2026-01-03');
});

test('exportação usa filtros da consulta exibida, incluindo múltiplos valores, sem usar rascunho', () => {
  const ui = context();
  ui.state.demandReportDraft = { status: ['Aberta'] };
  ui.state.start = '2000-01-01';
  const report = { period: { start: '2026-10-01', end: '2026-10-31' }, demandReport: { filters: { status: ['Concluída', 'Tdsa'], requester: ['João & Filhos'] } } };
  const query = ui.reportPdfQuery(report);
  assert.equal(query.get('start'), '2026-10-01');
  assert.deepEqual(query.getAll('demandStatus'), ['Concluída', 'Tdsa']);
  assert.equal(query.get('demandRequester'), 'João & Filhos');
  assert.match(ui.reportPdfButton(), /disabled/);
});

test('download impede repetição e restaura o botão quando o servidor recusa a exportação', async () => {
  const ui = context();
  const button = { setAttribute: () => {} };
  ui.document.querySelectorAll = () => [button];
  ui.state.report = { demandReport: { filters: {} } };
  let calls = 0, complete;
  ui.fetch = () => { calls++; return new Promise(resolve => { complete = resolve; }); };
  const messages = [];
  ui.toast = message => messages.push(message);
  const first = ui.exportReportPdf();
  assert.equal(button.disabled, true);
  assert.equal(ui.state.reportPdfLoading, true);
  await ui.exportReportPdf();
  assert.equal(calls, 1);
  complete({ ok: false, json: async () => ({ error: 'Sua sessão expirou. Entre novamente.' }) });
  await first;
  assert.equal(button.disabled, false);
  assert.equal(ui.state.reportPdfLoading, false);
  assert.deepEqual(messages, ['Sua sessão expirou. Entre novamente.']);
});

test('aba Exclusões exporta apenas filtros aplicados de exclusões e preserva o período exibido', () => {
  const ui = context();
  ui.state.reportTab = 'exclusions';
  ui.state.exclusionFilters = { status: 'Concluída' };
  ui.state.demandReportFilters = { status: ['Aberta'] };
  const report = { period: { start: '2026-01-01', end: '2026-02-01' }, exclusions: { appliedFilters: { user: 'José & equipe', sector: '', type: 'Exclusão de exame', reason: 'Atendimento duplicado', status: 'Tdsa' }, filters: { status: ['Aberta', 'Concluída', 'Tdsa'] } } };
  ui.state.report = report;
  const query = ui.reportPdfQuery(report, ui.reportPdfType());
  assert.equal(query.get('reportType'), 'exclusions');
  assert.equal(query.get('exclusionUser'), 'José & equipe');
  assert.equal(query.get('exclusionStatus'), 'Tdsa');
  assert.equal(query.get('exclusionType'), 'Exclusão de exame');
  assert.equal(query.get('start'), '2026-01-01');
  assert.equal(query.has('demandStatus'), false);
  assert.equal(query.has('exclusionSector'), false);
  assert.doesNotMatch(ui.reportPdfButton(), /disabled/);
  ui.state.loading = true;
  assert.match(ui.reportPdfButton(), /disabled/);
});

test('download autenticado salva o blob com nome do servidor e libera o recurso após iniciar', async () => {
  const ui = context();
  ui.state.token = 'sessao-de-teste';
  ui.state.report = { period: { start: '2026-10-01' }, demandReport: { filters: { status: ['Aberta'] } } };
  const link = { click() { this.clicked = true; }, remove() { this.removed = true; } };
  ui.document.querySelectorAll = () => [];
  ui.document.createElement = () => link;
  ui.document.body = { appendChild: () => {} };
  const blob = {};
  let request, revoked, release;
  ui.URL = { createObjectURL: value => { assert.equal(value, blob); return 'blob:teste'; }, revokeObjectURL: value => { revoked = value; } };
  ui.setTimeout = callback => { release = callback; };
  ui.toast = () => {};
  ui.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, blob: async () => blob, headers: new Map([['content-type', 'application/pdf'], ['content-disposition', 'attachment; filename="relatorio-demandas-2026-11-03.pdf"']]) };
  };
  await ui.exportReportPdf();
  assert.match(request.url, /start=2026-10-01&demandStatus=Aberta/);
  assert.equal(request.options.headers.authorization, 'Bearer sessao-de-teste');
  assert.equal(link.download, 'relatorio-demandas-2026-11-03.pdf');
  assert.equal(link.clicked, true);
  assert.equal(link.removed, true);
  assert.equal(ui.state.reportPdfLoading, false);
  assert.equal(revoked, undefined);
  release();
  assert.equal(revoked, 'blob:teste');
});
test('série agrega datas sem perder totais e trata ausência de data', () => {
  const ui = context();
  const rows = Array.from({ length: 70 }, (_, index) => ({ label: new Date(Date.UTC(2026, 0, index + 1)).toISOString().slice(0, 10), total: 2 }));
  const result = ui.reportDateSeries(rows.concat({label:'Sem data',total:5}));
  assert.equal(result.mode, 'month');
  assert.equal(result.rows.reduce((sum, row) => sum + row.total, 0), 140);
  assert.equal(ui.reportDateSeries([]).rows.length, 0);
});
test('indicadores usam a consulta filtrada e escapam os dados exibidos', () => {
  const ui = context();
  const report = { modules: [], alerts: [], demandReport: { metrics: {total:2,completed:1,open:1,completedPercent:50,topRequester:'<script>pessoa</script>',topReason:'Ajuste'}, records:[{requester:'Pessoa'},{requester:'Pessoa'}], openedByDate:[{label:'2026-10-30',total:2}], statuses:[{label:'<img src=x>',total:2}], professionals:[{professional:'<script>técnico</script>',assumed:2,completed:1,open:1}] } };
  const html = ui.reportsOverview(report);
  assert.match(html, /50%/);
  assert.match(html, /Solicitantes/);
  assert.match(html, /&lt;script&gt;/);
  assert(!html.includes('<script>'));
  assert(!html.includes('Tempo médio'));
  report.demandReport.metrics = {total:0,completed:0,open:0,completedPercent:0,topRequester:'—',topReason:'—'};
  report.demandReport.records=[]; report.demandReport.openedByDate=[]; report.demandReport.statuses=[]; report.demandReport.professionals=[];
  const empty = ui.reportsOverview(report);
  assert.match(empty,/Nenhuma demanda encontrada/);
  assert(!empty.includes('NaN'));
});
