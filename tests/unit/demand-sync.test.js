const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../../public/assets/js/app.js'), 'utf8');
const bootstrap = fs.readFileSync(path.join(__dirname, '../../public/assets/js/core/bootstrap.js'), 'utf8');
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function harness(api, page = 'demandas') {
  const original = { id: 'ticket-1', status: 'Aberta', tecnicoResponsavel: '', titulo: 'Teste', tipo: 'interna' };
  const state = { page, token: 'test-session', user: { perfil: 'ti' }, records: [original], modal: null, statuses: [], users: [] };
  const renders = [], messages = [];
  const context = vm.createContext({ state, api, document: { hidden: false, querySelector: () => null }, render: options => renders.push(options), toast: message => messages.push(message), beginPendingAction() {}, releasePendingAction() {}, refreshUnreadMessages: async () => {}, dataSnapshot: () => JSON.stringify(state) });
  for (const [start, end] of [
    ['let navigationRequest = 0;', 'let searchTimer;'],
    ['async function load(options', 'async function go(page)'],
    ['async function openDemandDetails(id)', 'async function sendDemandComment'],
    ['async function assignDemandToMe(id)', 'function updateDemandCategory'],
    ['async function moveDemand(id, status)', 'async function saveStatuses'],
  ]) {
    const from = source.indexOf(start);
    const to = source.indexOf(end, from + start.length);
    vm.runInContext(source.slice(from, to < 0 ? undefined : to), context);
  }
  vm.runInContext(bootstrap.slice(bootstrap.indexOf('async function refreshInBackground()'), bootstrap.indexOf('new MutationObserver')), context);
  return { context, state, original, renders, messages };
}
const assigned = { id: 'ticket-1', status: 'Em andamento', tecnicoResponsavel: 'Técnico', updatedAt: '2026-10-09T12:00:00Z' };
for (const page of ['demandas', 'demandas-internas', 'demandas-externas']) {
  test(`assumir e mover atualizam imediatamente a resposta confirmada em ${page}`, async () => {
    const calls = [], pending = deferred();
    const h = harness(async (url, options) => {
      calls.push([url, options]);
      if (url.endsWith('assign-self')) return pending.promise;
      return { record: { ...assigned, status: 'Concluída' } };
    }, page);
    h.state.modal = { type: 'demand-details', record: { ...h.original, interacoes: [{ texto: 'Histórico' }] } };
    const assigning = h.context.assignDemandToMe('ticket-1');
    assert.equal(h.state.records[0], h.original);
    pending.resolve({ record: assigned });
    await assigning;
    assert.equal(h.state.records[0].tecnicoResponsavel, 'Técnico');
    assert.equal(h.state.modal.record.status, 'Em andamento');
    assert.equal(h.state.modal.record.interacoes.length, 1);
    h.state.modal = null;
    await h.context.moveDemand('ticket-1', 'Concluída');
    assert.equal(h.state.records[0].status, 'Concluída');
    assert.equal(calls.length, 2);
    assert.equal(calls[1][1].method, 'PUT');
    assert.equal(h.state.loading, undefined);
    assert.equal(h.renders.length, 2);
  });
}
for (const action of ['assign', 'move']) {
  test(`${action}: falha preserva card e detalhes anteriores`, async () => {
    const h = harness(async () => { throw new Error('Permissão negada'); });
    if (action === 'move') h.original.tecnicoResponsavel = 'Técnico';
    h.state.modal = { type: 'demand-details', record: h.original };
    await (action === 'assign' ? h.context.assignDemandToMe('ticket-1') : h.context.moveDemand('ticket-1', 'Concluída'));
    assert.equal(h.state.records[0], h.original);
    assert.equal(h.state.modal.record, h.original);
    assert.equal(h.state.records[0].status, 'Aberta');
    assert.equal(h.messages.at(-1), 'Permissão negada');
  });
}
test('consultar detalhes sincroniza o card antes de mover', async () => {
  const h = harness(async url => url.endsWith('/status') ? { record: { ...assigned, status: 'Concluída' } } : { records: [assigned] });
  await h.context.openDemandDetails('ticket-1');
  assert.equal(h.state.records[0].tecnicoResponsavel, 'Técnico');
  await h.context.moveDemand('ticket-1', 'Concluída');
  assert.equal(h.state.records[0].status, 'Concluída');
});
for (const action of ['assign', 'move']) for (const arrival of ['during', 'after']) {
  test(`consulta automática antiga recebida ${arrival} ${action} não sobrescreve card`, async () => {
    const list = deferred(), mutation = deferred(), started = deferred();
    const h = harness(async url => {
      if (url.endsWith('/assign-self') || url.endsWith('/status')) return mutation.promise;
      if (url === '/api/resources/demandas') { started.resolve(); return list.promise; }
      return { statuses: ['Aberta', 'Em andamento'] };
    });
    if (action === 'move') h.original.tecnicoResponsavel = 'Técnico';
    const refreshing = h.context.refreshInBackground();
    await started.promise;
    const assigning = action === 'assign' ? h.context.assignDemandToMe('ticket-1') : h.context.moveDemand('ticket-1', 'Em andamento');
    if (arrival === 'after') { mutation.resolve({ record: assigned }); await assigning; }
    list.resolve({ records: [{ ...h.original }] });
    await refreshing;
    if (arrival === 'during') { mutation.resolve({ record: assigned }); await assigning; }
    assert.equal(h.state.records[0].status, 'Em andamento');
    // Uma consulta posterior ainda pode trazer alterações de outros usuários.
    h.context.api = async url => url === '/api/resources/demandas' ? { records: [{ ...assigned, status: 'Concluída' }] } : { statuses: [] };
    await h.context.load({ silent: true });
    assert.equal(h.state.records[0].status, 'Concluída');
  });
}
test('duas consultas de lista fora de ordem mantêm a mais recente', async () => {
  const old = deferred(); let count = 0;
  const h = harness(async url => url === '/api/resources/demandas' ? (++count === 1 ? old.promise : { records: [assigned] }) : { statuses: [] });
  const first = h.context.load({ silent: true });
  await h.context.load({ silent: true });
  old.resolve({ records: [h.original] }); await first;
  assert.equal(h.state.records[0].status, 'Em andamento');
});
test('detalhes antigos não sobrescrevem confirmação de alteração', async () => {
  const details = deferred();
  const h = harness(async url => url.endsWith('/assign-self') ? { record: assigned } : details.promise);
  const reading = h.context.openDemandDetails('ticket-1');
  await h.context.assignDemandToMe('ticket-1');
  details.resolve({ records: [h.original] }); await reading;
  assert.equal(h.state.records[0].status, 'Em andamento');
  assert.equal(h.state.modal, null);
});
test('alterações simultâneas no mesmo card são serializadas por bloqueio local', async () => {
  const pending = deferred(); let calls = 0;
  const h = harness(async () => { calls++; return pending.promise; });
  h.original.tecnicoResponsavel = 'Técnico';
  const first = h.context.moveDemand('ticket-1', 'Em andamento');
  await h.context.moveDemand('ticket-1', 'Concluída');
  assert.equal(calls, 1);
  pending.resolve({ record: assigned }); await first;
  assert.equal(h.state.records[0].status, 'Em andamento');
});

test('falha na leitura de detalhes preserva card e modal', async () => {
  const h = harness(async () => { throw new Error('Falha de consulta'); });
  const modal = h.state.modal = { type: 'demand-details', record: h.original };
  await h.context.openDemandDetails('ticket-1');
  assert.equal(h.state.records[0], h.original);
  assert.equal(h.state.modal, modal);
});
test('resposta de alteração após navegação não contamina registros de outro módulo', async () => {
  const pending = deferred();
  const h = harness(async () => pending.promise);
  const assigning = h.context.assignDemandToMe('ticket-1');
  h.state.page = 'equipamentos';
  const equipment = { id: 'ticket-1', status: 'Em uso' };
  h.state.records = [equipment];
  pending.resolve({ record: assigned }); await assigning;
  assert.equal(h.state.records[0], equipment);
});
test('consulta iniciada durante alteração não regride o card ao chegar depois', async () => {
  const list = deferred(), pending = deferred();
  const h = harness(async url => url.endsWith('/assign-self') ? pending.promise : url === '/api/resources/demandas' ? list.promise : { statuses: [] });
  const assigning = h.context.assignDemandToMe('ticket-1');
  const loading = h.context.load({ silent: true });
  pending.resolve({ record: assigned }); await assigning;
  list.resolve({ records: [h.original] }); await loading;
  assert.equal(h.state.records[0].status, 'Em andamento');
});
