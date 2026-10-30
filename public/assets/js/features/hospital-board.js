function hospitalIcon(name) {
  const paths = {
    search: '<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 4.5 4.5"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 11h18"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    settings: '<path d="M4 7h16M4 17h16"/><circle cx="8" cy="7" r="3"/><circle cx="16" cy="17" r="3"/>',
    plus: '<path d="M12 4v16M4 12h16"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/>',
    moon: '<path d="M20 15.5A8.5 8.5 0 0 1 8.5 4 8.5 8.5 0 1 0 20 15.5Z"/>',
    dashboard: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="4" rx="1"/><rect x="14" y="11" width="7" height="10" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
    report: '<path d="M5 3h10l4 4v14H5zM14 3v5h5M8 12h8m-8 4h6"/>',
    internal: '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8m-4-4v4M7 8h4m-4 4h8"/>',
    hospital: '<path d="M5 21V5h14v16M9 21v-5h6v5M12 7v6m-3-3h6"/>',
    program: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18m-14 5 2 2-2 2m5 0h4"/>',
    material: '<path d="m3 7 9-4 9 4v11l-9 4-9-4zM3 7l9 4 9-4M12 11v11m-5-17 10 4"/>',
    phone: '<path d="M7 3H4a1 1 0 0 0-1 1c0 9 8 17 17 17a1 1 0 0 0 1-1v-3l-5-2-2 2a15 15 0 0 1-7-7l2-2z"/>',
    wifi: '<path d="M3 8a14 14 0 0 1 18 0M6 12a9 9 0 0 1 12 0m-9 4a4.5 4.5 0 0 1 6 0"/><circle cx="12" cy="20" r=".75"/>',
    asset: '<path d="m4 7 8-4 8 4v10l-8 4-8-4zM4 7l8 4 8-4m-8 4v10"/>',
    users: '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m1-16a3 3 0 0 1 0 6m3 10v-3a6 6 0 0 0-2-4"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
    user: '<circle cx="12" cy="8" r="3"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>'
  };
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.internal}</svg>`;
}

function navigationIcon(id) {
  const names = { dashboard: 'dashboard', relatorios: 'report', 'demandas-internas': 'internal', 'demandas-externas': 'hospital', programas: 'program', pedidos: 'material', ramais: 'phone', redes: 'wifi', patrimonio: 'asset', usuarios: 'users', email: 'mail', localizacao: 'search' };
  return hospitalIcon(names[id] || 'internal');
}

function hospitalSentenceCase(value) {
  const text = String(value || '').trim();
  if (!text || text !== text.toLocaleUpperCase('pt-BR')) return text;
  const lower = text.toLocaleLowerCase('pt-BR');
  return lower.charAt(0).toLocaleUpperCase('pt-BR') + lower.slice(1);
}

function hospitalSla(card, timestamp = Date.now()) {
  if (isCompletedDemand(card)) return { kind: 'ok', icon: 'check', text: 'Concluída', hint: 'Demanda concluída. O cumprimento do prazo não é inferido sem data de conclusão.' };
  const due = new Date(card.prazoSla || '');
  if (Number.isNaN(due.getTime())) return { kind: 'neutral', icon: 'clock', text: 'Sem SLA', hint: 'Prazo não informado' };
  const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(due);
  if (due.getTime() < timestamp) return { kind: 'danger', icon: 'clock', text: `Venceu ${day}`, hint: `SLA vencido em ${formatSla(card.prazoSla)}` };
  if (due.getTime() <= timestamp + 86400000) {
    const today = new Date(timestamp);
    const tomorrow = new Date(timestamp); tomorrow.setDate(tomorrow.getDate() + 1);
    const prefix = due.toDateString() === today.toDateString() ? 'Hoje' : due.toDateString() === tomorrow.toDateString() ? 'Amanhã' : day;
    return { kind: 'warning', icon: 'clock', text: `${prefix}, ${new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(due)}`, hint: `SLA vence em ${formatSla(card.prazoSla)}` };
  }
  return { kind: 'neutral', icon: 'clock', text: `Até ${day}`, hint: `SLA em ${formatSla(card.prazoSla)}` };
}

function hospitalSlaMatches(card, filter, timestamp = Date.now()) {
  if (!filter) return true;
  if (isCompletedDemand(card)) return false;
  const due = demandSlaTime(card);
  if (filter === 'overdue') return due !== null && due < timestamp;
  if (filter === 'soon') return due !== null && due >= timestamp && due <= timestamp + 86400000;
  return filter === 'unassigned' && !String(card.tecnicoResponsavel || '').trim();
}

function hospitalCard(card) {
  const sla = hospitalSla(card);
  const priority = { crítica: 'critical', alta: 'high', média: 'medium', baixa: 'low' }[String(card.prioridade || '').toLocaleLowerCase('pt-BR')] || 'medium';
  const initials = String(card.solicitante || '?').trim().split(/\s+/).slice(0, 2).map(part => part.charAt(0)).join('').toLocaleUpperCase('pt-BR');
  const actions = canUpdate('demandas') ? `<details class="hospital-card-menu"><summary aria-label="Ações de ${esc(card.ticket || card.titulo)}">${hospitalIcon('more')}</summary><div class="hospital-status-menu" role="group" aria-label="Mover demanda para outro status"><span>Mover para</span>${state.statuses.map(status => `<button type="button" data-action="hospital-move-status" data-demand-id="${esc(card.id)}" data-status="${esc(status)}" ${status === card.status ? 'disabled' : ''}>${esc(canonicalDemandStatus(status))}${status === card.status ? hospitalIcon('check') : ''}</button>`).join('')}</div></details>` : '';
  return `<article class="demand-card hospital-card" ${canUpdate('demandas') ? `draggable="true" data-drag-demand-id="${esc(card.id)}"` : ''}><button type="button" class="hospital-card-open" data-action="demand-details" data-demand-id="${esc(card.id)}" aria-label="Abrir ${esc(card.ticket || 'demanda')}: ${esc(card.titulo)}"><span class="hospital-card-top"><span class="hospital-ticket">${esc(card.ticket || 'Demanda')}</span><span class="hospital-priority priority-${priority}"><i aria-hidden="true"></i>${esc(card.prioridade || 'Média')}</span></span><span class="hospital-card-title">${esc(hospitalSentenceCase(card.titulo))}</span><span class="hospital-card-meta" title="${esc(`${canonicalDemandCategory(card.categoria) || 'Sem categoria'} · ${card.tecnicoResponsavel || 'Sem responsável'}`)}">${esc(canonicalDemandCategory(card.categoria) || 'Sem categoria')} · ${esc(card.tecnicoResponsavel || 'Sem responsável')}</span><span class="hospital-card-footer"><span class="hospital-requester"><span class="hospital-avatar" aria-hidden="true">${esc(initials)}</span><span class="hospital-requester-name" title="${esc(card.solicitante)}">${esc(card.solicitante || 'Não informado')}</span></span><span class="hospital-sla sla-${sla.kind}" title="${esc(sla.hint)}">${hospitalIcon(sla.icon)}<span>${esc(sla.text)}</span></span></span></button>${actions}</article>`;
}

function hospitalQuickFilters(cards) {
  const timestamp = Date.now();
  return `<div class="hospital-quick-filters" role="group" aria-label="Filtros rápidos de SLA">${[['overdue', 'SLA vencido', 'danger', 'clock'], ['soon', 'Vence em 24 h', 'warning', 'clock'], ['unassigned', 'Sem responsável', 'neutral', 'user']].map(([key, label, kind, icon]) => `<button type="button" class="hospital-quick-filter sla-${kind}" data-action="hospital-sla-filter" data-filter="${key}" aria-pressed="${state.hospitalSlaFilter === key}">${hospitalIcon(icon)}<span>${label}</span><b>${cards.filter(card => hospitalSlaMatches(card, key, timestamp)).length}</b></button>`).join('')}</div>`;
}

function hospitalMoreButton(cards) {
  if (!completedMoreButton(cards)) return '';
  const remaining = demandStatusTotal(cards) - Math.min(cards.length, completedVisible);
  if (remaining <= 0) return '';
  return `<button type="button" class="secondary hospital-more-completed" data-action="more-completed" aria-label="Carregar mais demandas concluídas. ${remaining} restantes.">Ver mais <b>${remaining}</b></button>`;
}

function hospitalDate(value) {
  return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(new Date(`${value}T12:00:00`)) : '';
}

function hospitalCalendar() {
  if (!state.hospitalPeriodOpen) return '';
  const month = new Date(`${state.hospitalCalendarMonth}-01T12:00:00`);
  const first = new Date(month); first.setDate(1 - (month.getDay() + 6) % 7);
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(month);
  const today = new Date().toLocaleDateString('sv-SE');
  const focusedDay = state.hospitalPeriodStart?.startsWith(state.hospitalCalendarMonth) ? state.hospitalPeriodStart : today.startsWith(state.hospitalCalendarMonth) ? today : `${state.hospitalCalendarMonth}-01`;
  const days = Array.from({ length: 42 }, (_, index) => {
    const day = new Date(first); day.setDate(day.getDate() + index);
    const value = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    const selected = value === state.hospitalPeriodStart || value === state.hospitalPeriodEnd;
    const between = state.hospitalPeriodStart && state.hospitalPeriodEnd && value > state.hospitalPeriodStart && value < state.hospitalPeriodEnd;
    return `<button type="button" role="gridcell" tabindex="${value === focusedDay ? '0' : '-1'}" class="hospital-calendar-day${day.getMonth() !== month.getMonth() ? ' other-month' : ''}${between ? ' in-range' : ''}" data-action="hospital-pick-date" data-date="${value}" aria-selected="${Boolean(selected)}" aria-label="${esc(new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(day))}" ${value === today ? 'aria-current="date"' : ''}>${day.getDate()}</button>`;
  });
  const rows = Array.from({ length: 6 }, (_, index) => `<div role="row">${days.slice(index * 7, index * 7 + 7).join('')}</div>`).join('');
  return `<section id="hospital-period-popover" class="hospital-period-popover" role="dialog" aria-label="Selecionar período de abertura"><div class="hospital-calendar-header"><button type="button" data-action="hospital-calendar-month" data-offset="-1" aria-label="Mês anterior">${hospitalIcon('chevron')}</button><h2 aria-live="polite">${esc(label)}</h2><button type="button" data-action="hospital-calendar-month" data-offset="1" aria-label="Próximo mês">${hospitalIcon('chevron')}</button></div><p class="hospital-calendar-hint">${state.hospitalPeriodStart && !state.hospitalPeriodEnd ? `Início: ${hospitalDate(state.hospitalPeriodStart)}. Escolha o fim.` : 'Escolha a data inicial e a final.'}</p><div class="hospital-calendar-grid" role="grid" aria-label="${esc(label)}"><div role="row">${['S', 'T', 'Q', 'Q', 'S', 'S', 'D'].map((value, index) => `<span role="columnheader" aria-label="${['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'][index]}">${value}</span>`).join('')}</div>${rows}</div><div class="hospital-calendar-footer"><button type="button" data-action="hospital-clear-period">Limpar período</button><button type="button" data-action="hospital-close-period">Fechar</button></div></section>`;
}

function hospitalPeriodFilter() {
  const start = state.demandCreatedStart || state.demandCreatedDate;
  const end = state.demandCreatedEnd || state.demandCreatedDate;
  const label = start || end ? `${hospitalDate(start) || 'Início'} — ${hospitalDate(end) || 'Hoje'}` : 'Selecionar período';
  return `<div class="hospital-period"><span class="hospital-filter-label" id="hospital-period-label">Data de abertura</span><button type="button" class="hospital-period-trigger" data-action="hospital-toggle-period" aria-labelledby="hospital-period-label hospital-period-value" aria-expanded="${Boolean(state.hospitalPeriodOpen)}" ${state.hospitalPeriodOpen ? 'aria-controls="hospital-period-popover"' : ''} aria-haspopup="dialog">${hospitalIcon('calendar')}<span id="hospital-period-value">${esc(label)}</span>${hospitalIcon('chevron')}</button>${hospitalCalendar()}</div>`;
}

function hospitalDemandBoard() {
  const records = state.records.filter(record => record.tipo === 'externa');
  const baseCards = records.filter(matchesDemandFilters);
  const cards = baseCards.filter(card => hospitalSlaMatches(card, state.hospitalSlaFilter));
  const expanded = state.hospitalExpandedColumns || [];
  const columns = state.statuses.map(status => {
    const statusCards = cards.filter(card => card.status === status);
    const total = state.hospitalSlaFilter ? statusCards.length : state.demandPagination?.totals[status] ?? statusCards.length;
    const collapsed = total === 0 && normalizeDemandText(status) !== 'aberta' && !expanded.includes(status);
    return { status, cards: statusCards, total, collapsed };
  });
  const controls = `${canUpdate('demandas') ? `<button type="button" class="hospital-manage-status" data-action="status-manager" aria-label="Gerenciar status">${hospitalIcon('settings')}<span>Gerenciar status</span></button>` : ''}${canCreate('demandas') ? `<button type="button" class="hospital-add-demand" data-action="open-demand" data-demand-type="externa">${hospitalIcon('plus')}<span>Abrir chamado</span></button>` : ''}`;
  return `<div class="topbar hospital-topbar"><div class="page-heading"><h1 class="page-title">Demandas Hospital</h1><p>Atendimento e solicitações dos setores</p></div><button class="mobile-navigation-trigger" type="button" data-action="open-mobile-navigation" aria-label="Abrir menu" aria-controls="primary-navigation" aria-expanded="${mobileNavigationOpen}"><span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span></button><div class="hospital-heading-actions">${controls}<span class="hospital-theme-slot"></span></div></div><div class="hospital-filterbar"><label class="hospital-search"><span class="hospital-filter-label">Buscar demandas</span><span>${hospitalIcon('search')}<input class="search" aria-label="Pesquisar demandas" value="${esc(state.query)}" data-action="search" placeholder="Buscar ticket, demanda ou solicitante"/></span></label><label class="hospital-filter-field"><span class="hospital-filter-label">Solicitante</span>${demandRequesterFilter(records)}</label><label class="hospital-filter-field"><span class="hospital-filter-label">Responsável</span>${demandAssigneeFilter(records)}</label>${hospitalPeriodFilter()}${hospitalQuickFilters(baseCards)}</div><div class="kanban hospital-kanban" role="region" aria-label="Quadro de demandas hospitalares" style="--hospital-columns:${columns.map(column => column.collapsed ? '44px' : 'minmax(0,1fr)').join(' ')}">${columns.map(({ status, cards: statusCards, total, collapsed }) => `<section class="kanban-column hospital-column${collapsed ? ' hospital-column-collapsed' : ''}" data-drop-status="${esc(status)}" aria-label="Coluna ${esc(canonicalDemandStatus(status))}, ${total} demandas">${collapsed ? `<button type="button" class="hospital-column-rail" data-action="hospital-expand-column" data-status="${esc(status)}" aria-expanded="false" aria-label="Expandir coluna ${esc(canonicalDemandStatus(status))}"><span class="kanban-dot ${demandStatusTone(status)}"></span><b>${total}</b><span>${esc(canonicalDemandStatus(status))}</span>${hospitalIcon('chevron')}</button>` : `<header class="hospital-column-heading"><span class="kanban-dot ${demandStatusTone(status)}"></span><h2>${esc(canonicalDemandStatus(status))}</h2><small>${total}</small>${total === 0 && normalizeDemandText(status) !== 'aberta' ? `<button type="button" class="hospital-collapse-column" data-action="hospital-collapse-column" data-status="${esc(status)}" aria-expanded="true" aria-label="Recolher coluna ${esc(canonicalDemandStatus(status))}">${hospitalIcon('chevron')}</button>` : ''}</header><div class="kanban-cards hospital-column-cards">${visibleDemandCards(statusCards).map(hospitalCard).join('') || `<div class="hospital-column-empty">${state.query || state.hospitalSlaFilter || state.demandCreatedStart || state.demandRequester || state.demandAssignee ? 'Nenhuma demanda com estes filtros.' : 'Nenhuma demanda neste status.'}</div>`}${hospitalMoreButton(statusCards)}</div>`}</section>`).join('')}</div>`;
}

function hospitalRenderAndFocus(selector) {
  render({ preserveScroll: true });
  const calendar = document.querySelector('#hospital-period-popover');
  const trigger = document.querySelector('.hospital-period-trigger');
  if (calendar && trigger) {
    const anchor = trigger.getBoundingClientRect();
    const bounds = calendar.getBoundingClientRect();
    calendar.style.left = `${Math.max(12, Math.min(anchor.left, window.innerWidth - bounds.width - 12))}px`;
    calendar.style.top = `${Math.max(12, Math.min(anchor.bottom + 8, window.innerHeight - bounds.height - 12))}px`;
  }
  const target = selector && document.querySelector(selector);
  if (target?.classList.contains('hospital-calendar-day')) {
    document.querySelectorAll('.hospital-calendar-day').forEach(day => { day.tabIndex = -1; });
    target.tabIndex = 0;
  }
  target?.focus();
}

function hospitalClosePeriod(restoreFocus = false) {
  state.hospitalPeriodOpen = false;
  document.querySelector('#hospital-period-popover')?.remove();
  const trigger = document.querySelector('[data-action="hospital-toggle-period"]');
  trigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) trigger?.focus();
}

function hospitalPositionMenu(menu) {
  const popup = menu.querySelector('.hospital-status-menu');
  const anchor = menu.querySelector('summary').getBoundingClientRect();
  const width = Math.min(210, window.innerWidth - 32);
  popup.style.width = `${width}px`;
  popup.style.left = `${Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16))}px`;
  popup.style.top = `${Math.max(12, Math.min(anchor.bottom + 4, window.innerHeight - popup.getBoundingClientRect().height - 12))}px`;
}

document.addEventListener('toggle', event => {
  if (event.target.matches?.('.hospital-card-menu[open]')) hospitalPositionMenu(event.target);
}, true);

document.addEventListener('scroll', event => {
  if (!event.target.closest?.('.hospital-status-menu')) document.querySelectorAll('.hospital-card-menu[open]').forEach(menu => { menu.open = false; });
}, true);

function hospitalHandleAction(control) {
  const action = control.dataset.action;
  if (action === 'hospital-move-status') { if (canUpdate('demandas')) moveDemand(control.dataset.demandId, control.dataset.status); return; }
  if (action === 'hospital-sla-filter') { state.hospitalSlaFilter = state.hospitalSlaFilter === control.dataset.filter ? '' : control.dataset.filter; hospitalRenderAndFocus(`[data-action="hospital-sla-filter"][data-filter="${control.dataset.filter}"]`); return; }
  if (action === 'hospital-expand-column' || action === 'hospital-collapse-column') {
    state.hospitalExpandedColumns = (state.hospitalExpandedColumns || []).filter(value => value !== control.dataset.status);
    if (action === 'hospital-expand-column') state.hospitalExpandedColumns.push(control.dataset.status);
    hospitalRenderAndFocus(action === 'hospital-expand-column' ? '.hospital-collapse-column' : '.hospital-column-rail'); return;
  }
  if (action === 'hospital-toggle-period') {
    if (state.hospitalPeriodOpen) return hospitalClosePeriod(true);
    state.hospitalPeriodOpen = true;
    state.hospitalPeriodStart = state.demandCreatedStart || state.demandCreatedDate || '';
    state.hospitalPeriodEnd = state.demandCreatedEnd || state.demandCreatedDate || '';
    const selected = state.hospitalPeriodStart ? new Date(`${state.hospitalPeriodStart}T12:00:00`) : new Date();
    state.hospitalCalendarMonth = `${selected.getFullYear()}-${String(selected.getMonth() + 1).padStart(2, '0')}`;
    hospitalRenderAndFocus('.hospital-calendar-day[tabindex="0"]'); return;
  }
  if (action === 'hospital-close-period') return hospitalClosePeriod(true);
  if (action === 'hospital-calendar-month') {
    const month = new Date(`${state.hospitalCalendarMonth}-01T12:00:00`); month.setMonth(month.getMonth() + Number(control.dataset.offset));
    state.hospitalCalendarMonth = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
    hospitalRenderAndFocus(`[data-action="hospital-calendar-month"][data-offset="${control.dataset.offset}"]`); return;
  }
  if (action === 'hospital-pick-date') {
    if (!state.hospitalPeriodStart || state.hospitalPeriodEnd) {
      state.hospitalPeriodStart = control.dataset.date; state.hospitalPeriodEnd = '';
      hospitalRenderAndFocus(`.hospital-calendar-day[data-date="${control.dataset.date}"]`); return;
    }
    [state.demandCreatedStart, state.demandCreatedEnd] = [state.hospitalPeriodStart, control.dataset.date].sort();
    state.demandCreatedDate = ''; state.demandDateDraft = ''; state.hospitalPeriodOpen = false;
    return reloadDemandBoard().then(() => document.querySelector('[data-action="hospital-toggle-period"]')?.focus());
  }
  if (action === 'hospital-clear-period') {
    state.demandCreatedStart = ''; state.demandCreatedEnd = ''; state.demandCreatedDate = ''; state.demandDateDraft = ''; state.hospitalPeriodOpen = false;
    return reloadDemandBoard().then(() => document.querySelector('[data-action="hospital-toggle-period"]')?.focus());
  }
}

document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (control?.dataset.action.startsWith('hospital-') && !control.disabled) {
    const result = hospitalHandleAction(control);
    result?.catch(error => toast(error.message));
  }
  if (state.hospitalPeriodOpen && !event.target.closest('.hospital-period')) hospitalClosePeriod();
  document.querySelectorAll('.hospital-card-menu[open]').forEach(menu => { if (!menu.contains(event.target)) menu.open = false; });
});

document.addEventListener('keydown', event => {
  const menu = event.target.closest('.hospital-card-menu');
  if (event.key === 'Escape' && menu?.open) { event.preventDefault(); menu.open = false; menu.querySelector('summary').focus(); return; }
  if (!state.hospitalPeriodOpen) return;
  if (event.key === 'Escape') { event.preventDefault(); hospitalClosePeriod(true); return; }
  const day = event.target.closest('.hospital-calendar-day');
  if (!day) return;
  const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
  const date = new Date(`${day.dataset.date}T12:00:00`);
  if (event.key in offsets) date.setDate(date.getDate() + offsets[event.key]);
  else if (event.key === 'Home') date.setDate(date.getDate() - (date.getDay() + 6) % 7);
  else if (event.key === 'End') date.setDate(date.getDate() + 6 - (date.getDay() + 6) % 7);
  else if (event.key === 'PageUp' || event.key === 'PageDown') {
    const dayOfMonth = date.getDate();
    date.setDate(1); date.setMonth(date.getMonth() + (event.key === 'PageUp' ? -1 : 1));
    date.setDate(Math.min(dayOfMonth, new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()));
  }
  else return;
  event.preventDefault();
  state.hospitalCalendarMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const selected = `${state.hospitalCalendarMonth}-${String(date.getDate()).padStart(2, '0')}`;
  hospitalRenderAndFocus(`.hospital-calendar-day[data-date="${selected}"]`);
});
