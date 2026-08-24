function createReportService({ getStore, resourceDefinitions, canAccess, demandBelongsToUser, buildExclusionReport, exclusionValue, formatProgramValue }) {
  const inPeriod = (record, start, end) => (!start || String(record.createdAt || '') >= `${start}T00:00:00`) && (!end || String(record.createdAt || '') <= `${end}T23:59:59.999`);
  const exclusionFilters = url => Object.fromEntries(['user', 'sector', 'type', 'reason', 'status'].map(field => [field, url.searchParams.get(`exclusion${field[0].toUpperCase()}${field.slice(1)}`) || '']));

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
    const demandStatus = ['Aberta', 'Em andamento', 'Concluída'].map(status => ({ status, total: demands.filter(record => record.status === status).length }));
    const activePrograms = canAccess(user, 'programas') ? (await store.records('programas')).filter(record => record.status !== 'Cancelado' && Number.isSafeInteger(Number(record.valor)) && Number(record.valor) > 0) : [];
    const programCosts = activePrograms.reduce((costs, record) => { const value = Number(record.valor); if (record.periodicidade === 'Mensal') costs.monthly += value; else costs.annual += value; return costs; }, { monthly: 0, annual: 0 });
    programCosts.monthlyEquivalent = Math.round(programCosts.monthly + programCosts.annual / 12);
    programCosts.annualEquivalent = programCosts.monthly * 12 + programCosts.annual;
    const exclusions = buildExclusionReport(demands, exclusionFilters(url));
    const audit = user.perfil === 'admin' ? (await store.audits()).filter(record => inPeriod(record, start, end)).slice(0, 100) : [];
    return { generatedAt: generatedAt(), period: { start, end }, modules, total: modules.reduce((sum, item) => sum + item.total, 0), alerts, demandStatus, lowStock: [], programCosts, activePrograms: activePrograms.length, exclusions, audit };
  }

  async function exportCsv(user, url) {
    const store = getStore();
    const start = url.searchParams.get('start');
    const end = url.searchParams.get('end');
    const rows = [['Relatório Central TI'], ['Período', start || 'Início', end || 'Hoje'], [], ['Módulo', 'Total']];
    for (const resource of Object.keys(resourceDefinitions).filter(resource => canAccess(user, resource))) {
      let records = (await store.records(resource)).filter(record => inPeriod(record, start, end));
      if (resource === 'demandas') records = records.filter(record => demandBelongsToUser(record, user));
      rows.push([resource, records.length]);
    }
    if (canAccess(user, 'programas')) {
      const programs = (await store.records('programas')).filter(record => record.status !== 'Cancelado' && Number.isSafeInteger(Number(record.valor)) && Number(record.valor) > 0);
      const costs = programs.reduce((total, record) => { if (record.periodicidade === 'Mensal') total.monthly += Number(record.valor); else total.annual += Number(record.valor); return total; }, { monthly: 0, annual: 0 });
      rows.push([], ['Custos recorrentes de programas', 'Valor'], ['Custo mensal equivalente', formatProgramValue(Math.round(costs.monthly + costs.annual / 12))], ['Custo anual estimado', formatProgramValue(costs.monthly * 12 + costs.annual)]);
    }
    const demands = (await store.records('demandas')).filter(record => demandBelongsToUser(record, user) && inPeriod(record, start, end));
    const exclusions = buildExclusionReport(demands, exclusionFilters(url));
    rows.push([], ['Solicitações de exclusão'], ['Ticket', 'Atendimento', 'Paciente', 'Usuário solicitante', 'Setor', 'Tipo', 'Categoria do motivo', 'Motivo', 'Solicitada em', 'Status', 'Concluída por', 'Concluída em']);
    for (const record of exclusions.records) rows.push([record.ticket || '', record.numeroAtendimento || '', record.nomePaciente || '', exclusionValue(record, 'user'), exclusionValue(record, 'sector'), exclusionValue(record, 'type'), exclusionValue(record, 'reason'), record.motivoExclusao || '', record.createdAt || '', record.status || '', record.exclusaoConcluidaPor || '', record.exclusaoConcluidaEm || '']);
    rows.push([], ['Alertas técnicos', 'Avaliação']);
    for (const resource of ['computadores', 'equipamentos'].filter(resource => canAccess(user, resource))) for (const record of (await store.records(resource)).filter(record => inPeriod(record, start, end)).filter(record => record.avaliacao && record.avaliacao !== 'Bom')) rows.push([resource === 'computadores' ? record.patrimonio : record.equipamento, record.avaliacao]);
    return `\uFEFF${rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')}`;
  }

  return { report, exportCsv };
}

module.exports = { createReportService };
