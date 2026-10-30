function internalStageTone(status) {
  const tone = demandStatusTone(status);
  if (tone === 'tone-open') return 'open';
  if (tone === 'tone-progress') return 'progress';
  if (tone === 'tone-completed') return 'completed';
  return normalizeDemandText(status).includes('administr') ? 'neutral' : 'other';
}

function internalDemandCard(card) { return hospitalCard(card); }

function internalBoardColumns(cards) {
  return state.statuses.map(status => {
    const statusCards = cards.filter(card => card.status === status);
    const total = state.hospitalSlaFilter ? statusCards.length : state.demandPagination?.totals[status] ?? statusCards.length;
    const collapsed = state.internalBoardView !== 'list' && total === 0 && normalizeDemandText(status) !== 'aberta' && !(state.hospitalExpandedColumns || []).includes(status);
    return { status, cards: statusCards, total, collapsed };
  });
}

function internalFlow(columns) {
  const total = columns.reduce((sum, column) => sum + column.total, 0);
  return `<div class="internal-flow" role="group" aria-label="Distribuição por etapa, ${total} demandas"><span class="internal-control-label">Fluxo</span><div class="internal-flow-track" aria-hidden="true">${columns.filter(column => column.total).map(column => `<span class="internal-stage-${internalStageTone(column.status)}" style="flex-grow:${column.total}"></span>`).join('')}</div><div class="internal-flow-legend">${columns.map(column => `<span><i class="internal-stage-${internalStageTone(column.status)}" aria-hidden="true"></i>${esc(canonicalDemandStatus(column.status))}<b>${column.total}</b></span>`).join('')}</div></div>`;
}

function internalFilters(records, columns, type) {
  const total = columns.reduce((sum, column) => sum + column.total, 0);
  const priorities = [['', 'Todas', 'all'], ['Crítica', 'Crítica', 'critical'], ['Alta', 'Alta', 'high'], ['Média', 'Média', 'medium'], ['Baixa', 'Baixa', 'low']];
  return `<section class="internal-filter-panel" aria-label="Filtros de demandas ${type === 'externa' ? 'hospitalares' : 'internas'}"><div class="hospital-filterbar internal-filterbar"><label class="hospital-search"><span class="hospital-filter-label internal-search-label">Buscar demandas</span><span>${hospitalIcon('search')}<input class="search" aria-label="Pesquisar demandas" value="${esc(state.query)}" data-action="search" placeholder="Pesquisar por ticket, demanda ou solicitante"/><kbd aria-hidden="true">/</kbd></span></label><label class="hospital-filter-field"><span class="hospital-filter-label">Solicitante</span>${demandRequesterFilter(records)}</label><label class="hospital-filter-field"><span class="hospital-filter-label">Responsável</span>${demandAssigneeFilter(records)}</label>${hospitalPeriodFilter()}<button type="button" class="internal-clear" data-action="hospital-internal-clear">Limpar</button><div class="internal-view-switch" role="group" aria-label="Visualização do quadro">${[['kanban', 'Kanban', 'internal'], ['list', 'Lista', 'report']].map(([view, label, icon]) => `<button type="button" data-action="hospital-internal-view" data-view="${view}" aria-pressed="${(state.internalBoardView || 'kanban') === view}">${hospitalIcon(icon)}${label}</button>`).join('')}</div></div><div class="internal-priority-row"><div class="internal-priorities" role="group" aria-label="Filtrar por prioridade"><span class="internal-control-label">Prioridade</span>${priorities.map(([value, label, tone]) => `<button type="button" class="priority-${tone}" data-action="hospital-internal-priority" data-priority="${value}" aria-pressed="${(state.internalPriority || '') === value}">${value ? '<i aria-hidden="true"></i>' : ''}${label}</button>`).join('')}</div><span class="internal-result-count">${total} demanda(s) no quadro</span></div>${internalFlow(columns)}</section>`;
}

function internalDemandBoard(type = 'interna') {
  const hospital = type === 'externa';
  const records = state.records.filter(record => (record.tipo || 'interna') === type);
  const baseCards = records.filter(matchesDemandFilters).filter(card => !state.internalPriority || normalizeDemandText(card.prioridade) === normalizeDemandText(state.internalPriority));
  const cards = baseCards.filter(card => hospitalSlaMatches(card, state.hospitalSlaFilter));
  const columns = internalBoardColumns(cards);
  const list = state.internalBoardView === 'list';
  const controls = `${canUpdate('demandas') ? `<button type="button" class="hospital-manage-status" data-action="status-manager" aria-label="Gerenciar status">${hospitalIcon('settings')}<span>Gerenciar status</span></button>` : ''}${canCreate('demandas') ? `<button type="button" class="hospital-add-demand" data-action="open-demand" data-demand-type="${type}">${hospitalIcon('plus')}<span>Abrir chamado</span></button>` : ''}`;
  return `<div class="topbar hospital-topbar internal-topbar"><div class="page-heading"><p class="internal-eyebrow">${hospital ? 'Hospital · Atendimento aos setores' : 'T.I. · Atividades internas da equipe'}</p><h1 class="page-title">Demandas ${hospital ? 'Hospital' : 'Internas'}</h1></div><button class="mobile-navigation-trigger" type="button" data-action="open-mobile-navigation" aria-label="Abrir menu" aria-controls="primary-navigation" aria-expanded="${mobileNavigationOpen}"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button><div class="hospital-heading-actions">${controls}<span class="hospital-theme-slot"></span></div></div><div class="internal-context">${hospitalQuickFilters(baseCards)}<p>${hospital ? 'Os chamados do Hospital, organizados por etapa do atendimento.' : 'Os chamados abertos pela equipe, organizados por etapa do atendimento.'}</p></div>${internalFilters(records, columns, type)}<div class="kanban hospital-kanban internal-kanban${list ? ' internal-list-view' : ''}" role="region" aria-label="Quadro de demandas ${hospital ? 'hospitalares' : 'internas'}" style="--demand-board-columns:${columns.map(column => column.collapsed ? '44px' : 'minmax(280px,1fr)').join(' ')}">${columns.map(column => `<section class="kanban-column hospital-column internal-column${column.collapsed ? ' hospital-column-collapsed' : ''}" data-drop-status="${esc(column.status)}" aria-label="Coluna ${esc(canonicalDemandStatus(column.status))}, ${column.total} demandas">${column.collapsed ? `<button type="button" class="hospital-column-rail" data-action="hospital-expand-column" data-status="${esc(column.status)}" aria-expanded="false" aria-label="Expandir coluna ${esc(canonicalDemandStatus(column.status))}"><span class="kanban-dot internal-stage-${internalStageTone(column.status)}"></span><b>${column.total}</b><span>${esc(canonicalDemandStatus(column.status))}</span>${hospitalIcon('chevron')}</button>` : `<header class="hospital-column-heading"><span class="kanban-dot internal-stage-${internalStageTone(column.status)}"></span><h2>${esc(canonicalDemandStatus(column.status))}</h2><small>${column.total}</small>${!list && column.total === 0 && normalizeDemandText(column.status) !== 'aberta' ? `<button type="button" class="hospital-collapse-column" data-action="hospital-collapse-column" data-status="${esc(column.status)}" aria-expanded="true" aria-label="Recolher coluna ${esc(canonicalDemandStatus(column.status))}">${hospitalIcon('chevron')}</button>` : ''}</header><div class="kanban-cards hospital-column-cards">${visibleDemandCards(column.cards).map(internalDemandCard).join('') || '<div class="hospital-column-empty">Nenhuma demanda neste status com os filtros atuais.</div>'}${hospitalMoreButton(column.cards)}</div>`}</section>`).join('')}</div>`;
}
