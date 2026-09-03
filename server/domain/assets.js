function isAsset(resource) {
  return resource === 'computadores' || resource === 'equipamentos';
}

function assetSituation(resource, record) {
  const current = String(resource === 'computadores' ? record.status : record.condicao).toLowerCase();
  if (current.includes('dispon')) return 'Disponível';
  if (current.includes('manuten')) return 'Em manutenção';
  if (current.includes('indispon')) return 'Indisponível';
  return 'Em uso';
}

function assetDescription(resource, record) {
  return resource === 'computadores'
    ? `Computador · ${record.patrimonio}`
    : `${record.equipamento} · ${record.categoriaEquipamento || 'Equipamento'}`;
}

module.exports = { isAsset, assetSituation, assetDescription };
