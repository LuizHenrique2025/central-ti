const { demandBelongsToUser } = require('./demand-access');
const { isCompletedDemandStatus } = require('./exclusion-rules');

// Cards do quadro não precisam de descrições, conversas ou dados de anexos.
const demandBoardFields = ['ticket', 'titulo', 'solicitante', 'solicitanteId', 'tipo', 'categoria', 'assunto', 'tecnicoResponsavel', 'empresa', 'prioridade', 'status', 'prazoSla'];
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

function validBoardDate(value) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function boardRecord(record) {
  return Object.fromEntries(['id', ...demandBoardFields, 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'].map(key => [key, record[key]]));
}

function demandBoardPage(records, user, options = {}) {
  const requestedLimit = Number(options.completedLimit);
  const completedLimit = Number.isSafeInteger(requestedLimit) && requestedLimit > 0 ? requestedLimit : 25;
  const scope = records.filter(record => demandBelongsToUser(record, user) && (!options.type || (record.tipo || 'interna') === options.type));
  const names = key => [...new Set(scope.map(record => String(record[key] || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const filters = {
    assignees: names('tecnicoResponsavel'), requesters: names('solicitante'),
    mineCount: scope.filter(record => normalize(record.tecnicoResponsavel) === normalize(user.nome)).length,
    unassignedCount: scope.filter(record => !String(record.tecnicoResponsavel || '').trim()).length
  };
  const query = normalize(options.query);
  const matches = scope.filter(record => {
    if (query && !['ticket', 'titulo', 'solicitante', 'categoria', 'assunto', 'tecnicoResponsavel', 'empresa'].some(key => normalize(record[key]).includes(query))) return false;
    const assignee = String(record.tecnicoResponsavel || '').trim();
    if (options.assignee === '__mine__' && normalize(assignee) !== normalize(user.nome)) return false;
    if (options.assignee === '__unassigned__' && assignee) return false;
    if (options.assignee && !['__mine__', '__unassigned__'].includes(options.assignee) && assignee !== options.assignee) return false;
    if (options.requester && String(record.solicitante || '').trim() !== options.requester) return false;
    if (options.createdDate || options.createdStart || options.createdEnd) {
      const date = new Date(new Date(record.createdAt).getTime() - Number(options.timezoneOffset || 0) * 60000);
      if (Number.isNaN(date.getTime())) return false;
      const day = date.toISOString().slice(0, 10);
      const start = options.createdDate || options.createdStart;
      const end = options.createdDate || options.createdEnd;
      if ((start && day < start) || (end && day > end)) return false;
    }
    return true;
  }).sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)) || String(b.id).localeCompare(String(a.id)));
  const totals = Object.create(null);
  const included = Object.create(null);
  const page = [];
  for (const record of matches) {
    const status = record.status || '';
    totals[status] = (totals[status] || 0) + 1;
    if (isCompletedDemandStatus(status) && (included[status] || 0) >= completedLimit) continue;
    included[status] = (included[status] || 0) + 1;
    page.push(boardRecord(record));
  }
  return { records: page, pagination: { completedLimit, totals, filters } };
}

module.exports = { demandBoardFields, boardRecord, demandBoardPage, validBoardDate };
