const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/features/reports-view.js'), 'utf8');
function context() {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const ui = vm.createContext({ document: { addEventListener: () => {} }, state: {}, Date, Intl, Set, Map, esc, isModuleEnabled: () => true, modules: {}, reportTable: () => '', demandReportFilters: () => '', formatDate: value => value });
  vm.runInContext(source, ui);
  return ui;
}
test('períodos rápidos incluem o dia atual sem ultrapassar mês e ano', () => {
  const ui = context();
  const period = ui.reportRecentPeriod(7, new Date(2026, 0, 3, 12));
  assert.equal(period.start, '2025-12-28');
  assert.equal(period.end, '2026-01-03');
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
