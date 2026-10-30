function reportDateSeries(rows) {
  const valid = rows.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.label));
  const mode = valid.length <= 31 ? 'day' : new Set(valid.map(row => row.label.slice(0, 7))).size <= 24 ? 'month' : 'year';
  const groups = new Map();
  for (const row of valid) {
    const key = row.label.slice(0, mode === 'day' ? 10 : mode === 'month' ? 7 : 4);
    groups.set(key, (groups.get(key) || 0) + row.total);
  }
  return { mode, rows: [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([label, total]) => ({ label, total })) };
}

function reportsOverview(report) {
  const demand = report.demandReport;
  if (!demand) return '<div class="empty">Não há dados de demandas para exibir.</div>';
  const { metrics } = demand;
  const requesters = new Set(demand.records.map(record => record.requester)).size;
  const cards = [['Total de demandas', metrics.total, 'Registros no período e filtros aplicados'], ['Taxa de conclusão', `${metrics.completedPercent}%`, `${metrics.completed} demandas concluídas`], ['Em aberto', metrics.open, 'Demandas que ainda não foram concluídas'], ['Solicitantes', requesters, 'Solicitantes distintos na consulta']];
  const series = reportDateSeries(demand.openedByDate);
  const maximum = Math.max(1, ...series.rows.map(row => row.total));
  const dateLabel = value => series.mode === 'year' ? value : series.mode === 'month' ? `${value.slice(5)}/${value.slice(0, 4)}` : `${value.slice(8)}/${value.slice(5, 7)}`;
  const statuses = demand.statuses;
  const tones = ['var(--hospital-accent)', 'var(--hospital-priority-low)', 'var(--hospital-priority-high)', 'var(--hospital-priority-critical)', 'var(--hospital-muted)'];
  let offset = 0;
  const segments = statuses.map((status, index) => {
    const start = offset;
    offset += metrics.total ? status.total / metrics.total * 100 : 0;
    return `${tones[index % tones.length]} ${start}% ${offset}%`;
  });
  const professionals = demand.professionals.map(person => {
    const rate = person.assumed ? Math.round(person.completed / person.assumed * 100) : 0;
    return `<tr><td><strong>${esc(person.professional)}</strong></td><td>${person.assumed}</td><td>${person.completed}</td><td>${person.open}</td><td><span class="report-rate"><progress max="100" value="${rate}" aria-label="Taxa de conclusão de ${esc(person.professional)}"></progress>${rate}%</span></td></tr>`;
  });
  return `<section class="reports-kpis" aria-label="Indicadores de demandas">${cards.map(([label, value, hint]) => `<article class="reports-kpi"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(hint)}</small></article>`).join('')}</section><div class="reports-section-heading"><div><h2>Visão de desempenho</h2><p>Resultados da consulta atual</p></div><div class="reports-presets" role="group" aria-label="Consultar período recente">${[7, 30, 90].map(days => `<button type="button" class="secondary" data-action="report-recent-period" data-days="${days}">Últimos ${days} dias</button>`).join('')}</div></div><div class="reports-chart-grid"><section class="panel reports-chart"><div class="panel-heading"><div><h3>Demandas abertas por ${series.mode === 'day' ? 'dia' : series.mode === 'month' ? 'mês' : 'ano'}</h3><p>Data de abertura dos registros filtrados</p></div></div>${series.rows.length ? `<div class="reports-series" role="list" aria-label="Quantidade de demandas abertas por período">${series.rows.map(row => `<div class="reports-series-item" role="listitem" aria-label="${esc(row.label)}: ${row.total} demandas"><b>${row.total}</b><div><i style="height:${Math.max(2, row.total / maximum * 100)}%"></i></div><span>${esc(dateLabel(row.label))}</span></div>`).join('')}</div>` : '<div class="empty">Nenhuma abertura com data informada nesta consulta.</div>'}</section><section class="panel reports-chart"><div class="panel-heading"><h3>Demandas por status</h3></div>${metrics.total ? `<div class="reports-status"><div class="reports-donut" role="img" aria-label="${metrics.total} demandas. Distribuição detalhada na legenda." style="background:conic-gradient(${segments.join(',')})"><span><strong>${metrics.total}</strong>Demandas</span></div><ul>${statuses.map((status, index) => `<li><i style="background:${tones[index % tones.length]}" aria-hidden="true"></i><span>${esc(status.label)}</span><b>${status.total}</b><small>${Math.round(status.total / metrics.total * 1000) / 10}%</small></li>`).join('')}</ul></div>` : '<div class="empty">Nenhuma demanda encontrada com estes filtros.</div>'}</section></div><div class="reports-bottom-grid"><section class="panel table-panel reports-professionals"><div class="panel-heading"><div><h3>Desempenho por profissional</h3><p>Conclusão dos registros atribuídos na consulta</p></div></div>${professionals.length ? `<div class="reports-table-scroll"><table class="data-table"><thead><tr><th>Profissional</th><th>Assumidas</th><th>Concluídas</th><th>Em aberto</th><th>Conclusão</th></tr></thead><tbody>${professionals.join('')}</tbody></table></div>` : '<div class="empty">Sem profissionais nesta consulta.</div>'}</section><section class="panel reports-insights"><div class="panel-heading"><h3>Leitura do período</h3></div><dl><dt>Solicitante com mais demandas</dt><dd>${esc(metrics.topRequester)}</dd><dt>Motivo mais frequente</dt><dd>${esc(metrics.topReason)}</dd><dt>Acompanhamento</dt><dd>${metrics.open} demanda(s) em aberto nesta consulta.</dd></dl></section></div><details class="reports-module-summary"><summary>Cadastros por módulo e alertas técnicos</summary><div class="report-grid">${reportTable('Cadastros por módulo', report.modules.filter(item => isModuleEnabled(item.resource)).map(item => ({ label: modules[item.resource]?.name || item.resource, total: item.total })))}${reportTable('Alertas técnicos', report.alerts.map(item => ({ label: `${item.item} · ${item.avaliacao}`, total: 1 })))}</div><p>Exporte o CSV para conectar os dados consolidados e detalhados ao Power BI.</p></details>`;
}

function reportsFilters(demand, generatedAt) {
  return `<details class="reports-filter-panel" open><summary>Filtros do relatório <span>Mostrar / ocultar</span></summary>${demandReportFilters(demand)}<p class="reports-updated">${generatedAt ? `Consulta gerada em ${esc(formatDate(generatedAt))}` : 'Selecione os critérios e atualize a consulta.'}</p></details>`;
}

function reportRecentPeriod(days, timestamp = new Date()) {
  const end = new Date(timestamp);
  const start = new Date(timestamp);
  start.setDate(start.getDate() - days + 1);
  const date = value => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  return { start: date(start), end: date(end) };
}

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action="report-recent-period"]');
  if (!control || state.page !== 'relatorios' || state.loading) return;
  const days = Number(control.dataset.days);
  if (![7, 30, 90].includes(days)) return;
  const period = reportRecentPeriod(days);
  state.demandReportStart = period.start;
  state.demandReportEnd = period.end;
  applyDemandReportFilters();
});
