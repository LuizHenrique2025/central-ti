const test = require('node:test');
const assert = require('node:assert/strict');
const { sanitizeMaterialRequest, materialRequestAccess, canViewMaterialRequest } = require('../../server/domain/material-requests');
const user = { id: 'u1', nome: 'Pessoa de teste', perfil: 'consulta' };
const body = { item: 'Bobina — Totem', quantidade: '2', setor: 'Recepção' };
test('pedido valida catálogo, quantidade e descrição de materiais diversos', () => {
  const record = sanitizeMaterialRequest({ ...body, status: 'Entregue', solicitante: 'Outro' }, user);
  assert.equal(record.status, 'Solicitado'); assert.equal(record.solicitante, user.nome); assert.equal(record.categoria, 'Bobinas');
  for (const quantidade of ['0', '-1', '1.5', 'abc', '10001']) assert.equal(sanitizeMaterialRequest({ ...body, quantidade }, user), null);
  assert.equal(sanitizeMaterialRequest({ ...body, item: 'Item inválido' }, user), null);
  assert.equal(sanitizeMaterialRequest({ ...body, item: 'Materiais diversos' }, user), null);
  assert(sanitizeMaterialRequest({ ...body, item: 'Materiais diversos', observacoes: 'Uma caixa de clips' }, user));
  assert.equal(sanitizeMaterialRequest({ ...body, status: 'Inválido' }, user, record), null);
  assert.equal(sanitizeMaterialRequest({ ...body, status: 'Entregue' }, { nome: 'Técnico' }, record).solicitante, user.nome);
});
test('solicitante vê somente seus pedidos e TI administra o atendimento', () => {
  assert(materialRequestAccess(user, 'create')); assert(!materialRequestAccess(user, 'update')); assert(!materialRequestAccess(user, 'delete'));
  assert(!canViewMaterialRequest({ createdBy: 'u2' }, user)); assert(canViewMaterialRequest({ createdBy: 'u1' }, user));
  assert(materialRequestAccess({ perfil: 'ti' }, 'update')); assert(canViewMaterialRequest({ createdBy: 'u2' }, { perfil: 'ti' }));
});
