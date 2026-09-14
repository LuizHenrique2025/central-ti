const MATERIAL_CATALOG = {
  Bobinas: ['Bobina — Totem', 'Bobina — Maquininha', 'Bobina — Painel'],
  Papelaria: ['Lápis', 'Papel A4', 'Materiais diversos'],
  Periféricos: ['Teclado', 'Mouse']
};
const MATERIAL_STATUSES = ['Solicitado', 'Em atendimento', 'Entregue'];
const managesMaterialRequests = user => ['admin', 'ti'].includes(user?.perfil);
const canViewMaterialRequest = (record, user) => managesMaterialRequests(user) || record.createdBy === user.id;
function materialRequestAccess(user, mode) {
  return ['list', 'consult', 'create'].includes(mode) || (mode === 'update' && managesMaterialRequests(user)) || (mode === 'delete' && user.perfil === 'admin');
}
function sanitizeMaterialRequest(body, user, previous = null) {
  const item = String(body.item || '').trim();
  const categoria = Object.keys(MATERIAL_CATALOG).find(key => MATERIAL_CATALOG[key].includes(item));
  const rawQuantity = String(body.quantidade ?? '').trim();
  const quantidade = Number(rawQuantity);
  const setor = String(body.setor || '').trim();
  const observacoes = String(body.observacoes || '').trim();
  const status = previous ? String(body.status || previous.status) : 'Solicitado';
  if (!categoria || !/^\d+$/.test(rawQuantity) || !Number.isSafeInteger(quantidade) || quantidade < 1 || quantidade > 10000 || !setor || setor.length > 120 || observacoes.length > 1000 || !MATERIAL_STATUSES.includes(status) || (item === 'Materiais diversos' && !observacoes)) return null;
  return { item, categoria, quantidade, setor, observacoes, status, solicitante: previous?.solicitante || user.nome };
}
module.exports = { MATERIAL_CATALOG, MATERIAL_STATUSES, materialRequestAccess, canViewMaterialRequest, sanitizeMaterialRequest };
