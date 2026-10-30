const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../public/assets/js/app.js'), 'utf8');
test('histórico progressivo preserva todas as ativas e permite acessar concluídas antigas', () => {
  const context = vm.createContext({ state: {}, completedVisible: 25, isCompletedDemand: card => card.status === 'Concluída' });
  vm.runInContext(source.slice(source.indexOf('function demandStatusTotal('), source.indexOf('function filteredDemandBoard(')), context);
  const completed = Array.from({length: 60}, (_, id) => ({id, status: 'Concluída'}));
  assert.equal(context.visibleDemandCards(completed).length, 25);
  assert.match(context.completedMoreButton(completed), /more-completed/);
  context.completedVisible = 75;
  assert.equal(context.visibleDemandCards(completed).length, 60);
  assert.equal(context.completedMoreButton(completed), '');
  context.completedVisible = 25;
  assert.equal(context.visibleDemandCards(completed.map(card => ({...card, status: 'Aberta'}))).length, 60);
  assert.equal(context.visibleDemandCards(completed.filter(card => card.id === 59))[0].id, 59);
  context.state.demandPagination = { totals: { 'Concluída': 60 } };
  assert.match(context.completedMoreButton(completed.slice(0, 25)), /more-completed/);
  assert.equal(context.demandStatusTotal(completed.slice(0, 25)), 60);
  assert.equal(context.completedMoreButton(completed), '');
});

test('mudança apenas do horário de sincronização não redesenha o painel', async () => {
  let renders = 0;
  const state = { page: 'dashboard', user: { perfil: 'consulta' }, dashboard: { inbox: 0, openDemands: 2, syncedAt: 'anterior' }, unreadMessages: 0 };
  let next = { inbox: 0, openDemands: 2, syncedAt: 'novo' };
  const context = vm.createContext({ state, navigationRequest: 1, render: () => renders++, api: async () => next, toast: message => { throw new Error(message); } });
  vm.runInContext(source.slice(source.indexOf('function dataSnapshot('), source.indexOf('async function go(')), context);
  await context.load({ silent: true });
  assert.equal(renders, 0);
  next = { ...next, openDemands: 3 };
  await context.load({ silent: true });
  assert.equal(renders, 1);
});

test('histórico progressivo também permite carregar status finais personalizados', () => {
  const { demandBoardPage } = require('../../server/domain/demand-board');
  const context = vm.createContext({ state: {}, completedVisible: 25, normalizeDemandText: value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase() });
  vm.runInContext(source.slice(source.indexOf('function isCompletedDemand('), source.indexOf('function demandSlaTime(')), context);
  vm.runInContext(source.slice(source.indexOf('function demandStatusTotal('), source.indexOf('function filteredDemandBoard(')), context);
  for (const status of ['Concluída', 'Finalizada', 'Resolvida', 'Encerrada']) {
    const records = Array.from({ length: 26 }, (_, index) => ({ id: String(index), status, createdAt: '2026-10-01T12:00:00Z' }));
    const first = demandBoardPage(records, { perfil: 'admin' });
    assert.equal(first.records.length, 25);
    context.state.demandPagination = first.pagination;
    assert.match(context.completedMoreButton(first.records), /more-completed/);
    const more = demandBoardPage(records, { perfil: 'admin' }, { completedLimit: 50 });
    assert.equal(more.records.length, 26);
    context.state.demandPagination = more.pagination;
    assert.equal(context.completedMoreButton(more.records), '');
  }
});

test('resumo de mensagens atualiza contador e avisa somente mensagens novas', async () => {
  const state = { token: 'sessao', user: { id: 'u1' }, unreadMessages: 1 };
  let next = { unreadCount: 1, unreadIds: ['m1'], latest: { id: 'm1', senderName: 'Pessoa', subject: 'Mensagem inicial' } };
  const calls = [], notices = [];
  const context = vm.createContext({ state, knownUnreadMessageIds: null, api: async route => { calls.push(route); return next; }, toast: message => notices.push(message), canonicalMailSubject: value => value });
  vm.runInContext(source.slice(source.indexOf('async function refreshUnreadMessages('), source.indexOf('function dataSnapshot(')), context);
  await context.refreshUnreadMessages();
  assert.equal(notices.length, 0);
  next = { unreadCount: 2, unreadIds: ['m2', 'm1'], latest: { id: 'm2', senderName: 'Pessoa', subject: 'Novo aviso' } };
  assert.equal(await context.refreshUnreadMessages(), true);
  assert.equal(state.unreadMessages, 2);
  assert.equal(notices.length, 1);
  await context.refreshUnreadMessages();
  assert.equal(notices.length, 1);
  assert(calls.every(route => route === '/api/messages/summary'));
});

test('resposta antiga do quadro não substitui filtros mais recentes', async () => {
  const state = { page: 'demandas-externas', user: { perfil: 'consulta' }, query: 'antigo', demandAssignee: '', demandRequester: '', demandCreatedDate: '', records: [], statuses: [], users: [] };
  let finishOld;
  const context = vm.createContext({ state, navigationRequest: 1, completedVisible: 25, URLSearchParams, render: () => {}, toast: message => { throw Error(message); }, api: route => {
    if (route.startsWith('/api/resources/')) return new Promise(resolve => { finishOld = resolve; });
    return Promise.resolve({ statuses: [] });
  } });
  vm.runInContext(source.slice(source.indexOf('function dataSnapshot('), source.indexOf('async function go(')), context);
  const oldRequest = context.load({ silent: true });
  context.navigationRequest = 2;
  state.query = 'novo';
  state.records = [{ id: 'resposta-atual' }];
  finishOld({ records: [{ id: 'resposta-antiga' }], pagination: {} });
  await oldRequest;
  assert.equal(state.records[0].id, 'resposta-atual');
});
test('atualização oculta não consulta servidor e a visível mantém atualização', async () => {
  const bootstrap = fs.readFileSync(path.join(__dirname, '../../public/assets/js/core/bootstrap.js'), 'utf8');
  let calls = 0;
  const context = vm.createContext({document: {hidden: true}, state: {token: 'teste', user: {}, page: 'dashboard'}, refreshUnreadMessages: async () => calls++, load: async () => calls++});
  vm.runInContext(bootstrap.slice(bootstrap.indexOf('async function refreshInBackground()'), bootstrap.indexOf('new MutationObserver')), context);
  await context.refreshInBackground(); assert.equal(calls, 0);
  context.document.hidden = false;
  await context.refreshInBackground(); assert.equal(calls, 2); assert.equal(context.state.backgroundRefreshing, false);
});

test('identificador inválido retorna ausência sem consultar PostgreSQL', async () => {
  const { createPostgresStore } = require('../../server/storage/postgres-store');
  const store = createPostgresStore({pool: {query: () => {throw new Error('consulta indevida');}}});
  assert.equal(await store.record('demandas', 'inexistente'), null);
});
