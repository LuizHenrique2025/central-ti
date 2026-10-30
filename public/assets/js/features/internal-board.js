function internalStageTone(status) {
  const tone = demandStatusTone(status);
  if (tone === 'tone-open') return 'open';
  if (tone === 'tone-progress') return 'progress';
  if (tone === 'tone-completed') return 'completed';
  return normalizeDemandText(status).includes('administr') ? 'neutral' : 'other';
}

function internalDemandCard(card) {
  const sla = hospitalSla(card);
  const priority = { crítica: 'critical', alta: 'high', média: 'medium', baixa: 'low' }[String(card.prioridade || '').toLocaleLowerCase('pt-BR')] || 'medium';
  const initials = String(card.solicitante || '?').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toLocaleUpperCase('pt-BR');
  const slaLabel = sla.kind === 'danger' ? `SLA ${formatSla(card.prazoSla)} · vencido` : sla.text;
  return `<article class="demand-card internal-card priority-${priority}" ${canUpdate('demandas') ? `draggable="true" data-drag-demand-id="${esc(card.id)}"` : ''}><button type="button" class="internal-card-open" data-action="demand-details" data-demand-id="${esc(card.id)}" aria-label="Abrir ${esc(card.ticket || 'demanda')}: ${esc(card.titulo)}"><span class="internal-card-top"><span class="internal-ticket">${esc(card.ticket || 'Demanda')}</span><span class="internal-priority">${esc(card.prioridade || 'Média')}</span></span><span class="internal-card-title">${esc(hospitalSentenceCase(card.titulo))}</span><span class="internal-card-meta">${hospitalIcon('material')}<span>${esc(canonicalDemandCategory(card.categoria) || 'Sem categoria')} · ${esc(card.tecnicoResponsavel || 'Sem responsável')}</span></span><span class="internal-card-requester">${hospitalIcon('user')}<span class="internal-avatar" aria-hidden="true">${esc(initials)}</span><span title="${esc(card.solicitante)}">${esc(card.solicitante || 'Não informado')}</span></span><span class="hospital-sla internal-card-sla sla-${sla.kind}" title="${esc(sla.hint)}">${hospitalIcon(sla.icon)}<span>${esc(slaLabel)}</span></span></button><footer class="internal-card-actions${String(card.status || '').length > 13 ? ' internal-long-status' : ''}">${demandCardControl(card)}</footer></article>`;
}

function internalBoardColumns(cards) {
  return state.statuses.map(status => {
    const statusCards = cards.filter(card => card.status === status);
    return { status, cards: statusCards, total: state.hospitalSlaFilter ? statusCards.length : state.demandPagination?.totals[status] ?? statusCards.length };
  });
}

function internalFlow(columns) {
  const total = columns.reduce((sum, column) => sum + column.total, 0);
  return `<div class="internal-flow" role="group" aria-label="Distribuição por etapa, ${total} demandas"><span class="internal-control-label">Fluxo</span><div class="internal-flow-track" aria-hidden="true">${columns.filter(column => column.total).map(column => `<span class="internal-stage-${internalStageTone(column.status)}" style="flex-grow:${column.total}"></span>`).join('')}</div><div class="internal-flow-legend">${columns.map(column => `<span><i class="internal-stage-${internalStageTone(column.status)}" aria-hidden="true"></i>${esc(canonicalDemandStatus(column.status))}<b>${column.total}</b></span>`).join('')}</div></div>`;
}

function internalFilters(records, columns) {
  const total = columns.reduce((sum, column) => sum + column.total, 0);
  const priorities = [['', 'Todas', 'all'], ['Crítica', 'Crítica', 'critical'], ['Alta', 'Alta', 'high'], ['Média', 'Média', 'medium'], ['Baixa', 'Baixa', 'low']];
  return `<section class="internal-filter-panel" aria-label="Filtros de demandas internas"><div class="hospital-filterbar internal-filterbar"><label class="hospital-search"><span class="hospital-filter-label internal-search-label">Buscar demandas</span><span>${hospitalIcon('search')}<input class="search" aria-label="Pesquisar demandas" value="${esc(state.query)}" data-action="search" placeholder="Pesquisar por ticket, demanda ou solicitante"/><kbd aria-hidden="true">/</kbd></span></label><label class="hospital-filter-field"><span class="hospital-filter-label">Solicitante</span>${demandRequesterFilter(records)}</label><label class="hospital-filter-field"><span class="hospital-filter-label">Responsável</span>${demandAssigneeFilter(records)}</label>${hospitalPeriodFilter()}<button type="button" class="internal-clear" data-action="hospital-internal-clear">Limpar</button><div class="internal-view-switch" role="group" aria-label="Visualização do quadro">${[['kanban', 'Kanban', 'internal'], ['list', 'Lista', 'report']].map(([view, label, icon]) => `<button type="button" data-action="hospital-internal-view" data-view="${view}" aria-pressed="${(state.internalBoardView || 'kanban') === view}">${hospitalIcon(icon)}${label}</button>`).join('')}</div></div><div class="internal-priority-row"><div class="internal-priorities" role="group" aria-label="Filtrar por prioridade"><span class="internal-control-label">Prioridade</span>${priorities.map(([value, label, tone]) => `<button type="button" class="priority-${tone}" data-action="hospital-internal-priority" data-priority="${value}" aria-pressed="${(state.internalPriority || '') === value}">${value ? '<i aria-hidden="true"></i>' : ''}${label}</button>`).join('')}</div><span class="internal-result-count">${total} demanda(s) no quadro</span></div>${internalFlow(columns)}</section>`;
}

function internalDemandBoard() {
  const records = state.records.filter(record => (record.tipo || 'interna') === 'interna');
  const baseCards = records.filter(matchesDemandFilters).filter(card => !state.internalPriority || normalizeDemandText(card.prioridade) === normalizeDemandText(state.internalPriority));
  const cards = baseCards.filter(card => hospitalSlaMatches(card, state.hospitalSlaFilter));
  const columns = internalBoardColumns(cards);
  const list = state.internalBoardView === 'list';
  const controls = `${canUpdate('demandas') ? `<button type="button" class="hospital-manage-status" data-action="status-manager" aria-label="Gerenciar status">${hospitalIcon('settings')}<span>Gerenciar status</span></button>` : ''}${canCreate('demandas') ? `<button type="button" class="hospital-add-demand" data-action="open-demand" data-demand-type="interna">${hospitalIcon('plus')}<span>Abrir chamado</span></button>` : ''}`;
  return `<div class="topbar hospital-topbar internal-topbar"><div class="page-heading"><p class="internal-eyebrow">T.I. · Atividades internas da equipe</p><h1 class="page-title">Demandas Internas</h1></div><button class="mobile-navigation-trigger" type="button" data-action="open-mobile-navigation" aria-label="Abrir menu" aria-controls="primary-navigation" aria-expanded="${mobileNavigationOpen}"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button><div class="hospital-heading-actions">${controls}<span class="hospital-theme-slot"></span></div></div><div class="internal-context">${hospitalQuickFilters(baseCards)}<p>Os chamados abertos pela equipe, organizados por etapa do atendimento.</p></div>${internalFilters(records, columns)}<div class="kanban hospital-kanban internal-kanban${list ? ' internal-list-view' : ''}" role="region" aria-label="Quadro de demandas internas" style="--internal-columns:${Math.max(columns.length, 1)}">${columns.map(column => `<section class="kanban-column hospital-column internal-column" data-drop-status="${esc(column.status)}" aria-label="Coluna ${esc(canonicalDemandStatus(column.status))}, ${column.total} demandas"><header class="hospital-column-heading"><span class="kanban-dot internal-stage-${internalStageTone(column.status)}"></span><h2>${esc(canonicalDemandStatus(column.status))}</h2><small>${column.total}</small></header><div class="kanban-cards hospital-column-cards">${visibleDemandCards(column.cards).map(internalDemandCard).join('') || '<div class="hospital-column-empty">Nenhuma demanda neste status com os filtros atuais.</div>'}${hospitalMoreButton(column.cards)}</div></section>`).join('')}</div>`;
}
