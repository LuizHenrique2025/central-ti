function createReportService({ getStore, resourceDefinitions, canAccess, demandBelongsToUser, buildExclusionReport, exclusionValue, formatProgramValue }) {
  const inPeriod = (record, start, end) => (!start || String(record.createdAt || '') >= `${start}T00:00:00`) && (!end || String(record.createdAt || '') <= `${end}T23:59:59.999`);
  const exclusionFilters = url => Object.fromEntries(['user', 'sector', 'type', 'reason', 'status'].map(field => [field, url.searchParams.get(`exclusion${field[0].toUpperCase()}${field.slice(1)}`) || '']));
  const filterValues = (url, key) => [...new Set(url.searchParams.getAll(`demand${key}`).map(value => String(value || '').trim()).filter(Boolean))];
  const completedDemand = status => /conclu|finaliz|resolvid|encerr/i.test(String(status || ''));
  const canonicalCategory = value => String(value || '').trim() === 'Outro' ? 'Outros' : String(value || '').trim();
  const demandReason = record => String(record.assunto || '').trim() || (canonicalCategory(record.categoria) === 'Outros' && String(record.outroDetalhe || '').trim() ? 'Outros' : 'Não classificada');
  const countBy = (records, key) => [...records.reduce((totals, record) => {
    const value = String(key(record) || '').trim() || 'Não informado';
    totals.set(value, (totals.get(value) || 0) + 1);
    return totals;
  }, new Map()).entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
  const percent = (part, total) => total ? Math.round(part / total * 1000) / 10 : 0;

  async function demandReport(user, url) {
    const store = getStore();
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const people = await store.users();
    const byId = new Map(people.map(person => [person.id, person]));
    const byName = new Map(people.map(person => [String(person.nome || '').trim(), person]));
    const details = (await store.records('demandas')).filter(record => demandBelongsToUser(record, user) && inPeriod(record, start, end)).map(record => {
      const requester = byId.get(record.solicitanteId || record.createdBy) || byName.get(String(record.solicitante || '').trim());
      const requesterName = String(record.solicitante || requester?.nome || 'Não informado').trim() || 'Não informado';
      const assignee = String(record.tecnicoResponsavel || '').trim() || 'Não atribuída';
      const category = canonicalCategory(record.categoria) || 'Não classificada';
      return { ticket: record.ticket || '—', requester: requesterName, sector: String(record.setorSolicitante || requester?.setor || '').trim() || 'Não informado', assignee, category, reason: demandReason(record), status: String(record.status || '').trim() || 'Sem status', createdAt: record.createdAt || '', completed: completedDemand(record.status), record };
    });
    const filters = Object.fromEntries(['Assignee', 'Requester', 'Sector', 'Reason', 'Category', 'Status'].map(key => [key.toLowerCase(), filterValues(url, key)]));
    const matches = (values, value) => !values.length || values.includes(value);
    const records = details.filter(record => matches(filters.assignee, record.assignee) && matches(filters.requester, record.requester) && matches(filters.sector, record.sector) && matches(filters.reason, record.reason) && matches(filters.category, record.category) && matches(filters.status, record.status));
    const selectors = {
      assignees: countBy(details, record => record.assignee).map(item => item.label), requesters: countBy(details, record => record.requester).map(item => item.label), sectors: countBy(details, record => record.sector).map(item => item.label), reasons: countBy(details, record => record.reason).map(item => item.label), categories: countBy(details, record => record.category).map(item => item.label), statuses: countBy(details, record => record.status).map(item => item.label)
    };
    const total = records.length;
    const completed = records.filter(record => record.completed).length;
    const requesterTotals = new Map();
    for (const record of records) {
      const current = requesterTotals.get(record.requester) || { requester: record.requester, sector: record.sector, total: 0, reasons: new Map() };
      current.total += 1;
      current.reasons.set(record.reason, (current.reasons.get(record.reason) || 0) + 1);
      requesterTotals.set(record.requester, current);
    }
    const mainReasons = [...requesterTotals.values()].map(item => {
      const max = Math.max(...item.reasons.values());
      const reasons = [...item.reasons.entries()].filter(([, count]) => count === max).map(([reason]) => reason).sort((a, b) => a.localeCompare(b, 'pt-BR'));
      return { requester: item.requester, sector: item.sector, total: item.total, reason: reasons.length > 1 ? `Empate: ${reasons.join(' / ')}` : reasons[0], quantity: max, percentOfRequester: percent(max, item.total), percentOfTotal: percent(item.total, total), tied: reasons.length > 1 };
    }).sort((a, b) => b.total - a.total || a.requester.localeCompare(b.requester, 'pt-BR'));
    const professionals = countBy(records, record => record.assignee).map(item => {
      const professionalRecords = records.filter(record => record.assignee === item.label);
      const professionalCompleted = professionalRecords.filter(record => record.completed).length;
      return { professional: item.label, assumed: item.total, completed: professionalCompleted, open: item.total - professionalCompleted, percentOfTotal: percent(item.total, total) };
    });
    const openedByDate = countBy(records, record => String(record.createdAt || '').slice(0, 10) || 'Sem data').sort((a, b) => a.label.localeCompare(b.label));
    return { filters, selectors, records, metrics: { total, completed, open: total - completed, completedPercent: percent(completed, total), topRequester: mainReasons[0]?.requester || '—', topReason: countBy(records, record => record.reason)[0]?.label || '—' }, mainReasons, professionals, reasons: countBy(records, record => record.reason), requesters: countBy(records, record => record.requester), statuses: countBy(records, record => record.status), openedByDate };
  }

  async function report(user, url, generatedAt) {
    const store = getStore();
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const visible = Object.keys(resourceDefinitions).filter(resource => canAccess(user, resource));
    const data = Object.fromEntries(await Promise.all(visible.map(async resource => {
      let records = (await store.records(resource)).filter(record => inPeriod(record, start, end));
      if (resource === 'demandas') records = records.filter(record => demandBelongsToUser(record, user));
      return [resource, records];
    })));
    const modules = visible.map(resource => ({ resource, total: data[resource].length }));
    const alerts = ['computadores', 'equipamentos'].filter(resource => data[resource]).flatMap(resource => data[resource].filter(record => record.avaliacao && record.avaliacao !== 'Bom').map(record => ({ resource, item: resource === 'computadores' ? record.patrimonio : record.equipamento, responsavel: record.responsavel, avaliacao: record.avaliacao }))).concat((data.ramais || []).filter(record => record.funcionamento && record.funcionamento !== 'Bom funcionamento').map(record => ({ resource: 'ramais', item: `Ramal ${record.ramal}`, responsavel: record.responsavel, avaliacao: record.funcionamento })));
    const demands = data.demandas || [];
    const demandStatus = countBy(demands, record => record.status).map(item => ({ status: item.label, total: item.total }));
    const activePrograms = canAccess(user, 'programas') ? (await store.records('programas')).filter(record => record.status !== 'Cancelado' && Number.isSafeInteger(Number(record.valor)) && Number(record.valor) > 0) : [];
    const programCosts = activePrograms.reduce((costs, record) => { const value = Number(record.valor); if (record.periodicidade === 'Mensal') costs.monthly += value; else costs.annual += value; return costs; }, { monthly: 0, annual: 0 });
    programCosts.monthlyEquivalent = Math.round(programCosts.monthly + programCosts.annual / 12);
    programCosts.annualEquivalent = programCosts.monthly * 12 + programCosts.annual;
    const exclusions = buildExclusionReport(demands, exclusionFilters(url));
    const audit = user.perfil === 'admin' ? (await store.audits()).filter(record => inPeriod(record, start, end)).slice(0, 100) : [];
    return { generatedAt: generatedAt(), period: { start, end }, modules, total: modules.reduce((sum, item) => sum + item.total, 0), alerts, demandStatus, demandReport: await demandReport(user, url), lowStock: [], programCosts, activePrograms: activePrograms.length, exclusions, audit };
  }

  async function exportCsv(user, url) {
    const store = getStore();
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const demandData = await demandReport(user, url);
    const rows = [['Relatório Central TI'], ['Período', start || 'Início', end || 'Hoje'], [], ['Demandas detalhadas'], ['Ticket', 'Abertura', 'Solicitante', 'Setor', 'Motivo', 'Categoria', 'Responsável', 'Status']];
    for (const record of demandData.records) rows.push([record.ticket, record.createdAt, record.requester, record.sector, record.reason, record.category, record.assignee, record.status]);
    rows.push([], ['Principal motivo por solicitante'], ['Solicitante', 'Setor', 'Total', 'Principal motivo', 'Quantidade', '% no solicitante', '% geral']);
    for (const item of demandData.mainReasons) rows.push([item.requester, item.sector, item.total, item.reason, item.quantity, `${item.percentOfRequester}%`, `${item.percentOfTotal}%`]);
    rows.push([], ['Distribuição por profissional'], ['Profissional', 'Assumidas', 'Concluídas', 'Em aberto', '% do total']);
    for (const item of demandData.professionals) rows.push([item.professional, item.assumed, item.completed, item.open, `${item.percentOfTotal}%`]);
    const demands = demandData.records.map(item => item.record);
    const exclusions = buildExclusionReport(demands, exclusionFilters(url));
    rows.push([], ['Solicitações de exclusão'], ['Ticket', 'Atendimento', 'Paciente', 'Usuário solicitante', 'Setor', 'Tipo', 'Categoria do motivo', 'Motivo', 'Solicitada em', 'Status', 'Concluída por', 'Concluída em']);
    for (const record of exclusions.records) rows.push([record.ticket || '', record.numeroAtendimento || '', record.nomePaciente || '', exclusionValue(record, 'user'), exclusionValue(record, 'sector'), exclusionValue(record, 'type'), exclusionValue(record, 'reason'), record.motivoExclusao || '', record.createdAt || '', record.status || '', record.exclusaoConcluidaPor || '', record.exclusaoConcluidaEm || '']);
    if (canAccess(user, 'programas')) {
      const programs = (await store.records('programas')).filter(record => record.status !== 'Cancelado' && Number.isSafeInteger(Number(record.valor)) && Number(record.valor) > 0);
      const costs = programs.reduce((total, record) => { if (record.periodicidade === 'Mensal') total.monthly += Number(record.valor); else total.annual += Number(record.valor); return total; }, { monthly: 0, annual: 0 });
      rows.push([], ['Custos recorrentes de programas', 'Valor'], ['Custo mensal equivalente', formatProgramValue(Math.round(costs.monthly + costs.annual / 12))], ['Custo anual estimado', formatProgramValue(costs.monthly * 12 + costs.annual)]);
    }
    return `\uFEFF${rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')}`;
  }

  return { report, exportCsv };
}

module.exports = { createReportService };
