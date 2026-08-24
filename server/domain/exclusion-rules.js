const EXCLUSION_REASON_CATEGORIES = ['Atendimento duplicado', 'Paciente incorreto', 'Procedimento incorreto', 'Convênio incorreto', 'Guia/autorização incorreta', 'Lançamento por engano', 'Cadastro duplicado', 'Exame/procedimento duplicado', 'Outros'];

function normalized(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function isExclusionDemand(demand) {
  const subject = typeof demand === 'object' ? demand?.assunto : demand;
  return normalized(subject).includes('exclusao');
}

function isCompletedDemandStatus(status) {
  return /conclu|finaliz|resolvid|encerr/.test(normalized(status));
}

function exclusionValue(record, field) {
  if (field === 'user') return record.usuarioSolicitante || record.solicitante || 'Não informado';
  if (field === 'sector') return record.setorSolicitante || 'Não informado';
  if (field === 'type') return record.assunto || 'Não informado';
  if (field === 'reason') return record.categoriaMotivoExclusao || 'Não categorizado';
  if (field === 'status') return record.status || 'Não informado';
  return '';
}

function exclusionStatus(record) {
  if (/recus|cancel/.test(normalized(record.status))) return 'declined';
  return isCompletedDemandStatus(record.status) ? 'completed' : 'pending';
}

function countExclusions(records, field) {
  return [...records.reduce((map, record) => map.set(exclusionValue(record, field), (map.get(exclusionValue(record, field)) || 0) + 1), new Map()).entries()]
    .map(([label, total]) => ({ label, total }))
    .sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
}

function buildExclusionReport(demands, filters = {}) {
  const all = demands.filter(isExclusionDemand);
  const filtered = all.filter(record => ['user', 'sector', 'type', 'reason', 'status'].every(field => !filters[field] || exclusionValue(record, field) === filters[field]));
  const months = [...filtered.reduce((map, record) => {
    const key = String(record.createdAt || '').slice(0, 7) || 'Sem data';
    const current = map.get(key) || { month: key, total: 0, completed: 0 };
    current.total += 1;
    if (exclusionStatus(record) === 'completed') current.completed += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((a, b) => a.month.localeCompare(b.month));
  const recurring = [...filtered.reduce((map, record) => {
    const label = `${exclusionValue(record, 'user')} · ${exclusionValue(record, 'reason')}`;
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map()).entries()].map(([label, total]) => ({ label, total })).filter(item => item.total > 1).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));

  return {
    total: filtered.length,
    completed: filtered.filter(record => exclusionStatus(record) === 'completed').length,
    pending: filtered.filter(record => exclusionStatus(record) === 'pending').length,
    declined: filtered.filter(record => exclusionStatus(record) === 'declined').length,
    users: countExclusions(filtered, 'user'), sectors: countExclusions(filtered, 'sector'), types: countExclusions(filtered, 'type'), reasons: countExclusions(filtered, 'reason'), statuses: countExclusions(filtered, 'status'), months, recurring,
    filters: Object.fromEntries(['user', 'sector', 'type', 'reason', 'status'].map(field => [field, countExclusions(all, field).map(item => item.label)])),
    records: filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  };
}

function sanitizeExclusionRequest(values, repairTextEncoding) {
  const category = repairTextEncoding(String(values.categoriaMotivoExclusao || '').trim());
  if (!EXCLUSION_REASON_CATEGORIES.includes(category)) return null;
  const fields = [['numeroAtendimento', 100], ['nomePaciente', 250], ['motivoExclusao', 1000]];
  const result = {};
  for (const [key, limit] of fields) {
    const value = repairTextEncoding(String(values[key] || '').trim());
    if (!value || value.length > limit) return null;
    result[key] = value;
  }
  result.categoriaMotivoExclusao = category;
  return result;
}

function markExclusionMetadata(record, user, now) {
  if (!isExclusionDemand(record)) return;
  record.usuarioSolicitante ||= user.nome;
  record.setorSolicitante ||= user.setor || 'Não informado';
  record.solicitanteId ||= user.id;
  if (isCompletedDemandStatus(record.status) && !record.exclusaoConcluidaEm) {
    record.exclusaoConcluidaPor = user.nome;
    record.exclusaoConcluidaEm = now();
  }
}

module.exports = { EXCLUSION_REASON_CATEGORIES, isCompletedDemandStatus, isExclusionDemand, exclusionValue, buildExclusionReport, sanitizeExclusionRequest, markExclusionMetadata };
