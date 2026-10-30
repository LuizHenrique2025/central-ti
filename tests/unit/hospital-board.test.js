const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../public/assets/js/features/hospital-board.js'), 'utf8');
const { isCompletedDemandStatus } = require('../../server/domain/exclusion-rules');
const { demandBoardPage, validBoardDate } = require('../../server/domain/demand-board');

function context(overrides = {}) {
  const state = { records: [], statuses: ['Aberta', 'Em andamento', 'Tdsa', 'Concluída', 'Demanda administrativa'], user: {}, query: '', demandPagination: null };
  const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const result = vm.createContext({ state, completedVisible: 25, document: { addEventListener: () => {} }, Date, Intl, esc, mobileNavigationOpen: false, isCompletedDemand: card => isCompletedDemandStatus(card.status), formatSla: value => value, demandSlaTime: card => { const ms = new Date(card.prazoSla || '').getTime(); return Number.isNaN(ms) ? null : ms; }, canUpdate: () => true, canCreate: () => true, canonicalDemandCategory: value => value, canonicalDemandStatus: value => value, normalizeDemandText: value => String(value || '').toLowerCase(), demandStatusTone: () => 'tone-open', matchesDemandFilters: () => true, demandRequesterFilter: () => '<select></select>', demandAssigneeFilter: () => '<select></select>', visibleDemandCards: cards => cards, completedMoreButton: () => '', ...overrides });
  vm.runInContext(source, result);
  return result;
}

test('título em caixa alta muda apenas na exibição e conteúdo é escapado', () => {
  const ui = context();
  const record = { id: 'd1', ticket: 'TI-0001', titulo: 'COMPUTADOR FISIOTERAPIA', solicitante: '<script>alert(1)</script>', status: 'Aberta', prioridade: 'Alta' };
  assert.equal(ui.hospitalSentenceCase(record.titulo), 'Computador fisioterapia');
  assert.equal(ui.hospitalSentenceCase('Erro no RealClinic'), 'Erro no RealClinic');
  const card = ui.hospitalCard(record);
  assert.equal(record.titulo, 'COMPUTADOR FISIOTERAPIA');
  assert.match(card, /<button[^>]+hospital-card-open/);
  assert(!card.includes('<script>'));
  assert(!card.includes('<select'));
});

test('SLA distingue atraso, próximas 24h, futuro, ausência de prazo e conclusão', () => {
  const ui = context();
  const now = Date.parse('2026-10-30T15:00:00Z');
  const active = { status: 'Aberta' };
  assert.equal(ui.hospitalSla({ ...active, prazoSla: '2026-10-29T15:00:00Z' }, now).kind, 'danger');
  assert.match(ui.hospitalSla({ ...active, prazoSla: '2026-10-29T15:00:00Z' }, now).text, /Venceu/);
  assert.equal(ui.hospitalSla({ ...active, prazoSla: '2026-10-30T16:00:00Z' }, now).kind, 'warning');
  assert.equal(ui.hospitalSla({ ...active, prazoSla: '2026-11-03T16:00:00Z' }, now).kind, 'neutral');
  assert.equal(ui.hospitalSla(active, now).text, 'Sem SLA');
  assert.equal(ui.hospitalSla({ status: 'Concluída', prazoSla: '2026-10-29T15:00:00Z' }, now).text, 'Concluída');
  assert(!ui.hospitalSlaMatches({ status: 'Concluída', prazoSla: '2026-10-29T15:00:00Z' }, 'overdue', now));
  assert(ui.hospitalSlaMatches({ ...active, prazoSla: '2026-10-29T15:00:00Z' }, 'overdue', now));
});

test('usuário sem permissão não recebe ações de status nem drag and drop', () => {
  const ui = context({ canUpdate: () => false });
  const card = ui.hospitalCard({ id: 'd1', titulo: 'Teste', status: 'Aberta' });
  assert(!card.includes('hospital-card-menu'));
  assert(!card.includes('draggable='));
  assert.match(card, /data-action="demand-details"/);
});

test('colunas vazias recolhem, Aberta permanece e entrada de card expande automaticamente', () => {
  const ui = context();
  let html = ui.hospitalDemandBoard();
  assert.equal((html.match(/class="hospital-column-rail"/g) || []).length, 4);
  assert(!html.includes('aria-label="Expandir coluna Aberta"'));
  ui.state.hospitalExpandedColumns = ['Tdsa'];
  html = ui.hospitalDemandBoard();
  assert.equal((html.match(/class="hospital-column-rail"/g) || []).length, 3);
  ui.state.hospitalExpandedColumns = [];
  ui.state.records = [{ id: 'd1', tipo: 'externa', titulo: 'Teste', status: 'Tdsa' }];
  html = ui.hospitalDemandBoard();
  assert(!html.includes('aria-label="Expandir coluna Tdsa"'));
  assert.match(html, /hospital-card-open/);
});

test('período inclusivo funciona com paginação, filtro de proprietário e data única legada', () => {
  const user = { id: 'u1', perfil: 'consulta' };
  const records = ['2026-10-01T01:00:00Z', '2026-10-02T01:00:00Z', '2026-10-03T01:00:00Z'].map((createdAt, index) => ({ id: String(index), createdBy: 'u1', createdAt, status: 'Concluída' }));
  records.push({ id: 'privado', createdBy: 'u2', createdAt: records[0].createdAt, status: 'Aberta' });
  const period = demandBoardPage(records, user, { createdStart: '2026-09-30', createdEnd: '2026-10-01', timezoneOffset: 180 });
  assert.deepEqual(period.records.map(record => record.id), ['1', '0']);
  assert.equal(demandBoardPage(records, user, { createdDate: '2026-09-30', timezoneOffset: 180 }).records.length, 1);
  assert(!validBoardDate('2026-02-30'));
  assert(validBoardDate('2026-02-28'));
});

test('sair do Hospital limpa o período e não filtra silenciosamente outros quadros', async () => {
  const app = fs.readFileSync(path.join(__dirname, '../../public/assets/js/app.js'), 'utf8');
  const state = { page: 'demandas-externas', demandCreatedStart: '2026-10-01', demandCreatedEnd: '2026-10-03' };
  const ui = vm.createContext({ state, clearTimeout: () => {}, searchTimer: null, completedVisible: 25, COMPLETED_PAGE_SIZE: 25, navigationRequest: 0, mobileNavigationOpen: false, load: async () => {}, render: () => {} });
  vm.runInContext(app.slice(app.indexOf('async function go('), app.indexOf('function reloadDemandBoard(')), ui);
  await ui.go('demandas-internas');
  assert.equal(state.demandCreatedStart, '');
  assert.equal(state.demandCreatedEnd, '');
});

test('arraste delegado encontra o quadro pelo card, sem chamar closest no document', () => {
  const app = fs.readFileSync(path.join(__dirname, '../../public/assets/js/app.js'), 'utf8');
  const board = {};
  let started = false;
  const transferred = [];
  const ui = vm.createContext({ draggedDemandId: null, activeDraggedBoard: null, dragPointerX: null, startKanbanAutoScroll: () => { started = true; } });
  vm.runInContext(app.slice(app.indexOf('function dragDemand('), app.indexOf('function autoScrollKanban(')), ui);
  const event = { currentTarget: {}, target: { closest: selector => selector === '.kanban' ? board : null }, clientX: 100, dataTransfer: { setData: (key, value) => transferred.push([key, value]) } };
  ui.dragDemand(event, 'demand-test');
  assert.equal(ui.activeDraggedBoard, board);
  assert.equal(ui.draggedDemandId, 'demand-test');
  assert.deepEqual(transferred, [['demandId', 'demand-test']]);
  assert.equal(event.dataTransfer.effectAllowed, 'move');
  assert(started);
});

test('Ver mais usa os totais reais e desconta as concluídas já exibidas', () => {
  const ui = context();
  const app = fs.readFileSync(path.join(__dirname, '../../public/assets/js/app.js'), 'utf8');
  vm.runInContext(app.slice(app.indexOf('function demandStatusTotal('), app.indexOf('function filteredDemandBoard(')), ui);
  ui.state.demandPagination = { totals: { 'Concluída': 60 } };
  const cards = Array.from({ length: 60 }, (_, index) => ({ id: index, status: 'Concluída' }));
  assert.match(ui.hospitalMoreButton(cards.slice(0, 25)), /Ver mais <b>35<\/b>/);
  ui.completedVisible = 50;
  assert.match(ui.hospitalMoreButton(cards.slice(0, 50)), /Ver mais <b>10<\/b>/);
  ui.completedVisible = 75;
  assert.equal(ui.hospitalMoreButton(cards), '');
  assert.equal(ui.hospitalMoreButton([]), '');
});


test('prioridade filtra todo o histórico antes de paginar e preserva os totais', () => {
  const user = { id: 'admin', perfil: 'admin' };
  const records = Array.from({ length: 80 }, (_, index) => ({ id: String(index), tipo: 'interna', status: 'Concluída', prioridade: index < 40 ? 'Alta' : 'Baixa', createdBy: user.id, createdAt: new Date(2026, 0, index + 1).toISOString() }));
  const page = demandBoardPage(records, user, { type: 'interna', priority: 'Alta' });
  assert.equal(page.records.length, 25);
  assert.equal(page.pagination.totals['Concluída'], 40);
  assert(page.records.every(record => record.prioridade === 'Alta'));
  assert.equal(demandBoardPage(records, user, { priority: 'Alta', completedLimit: 50 }).records.length, 40);
});

test('Internas reutiliza ações acessíveis e alterna para lista sem renomear status', () => {
  const ui = context();
  ui.state.records = [{ id: 'i1', tipo: 'interna', titulo: 'Atividade interna', status: 'Tdsa', prioridade: 'Alta' }, { id: 'h1', tipo: 'externa', titulo: 'Hospital', status: 'Aberta' }];
  let html = ui.hospitalDemandBoard('interna');
  assert.match(html, /Demandas Internas/);
  assert.match(html, /internal-pipeline/);
  assert.match(html, /data-priority="Alta"/);
  assert.match(html, /Atividade interna/);
  assert(!html.includes('Abrir demanda: Hospital'));
  ui.state.internalBoardView = 'list';
  html = ui.hospitalDemandBoard('interna');
  assert.match(html, /internal-list-view/);
  assert.match(html, /Coluna Tdsa, 1 demandas/);
  ui.state.internalPriority = 'Baixa';
  assert(!ui.hospitalDemandBoard('interna').includes('Atividade interna'));
});
