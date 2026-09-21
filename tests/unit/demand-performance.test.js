const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../../public/assets/js/app.js'), 'utf8');
test('histórico progressivo preserva todas as ativas e permite acessar concluídas antigas', () => {
  const context = vm.createContext({ completedVisible: 25, isCompletedDemand: card => card.status === 'Concluída' });
  vm.runInContext(source.slice(source.indexOf('function visibleDemandCards('), source.indexOf('function filteredDemandBoard(')), context);
  const completed = Array.from({length: 60}, (_, id) => ({id, status: 'Concluída'}));
  assert.equal(context.visibleDemandCards(completed).length, 25);
  assert.match(context.completedMoreButton(completed), /more-completed/);
  context.completedVisible = 75;
  assert.equal(context.visibleDemandCards(completed).length, 60);
  assert.equal(context.completedMoreButton(completed), '');
  context.completedVisible = 25;
  assert.equal(context.visibleDemandCards(completed.map(card => ({...card, status: 'Aberta'}))).length, 60);
  assert.equal(context.visibleDemandCards(completed.filter(card => card.id === 59))[0].id, 59);
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
