const $ = (selector, root = document) => root.querySelector(selector);
const TOKEN = 'central-ti-token';
const escapeAttribute = window.CentralTiSafeRender?.escapeAttribute || (value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char])));
const state = { token: localStorage.getItem(TOKEN), user: null, page: 'dashboard', records: [], users: [], messages: [], unreadMessages: 0, dashboard: null, report: null, reportTab: 'overview', exclusionFilters: {}, statuses: ['Aberta', 'Em andamento', 'Concluída'], computerGroups: ['Geral', 'Faturamento', 'Eletivas', 'Laboratório'], locations: null, query: '', demandAssignee: '', start: '', end: '', networkUrls: [], networkQrUrl: null, modal: null, pending: null, firstAccess: null, loginStep: 'identifier', loginIdentifier: '', loading: false, formDirty: false, newDemandType: null, programStatus: '', programPeriodicity: '', resourceFilters: {}, ramalOrder: 'asc', mailFolder: 'inbox', selectedMessageId: null, selectedMailThreadIds: [], mailQuery: '' };
state.demandReportFilters ||= { assignee: [], requester: [], sector: [], reason: [], category: [], status: [] };
state.demandReportDraft ||= { ...state.demandReportFilters };
state.demandReportColumns ||= { ticket: true, createdAt: true, requester: true, sector: true, reason: true, category: true, assignee: true, status: true };
state.demandReportPage ||= 1;
const mailAttachmentUrls = new Map();
function mountMailScreenshotFields() { document.querySelectorAll('form[onsubmit^="sendMail"]').forEach(form => { if (form.querySelector('[name="screenshot"]')) return; const field = document.createElement('label'); field.className = 'field mail-screenshot-field'; field.innerHTML = '<span>Adicionar print <small>PNG, JPG ou WEBP · até 5 MB · ou cole com Ctrl+V</small></span><input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp"/><small class="mail-screenshot-preview"></small>'; form.querySelector('.modal-actions')?.before(field); field.querySelector('input').addEventListener('change', event => { const file = event.target.files[0], preview = field.querySelector('.mail-screenshot-preview'); preview.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : ''; }); }); }
function mountDemandScreenshotFields() { document.querySelectorAll('form.demand-modal').forEach(form => { if (form.querySelector('[name="demandScreenshot"]')) return; const field = document.createElement('label'); field.className = 'field mail-screenshot-field'; field.innerHTML = '<span>Anexo · adicionar print <small>PNG, JPG ou WEBP · até 5 MB · ou cole com Ctrl+V</small></span><input name="demandScreenshot" type="file" accept="image/png,image/jpeg,image/webp"/><small class="mail-screenshot-preview"></small>'; form.querySelector('.modal-actions')?.before(field); field.querySelector('input').addEventListener('change', event => { const file = event.target.files[0], preview = field.querySelector('.mail-screenshot-preview'); preview.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : ''; }); }); }
function mountDemandCommentScreenshotFields() { document.querySelectorAll('form.ticket-reply').forEach(form => { if (form.querySelector('[name="commentScreenshot"]')) return; const field = document.createElement('label'); field.className = 'field mail-screenshot-field ticket-comment-screenshot-field'; field.innerHTML = '<span>Anexar print <small>PNG, JPG ou WEBP · até 5 MB · ou cole com Ctrl+V</small></span><input name="commentScreenshot" type="file" accept="image/png,image/jpeg,image/webp"/><small class="mail-screenshot-preview"></small>'; form.append(field); field.querySelector('input').addEventListener('change', event => { const file = event.target.files[0], preview = field.querySelector('.mail-screenshot-preview'); preview.textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : ''; }); }); }
function mountDemandAttachmentViewer() { const record = state.modal?.type === 'demand-details' ? state.modal.record : null, target = document.querySelector('.ticket-description'); if (!record?.anexoPrint?.data || !['image/png', 'image/jpeg', 'image/webp'].includes(record.anexoPrint.mime) || !target || document.querySelector('.demand-attachment')) return; const section = document.createElement('section'); section.className = 'demand-attachment'; section.innerHTML = `<h3>Anexo</h3><img class="mail-screenshot" role="button" tabindex="0" onclick="openScreenshot(this.src)" onkeydown="if(event.key==='Enter')openScreenshot(this.src)" alt="Abrir print anexado à demanda" src="data:${record.anexoPrint.mime};base64,${record.anexoPrint.data}"/>`; target.after(section); }
function openScreenshot(src) { document.querySelector('.screenshot-lightbox')?.remove(); const viewer = document.createElement('div'); viewer.className = 'screenshot-lightbox'; viewer.innerHTML = `<button type="button" class="close" aria-label="Fechar print">×</button><img alt="Print ampliado" src="${src}"/>`; viewer.addEventListener('click', event => { if (event.target === viewer || event.target.matches('.close')) viewer.remove(); }); document.body.append(viewer); }
async function loadMailAttachment(messageId, target) { if (!target || target.dataset.loading === 'true') return; target.dataset.loading = 'true'; try { let src = mailAttachmentUrls.get(messageId); if (!src) { const response = await fetch(`/api/messages/${messageId}/attachment`, { headers: { authorization: `Bearer ${state.token}` } }); if (!response.ok) throw new Error(); src = URL.createObjectURL(await response.blob()); mailAttachmentUrls.set(messageId, src); } target.innerHTML = `<img class="mail-screenshot" role="button" tabindex="0" onclick="openScreenshot(this.src)" onkeydown="if(event.key==='Enter')openScreenshot(this.src)" alt="Abrir print anexado à mensagem" src="${src}"/>`; } catch { target.textContent = 'Não foi possível carregar o print.'; target.classList.add('attachment-error'); } }
function mountMailAttachmentPreviews() { document.querySelectorAll('[data-mail-attachment]').forEach(target => loadMailAttachment(target.dataset.mailAttachment, target)); }
function enableScreenshotPaste() { document.querySelectorAll('form[onsubmit^="sendMail"],form.demand-modal,form.ticket-reply').forEach(form => { if (form.dataset.screenshotPaste) return; const input = form.querySelector('[name="screenshot"],[name="demandScreenshot"],[name="commentScreenshot"]'); if (!input) return; form.dataset.screenshotPaste = 'true'; form.addEventListener('paste', event => { const file = [...(event.clipboardData?.files || [])].find(item => item.type.startsWith('image/')); if (!file) return; if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 5_000_000) return toast('Cole somente um print PNG, JPG ou WEBP de até 5 MB.'); const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change')); event.preventDefault(); toast('Print colado no anexo.'); }); }); }
function enhanceCurrentSurface() { mountMailScreenshotFields(); mountDemandScreenshotFields(); mountDemandCommentScreenshotFields(); mountDemandAttachmentViewer(); mountMailAttachmentPreviews(); enableScreenshotPaste(); }
let navigationRequest = 0;
let closingModal = false;
let pendingAction = null;
let knownUnreadMessageIds = null;
let sidebarCollapsed = localStorage.getItem('central-ti-sidebar-collapsed') === 'true';
let colorTheme = localStorage.getItem('central-ti-theme') === 'light' ? 'light' : 'dark';
const esc = escapeAttribute;
const formatDate = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const formatSla = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';
const formatCurrency = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
function formatCurrencyInput(input) { const digits = input.value.replace(/\D/g, ''); input.value = digits ? formatCurrency(Number(digits)) : ''; }
function pendingLabel(control) {
  const label = String(control?.textContent || '').trim().toLowerCase();
  if (/export|csv|excel/.test(label)) return 'Exportando…';
  if (/enviar|responder|publicar/.test(label)) return 'Enviando…';
  if (/redefinir/.test(label)) return 'Redefinindo…';
  if (/criar|abrir|incluir/.test(label)) return 'Criando…';
  if (/remover|excluir|apagar/.test(label)) return 'Removendo…';
  if (/atribuir|assumir/.test(label)) return 'Atribuindo…';
  return 'Salvando…';
}
function beginPendingAction(control, options = {}) {
  if (!(control instanceof HTMLButtonElement) || control.disabled || pendingAction) return null;
  const originalHtml = control.innerHTML;
  const originalBusy = control.getAttribute('aria-busy');
  const label = options.label || pendingLabel(control);
  control.disabled = true;
  control.classList.add('action-pending');
  control.setAttribute('aria-busy', 'true');
  control.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span aria-live="polite">' + esc(label) + '</span>';
  pendingAction = { control, originalHtml, originalBusy, form: Boolean(options.form) };
  return pendingAction;
}
function releasePendingAction() {
  if (!pendingAction) return;
  const { control, originalHtml, originalBusy } = pendingAction;
  pendingAction = null;
  if (!control.isConnected) return;
  control.disabled = false;
  control.classList.remove('action-pending');
  control.innerHTML = originalHtml;
  if (originalBusy === null) control.removeAttribute('aria-busy');
  else control.setAttribute('aria-busy', originalBusy);
}
document.addEventListener('submit', event => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement) || event.defaultPrevented) return;
  beginPendingAction(event.submitter || form.querySelector('button[type="submit"], button:not([type])'), { form: true });
}, true);

// Eventos de telas dinâmicas são delegados por atributos de dados. Nunca
// interpolamos valores cadastrados como código JavaScript em atributos HTML.
document.addEventListener('click', event => {
  const control = event.target.closest('[data-action]');
  if (!control || control.disabled) return;
  switch (control.dataset.action) {
    case 'go': return go(control.dataset.page);
    case 'logout': return logout();
    case 'search': return control.matches('button') ? setSearch(control.dataset.searchTerm || '') : undefined;
    case 'demand-details': return openDemandDetails(control.dataset.demandId);
    case 'status-manager': return openStatusManager();
    case 'open-record': return openRecord(control.dataset.resource, control.dataset.recordId || '');
    case 'open-demand': return openDemand(control.dataset.demandType);
    case 'network-qr': return openNetworkQr(control.dataset.networkId);
    default: return undefined;
  }
});

document.addEventListener('input', event => {
  if (event.target.matches('[data-action="search"]')) setSearch(event.target.value);
});

document.addEventListener('change', event => {
  if (event.target.matches('[data-action="move-demand"]')) moveDemand(event.target.dataset.demandId, event.target.value);
  if (event.target.matches('[data-action="demand-assignee-filter"]')) setDemandAssignee(event.target.value);
});

document.addEventListener('dragstart', event => {
  const card = event.target.closest('[data-drag-demand-id]');
  if (card) dragDemand(event, card.dataset.dragDemandId);
});

document.addEventListener('dragover', event => {
  if (event.target.closest('[data-drop-status]')) event.preventDefault();
});

document.addEventListener('drop', event => {
  const column = event.target.closest('[data-drop-status]');
  if (column) dropDemand(event, column.dataset.dropStatus);
});
const role = value => ({ admin: 'Administrador', ti: 'Equipe de TI', recepcao: 'Recepção', consulta: 'Consulta' })[value] || value;
const permission = (resource, action) => { if (state.user?.perfil === 'admin') return true; const permissions = state.user?.permissions; const value = permissions?.[resource]; if (value) { const legacyRead = value.read !== false; return Boolean(value[action] ?? (action === 'list' || action === 'consult' ? legacyRead : action === 'create' || action === 'update' ? value.write : false)); } if (permissions && Object.keys(permissions).length) return false; return state.user?.perfil === 'ti' || (state.user?.perfil === 'consulta' && (action === 'list' || action === 'consult')); };
const canWrite = resource => permission(resource, 'create') || permission(resource, 'update');
const canRead = resource => permission(resource, 'list');
const canDelete = resource => permission(resource, 'delete');
const canCreate = resource => permission(resource, 'create');
const canUpdate = resource => permission(resource, 'update');
async function api(url, options = {}) {
  const tracksPendingAction = options.method && options.method !== 'GET';
  if (tracksPendingAction && !pendingAction) beginPendingAction(document.activeElement);
  try {
    const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
    if (tracksPendingAction && pendingAction && !pendingAction.form) releasePendingAction();
    return data;
  } catch (error) {
    if (tracksPendingAction) releasePendingAction();
    throw error;
  }
}
function tag(value) { const text = String(value || ''), normalized = text.toLowerCase(); const kind = /(bom|ativo|online|operacional|concluída|disponível|em uso)/.test(normalized) ? 'success' : /(ruim|manutenção|média|andamento|renovação)/.test(normalized) ? 'warning' : /(troca|crítica|alta|offline|indisponível|baixado|cancelado)/.test(normalized) ? 'danger' : ''; return `<span class="tag ${kind}">${esc(text)}</span>`; }
function demandCardControl(card) {
  if (!canUpdate('demandas')) return '';
  if (!card.tecnicoResponsavel) return `<button class="card-details" data-action="demand-details" data-demand-id="${esc(card.id)}">Ver detalhes</button>`;
  return `<select data-action="move-demand" data-demand-id="${esc(card.id)}">${state.statuses.map(option => `<option ${option === card.status ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
}
function nav(id, label, icon, count = 0) { return `<button class="${state.page === id ? 'active' : ''}" data-action="go" data-page="${esc(id)}"><span class="nav-icon">${icon}</span><span class="label">${label}</span>${count ? `<b class="nav-badge" style="margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:grid;place-items:center;background:#ef5a62;color:#fff;font-size:10px;line-height:1">${count > 99 ? '99+' : count}</b>` : ''}</button>`; }
function sidebar() { const links = Object.entries(modules).filter(([id]) => id !== 'demandas' && id !== 'computadores' && isModuleEnabled(id) && canRead(id)).map(([id, module]) => nav(id, module.name, module.icon)).join(''); const demandLinks = canRead('demandas') ? (state.user?.perfil === 'admin' ? `${nav('demandas-internas', 'Demandas Internas (T.I.)', '✓')}${nav('demandas-externas', 'Demandas Hospital', '✓')}` : nav('demandas-externas', 'Demandas Hospital', '✓')) : ''; return `<aside class="sidebar"><div class="brand-lockup"><div class="brand-mark">✦</div><span>Central TI</span></div><nav class="nav"><div class="nav-section">PAINEL</div>${nav('dashboard', 'Visão geral', '⌘')}${state.user?.perfil === 'admin' ? nav('relatorios', 'Relatórios', '▤') : ''}${canRead('equipamentos') ? nav('localizacao', 'Localizar equipamentos', '⌖') : ''}<div class="nav-section">GESTÃO</div>${demandLinks}${links}${state.user.perfil === 'admin' ? `<div class="nav-section">ACESSOS</div>${nav('usuarios', 'Usuários', '♙')}` : ''}<div class="nav-section">COMUNICAÇÃO</div>${nav('email', 'E-mail interno', '✉', state.unreadMessages)}</nav><div class="user-box"><div class="avatar">${esc(state.user.nome.slice(0, 2).toUpperCase())}</div><div><div class="user-name">${esc(state.user.nome)}</div><div class="user-role">${esc(role(state.user.perfil))}</div></div><button class="logout" data-action="logout">↪</button></div></aside>`; }
function header(title, subtitle) { return `<div class="topbar"><div><div class="eyebrow">${esc(subtitle || 'Central TI')}</div><h1 class="page-title">${esc(title)}</h1></div></div>`; }
function dashboard() { const d = state.dashboard || { notifications: [], announcements: [], activeCount: 0, openDemands: 0, inbox: 0 }, notifications = d.notifications || []; return `${header('Visão geral', `Olá, ${state.user.nome}`)}<section class="metrics">${[['Ativos cadastrados', d.activeCount, '▣'], ['Demandas abertas', d.openDemands, '✓'], ['Alertas técnicos', notifications.length, '⚠'], ['Mensagens não lidas', d.inbox, '✉']].map(item => `<div class="metric"><div class="metric-head"><div class="metric-name">${item[0]}</div><div class="metric-icon">${item[2]}</div></div><div class="metric-number">${item[1]}</div></div>`).join('')}</section>${notifications.length ? `<section class="dashboard-grid"><div class="panel"><div class="panel-heading"><div><h3>Notificações técnicas</h3><div class="panel-subtitle">Itens que exigem atenção</div></div></div><div class="demand-list">${notifications.map(note => `<div class="demand"><span class="status ${note.avaliacao === 'Troca necessária' ? 'critical' : 'wait'}"></span><div><div class="demand-title">${esc(note.titulo)} · ${tag(note.avaliacao)}</div><div class="demand-meta">${esc(note.detalhe)}</div></div></div>`).join('')}</div></div><div class="panel"><div class="panel-heading"><div><h3>Acesso pela rede</h3><div class="panel-subtitle">Compartilhe com sua equipe</div></div></div><div class="network-box">${state.networkUrls.map(url => `<code>${esc(url)}</code>`).join('') || 'Endereço não identificado.'}<p>Os dados são compartilhados entre todos os usuários da Central TI.</p></div></div></section>` : ''}<section class="panel announcements"><div class="panel-heading"><div><h3>Comunicados da T.I.</h3><div class="panel-subtitle">Informações importantes para todos os usuários</div></div>${state.user?.perfil === 'admin' ? '<button class="add-record" onclick="openAnnouncement()">+ Comunicado</button>' : ''}</div><div class="announcement-list">${(d.announcements || []).map(item => `<article class="announcement"><div><h4>${esc(item.title)}</h4><p>${esc(item.body).replace(/\n/g, '<br/>')}</p><small>Por ${esc(item.authorName)} · ${formatDate(item.createdAt)}</small></div>${state.user?.perfil === 'admin' ? `<button class="danger-link" onclick="deleteAnnouncement('${item.id}')">Remover</button>` : ''}</article>`).join('') || '<div class="empty">Nenhum comunicado publicado.</div>'}</div></section>`; }
function locationPage() { const data = state.locations || { groups: [], records: [] }; const records = data.records.filter(record => Object.values(record).join(' ').toLowerCase().includes(state.query.toLowerCase())); return `${header('Localizar equipamentos', 'Busca por IP, patrimônio, subgrupo ou setor')}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" data-action="search" placeholder="Ex.: 192.168.2.25, PC-0048 ou Computador"/></div><section class="location-groups">${data.groups.map(item => `<button data-action="search" data-search-term="${esc(item.group)}"><b>${esc(item.group)}</b><span>${item.total} item(ns)</span></button>`).join('')}</section><div class="panel table-panel">${records.length ? `<table class="data-table"><thead><tr><th>Patrimônio</th><th>IP</th><th>Subgrupo</th><th>Localização</th><th>Responsável</th><th>Status</th></tr></thead><tbody>${records.map(record => `<tr><td><b>${esc(record.patrimonio)}</b></td><td><code>${esc(record.ip)}</code></td><td>${tag(record.grupo)}</td><td>${esc(record.localizacao)}</td><td>${esc(record.responsavel)}</td><td>${tag(record.status)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum equipamento encontrado.</div>'}</div>`; }
function matchesDemandSearch(record) { const query = normalizeDemandText(state.query); if (!query) return true; return [record.ticket, record.titulo, record.solicitante, record.categoria, record.assunto, record.tecnicoResponsavel, record.empresa].some(value => normalizeDemandText(value).includes(query)); }
function matchesDemandAssignee(record) { const selected = state.demandAssignee, assignee = String(record.tecnicoResponsavel || '').trim(); if (!selected) return true; if (selected === '__mine__') return normalizeDemandText(assignee) === normalizeDemandText(state.user?.nome); if (selected === '__unassigned__') return !assignee; return assignee === selected; }
function demandAssigneeFilter(records) { const assignees = [...new Set(records.map(record => String(record.tecnicoResponsavel || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')); const mineCount = records.filter(record => normalizeDemandText(record.tecnicoResponsavel) === normalizeDemandText(state.user?.nome)).length; const unassignedCount = records.filter(record => !String(record.tecnicoResponsavel || '').trim()).length; return `<select data-action="demand-assignee-filter" aria-label="Filtrar demandas por responsável"><option value="">Todos os responsáveis</option><option value="__mine__" ${state.demandAssignee === '__mine__' ? 'selected' : ''}>Minhas demandas (${mineCount})</option>${unassignedCount ? `<option value="__unassigned__" ${state.demandAssignee === '__unassigned__' ? 'selected' : ''}>Não assumidas (${unassignedCount})</option>` : ''}${assignees.map(name => `<option value="${esc(name)}" ${state.demandAssignee === name ? 'selected' : ''}>${esc(name)}</option>`).join('')}</select>`; }
function canonicalDemandStatus(status) { return String(status || '').trim() === 'Concluida' ? 'Concluída' : status; }
function canonicalDemandCategory(category) { return String(category || '').trim() === 'Outro' ? 'Outros' : category; }
function demandBoard() { const cards = state.records.filter(record => matchesDemandSearch(record) && matchesDemandAssignee(record)); return `${header('Demandas', 'Quadro de trabalho')}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" data-action="search" placeholder="Pesquisar por ticket, demanda ou solicitante..."/>${demandAssigneeFilter(state.records)}<div class="toolbar-actions">${canWrite('demandas') ? `<button class="secondary" data-action="status-manager">⚙ Status</button><button class="add-record" data-action="open-record" data-resource="demandas">+ Abrir chamado</button>` : ''}</div></div><div class="kanban">${state.statuses.map((status, index) => `<section class="kanban-column" data-drop-status="${esc(status)}"><header><span class="kanban-dot dot-${index % 4}"></span><b>${esc(status)}</b><small>${cards.filter(card => canonicalDemandStatus(card.status) === status).length}</small></header><div class="kanban-cards">${cards.filter(card => canonicalDemandStatus(card.status) === status).map(card => `<article class="demand-card" draggable="true" data-action="demand-details" data-demand-id="${esc(card.id)}" data-drag-demand-id="${esc(card.id)}"><div class="demand-card-title">${esc(card.titulo)}</div><div class="demand-card-meta">${esc(card.solicitante)}</div><div class="demand-card-bottom">${tag(card.prioridade)}${demandCardControl(card)}</div></article>`).join('') || '<div class="kanban-empty">Arraste uma demanda para cá</div>'}</div></section>`).join('')}</div>`; }
function filteredDemandBoard(type) {
  const external = type === 'externa';
  const records = state.records.filter(record => (record.tipo || 'interna') === type);
  const cards = records.filter(record => matchesDemandSearch(record) && matchesDemandAssignee(record));
  const title = external ? 'Demandas Hospital' : 'Demandas Internas';
  const subtitle = external ? 'Hospital · solicitações de setores externos' : 'T.I. · atividades internas da equipe';
  return `${header(title, subtitle)}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" data-action="search" placeholder="Pesquisar por ticket, demanda ou solicitante..."/>${demandAssigneeFilter(records)}<div class="toolbar-actions">${canUpdate('demandas') ? `<button class="secondary" data-action="status-manager">⚙ Status</button>` : ''}${canCreate('demandas') ? `<button class="add-record" data-action="open-demand" data-demand-type="${esc(type)}">+ Abrir chamado</button>` : ''}</div></div><div class="kanban">${state.statuses.map((status, index) => `<section class="kanban-column" data-drop-status="${esc(status)}"><header><span class="kanban-dot dot-${index % 4}"></span><b>${esc(status)}</b><small>${cards.filter(card => card.status === status).length}</small></header><div class="kanban-cards">${cards.filter(card => card.status === status).map(card => `<article class="demand-card" data-action="demand-details" data-demand-id="${esc(card.id)}" ${canUpdate('demandas') ? `draggable="true" data-drag-demand-id="${esc(card.id)}"` : ''}><div class="demand-card-code">${esc(card.ticket || 'TI')}</div><div class="demand-card-title">${esc(card.titulo)}</div><div class="demand-card-meta">${esc(canonicalDemandCategory(card.categoria) || 'Sem categoria')} · ${esc(card.tecnicoResponsavel || 'Sem técnico')}</div><div class="demand-card-meta">${esc(card.solicitante)}${external ? ` · ${esc(card.empresa || 'Hospital')}` : ''}</div>${card.prazoSla ? `<div class="demand-card-sla">SLA · ${esc(card.prazoSla.split('-').reverse().join('/'))}</div>` : ''}<div class="demand-card-bottom">${tag(card.prioridade)}${demandCardControl(card)}</div></article>`).join('') || '<div class="kanban-empty">Arraste uma demanda para cá</div>'}</div></section>`).join('')}</div>`;
}
function ramalFilterCategory(value) {
  const sector = String(value || '').trim();
  const normalized = normalizeDemandText(sector);
  if (/\bcall\s*center\b/.test(normalized)) return 'Call Center';
  if (/\bfaturamento\b/.test(normalized)) return 'Faturamento';
  return sector;
}
function resourceFilterValues(resource, key, records = state.records) {
  const values = records.map(record => resource === 'ramais' && key === 'setor' ? ramalFilterCategory(record.setor) : record[key]).filter(Boolean);
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
}
function matchesResourceFilter(resource, record, key, selected) {
  if (!selected) return true;
  return resource === 'ramais' && key === 'setor' ? ramalFilterCategory(record.setor) === selected : record[key] === selected;
}
function recordsPage(resource) {
  const module = modules[resource];
  const filters = moduleFilters[resource] || [];
  let rows = state.records.filter(record => Object.values(record).join(' ').toLowerCase().includes(state.query.toLowerCase()) && (resource !== 'programas' || (!state.programStatus || record.status === state.programStatus) && (!state.programPeriodicity || record.periodicidade === state.programPeriodicity)) && filters.every(([key]) => matchesResourceFilter(resource, record, key, state.resourceFilters[`${resource}-${key}`])));
  if (resource === 'ramais') rows = rows.slice().sort((a, b) => { const comparison = Number(String(a.ramal).replace(/\D/g, '')) - Number(String(b.ramal).replace(/\D/g, '')) || String(a.ramal).localeCompare(String(b.ramal), 'pt-BR', { numeric: true }); return state.ramalOrder === 'desc' ? -comparison : comparison; });
  const cell = (record, [key, , source]) => {
    const value = record[key] || '';
    if (source === 'DATE_OPTIONAL' || source === 'DATE_REQUIRED') return value ? esc(value.split('-').reverse().join('/')) : '—';
    if (source === 'CURRENCY') return value ? esc(formatCurrency(value)) : '—';
    return ['status', 'avaliacao', 'condicao', 'situacao'].includes(key) ? tag(value) : esc(value || '—');
  };
  const columns = module.fields.map(field => resource === 'ramais' && field[0] === 'ramal' ? `<th><button type="button" class="table-sort" onclick="toggleRamalOrder()" title="Ordenar ramais ${state.ramalOrder === 'asc' ? 'do maior para o menor' : 'do menor para o maior'}">Ramal <span aria-hidden="true">${state.ramalOrder === 'asc' ? '↑' : '↓'}</span></button></th>` : `<th>${field[1]}</th>`).join('');
  const placeholder = resource === 'ramais' ? 'Pesquisar por ramal, setor, responsável ou e-mail...' : 'Pesquisar por patrimônio, IP, grupo ou responsável...';
  return `${header(module.name, 'Gestão')}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" oninput="setSearch(this.value)" placeholder="${placeholder}"/>${resource === 'programas' ? `<select onchange="setProgramFilter('programStatus',this.value)"><option value="">Todos os status</option>${['Ativo','Em renovação','Cancelado'].map(value => `<option ${state.programStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select onchange="setProgramFilter('programPeriodicity',this.value)"><option value="">Mensal e anual</option>${['Mensal','Anual'].map(value => `<option ${state.programPeriodicity === value ? 'selected' : ''}>${value}</option>`).join('')}</select>` : ''}<div class="toolbar-actions"><button class="secondary" onclick="exportResource('${resource}')">⇩ Exportar CSV</button>${resource === 'computadores' && canUpdate(resource) ? `<button class="secondary" onclick="openGroupManager()">⚙ Grupos</button>` : ''}${canCreate(resource) ? `<button class="add-record" onclick="openRecord('${resource}')">+ Novo cadastro</button>` : ''}</div></div><div class="panel table-panel">${rows.length ? `<table class="data-table"><thead><tr>${columns}${resource === 'computadores' ? '<th>Checklist</th>' : ''}<th>Ações</th></tr></thead><tbody>${rows.map(record => `<tr>${module.fields.map(field => `<td>${cell(record, field)}</td>`).join('')}${resource === 'computadores' ? `<td>${record.checklist?.length ? `✓ ${record.checklist.length}/${KIT.length}` : '—'}</td>` : ''}<td>${resource === 'redes' && canRead(resource) ? `<button class="link-button" data-action="network-qr" data-network-id="${esc(record.id)}">QR Wi-Fi</button>` : ''}${canUpdate(resource) ? `<button class="link-button" onclick="openRecord('${resource}','${record.id}')">Editar</button>` : ''}${canDelete(resource) ? ` <button class="danger-link" onclick="deleteRecord('${resource}','${record.id}')">Excluir</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum registro encontrado.</div>'}</div>`;
}
function moduleDisabledPage(resource) {
  const name = modules[resource]?.name || 'Este módulo';
  return `${header(name, 'Módulo desativado')}<section class="panel"><div class="empty">Este módulo está desativado no momento. Os registros foram preservados para uma reativação futura.</div></section>`;
}
function reportTable(title, rows, empty = 'Sem dados no período.') { return `<section class="panel report-table"><div class="panel-heading"><h3>${esc(title)}</h3></div>${rows.length ? `<table class="data-table"><tbody>${rows.map(row => `<tr><td>${esc(row.label)}</td><td><b>${row.total}</b></td></tr>`).join('')}</tbody></table>` : `<div class="empty">${esc(empty)}</div>`}</section>`; }
function reportBreakdown(title, rows) { return reportTable(title, rows); }
function reportOverview(report) {
  const exclusions = report.exclusions || { total: 0, pending: 0, completed: 0 };
  const demandTotal = report.demandStatus.reduce((total, item) => total + item.total, 0);
  const open = report.demandStatus.filter(item => /abert|pendente/i.test(item.status)).reduce((total, item) => total + item.total, 0);
  const inProgress = report.demandStatus.filter(item => /andamento|atendi|execuc/i.test(item.status)).reduce((total, item) => total + item.total, 0);
  const completed = report.demandStatus.filter(item => /conclu|finaliz|resolvid|encerr/i.test(item.status)).reduce((total, item) => total + item.total, 0);
  const cards = [['◫', 'Total de registros', report.total], ['✓', 'Demandas abertas', open], ['◷', 'Em atendimento', inProgress], ['★', 'Demandas concluídas', completed], ['⌫', 'Exclusões pendentes', exclusions.pending], ['⚠', 'Alertas técnicos', report.alerts.length]];
  const chart = [['Abertas', open], ['Em atendimento', inProgress], ['Concluídas', completed], ['Exclusões', exclusions.total]];
  const maximum = Math.max(1, ...chart.map(([, total]) => total));
  return `<section class="overview-metrics">${cards.map(([icon, label, total]) => `<article class="overview-metric"><span class="overview-metric-icon">${icon}</span><div><div>${esc(label)}</div><b>${total}</b></div></article>`).join('')}</section><section class="panel overview-chart"><div class="panel-heading"><div><h3>Visão operacional</h3><div class="panel-subtitle">Distribuição consolidada do período - ${demandTotal} demanda(s).</div></div></div><div class="overview-bars">${chart.map(([label, total]) => `<div class="overview-bar"><div><i style="height:${Math.max(4, Math.round(total / maximum * 100))}%"></i></div><b>${total}</b><span>${esc(label)}</span></div>`).join('')}</div></section><div class="report-grid">${reportTable('Cadastros por módulo', report.modules.filter(item => isModuleEnabled(item.resource)).map(item => ({ label: modules[item.resource]?.name || item.resource, total: item.total })))}${reportTable('Demandas por status', report.demandStatus.map(item => ({ label: item.status, total: item.total })))}<section class="panel"><div class="panel-heading"><h3>Alertas técnicos</h3></div>${report.alerts.length ? `<table class="data-table"><tbody>${report.alerts.map(item => `<tr><td>${esc(item.item)}</td><td>${tag(item.avaliacao)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem alertas no período.</div>'}</section><section class="panel"><div class="panel-heading"><h3>Power BI</h3></div><div class="empty">Use a exportação CSV/Excel para conectar os dados consolidados e detalhados ao Power BI.</div></section></div>`;
}
function exclusionFilters(exclusions) { const filters = exclusions.filters || {}; const labels = { user: 'Usuário', sector: 'Setor', type: 'Tipo', reason: 'Motivo', status: 'Status' }; return `<div class="report-filter-grid">${Object.entries(labels).map(([key, label]) => `<label>${label}<select onchange="setExclusionFilter('${key}',this.value)"><option value="">Todos</option>${(filters[key] || []).map(value => `<option ${state.exclusionFilters[key] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label>`).join('')}</div>`; }
function exclusionAuditTable(exclusions) {
  return `<section class="panel table-panel exclusion-audit"><div class="panel-heading"><div><h3>Tabela detalhada para auditoria</h3><div class="panel-subtitle">Inclui os dados necessários para exportação e investigação de recorrências.</div></div></div>${exclusions.records.length ? `<table class="data-table"><thead><tr><th>Ticket</th><th>Atendimento</th><th>Paciente</th><th>Solicitante</th><th>Setor</th><th>Tipo</th><th>Motivo</th><th>Solicitada em</th><th>Status</th><th>Concluída por</th><th>Concluída em</th></tr></thead><tbody>${exclusions.records.map(record => `<tr><td>${esc(record.ticket || '—')}</td><td>${esc(record.numeroAtendimento || '—')}</td><td>${esc(record.nomePaciente || '—')}</td><td>${esc(record.usuarioSolicitante || record.solicitante || '—')}</td><td>${esc(record.setorSolicitante || '—')}</td><td>${esc(record.assunto || '—')}</td><td><b>${esc(record.categoriaMotivoExclusao || '—')}</b><br/><small>${esc(record.motivoExclusao || '')}</small></td><td>${record.createdAt ? esc(formatDate(record.createdAt)) : '—'}</td><td>${tag(record.status)}</td><td>${esc(record.exclusaoConcluidaPor || '—')}</td><td>${record.exclusaoConcluidaEm ? esc(formatDate(record.exclusaoConcluidaEm)) : '—'}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhuma solicitação de exclusão atende aos filtros.</div>'}</section>`;
}
function exclusionReportPage(exclusions) {
  const max = Math.max(1, ...exclusions.months.map(item => item.total));
  const monthName = value => value === 'Sem data' ? value : new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(new Date(`${value}-01T12:00:00`));
  return `${exclusionFilters(exclusions)}${exclusionAuditTable(exclusions)}<section class="metrics exclusion-metrics">${[['Solicitações', exclusions.total], ['Concluídas', exclusions.completed], ['Pendentes', exclusions.pending], ['Recusadas / canceladas', exclusions.declined]].map(item => `<div class="metric"><div class="metric-name">${item[0]}</div><div class="metric-number">${item[1]}</div></div>`).join('')}</section><div class="report-grid">${reportBreakdown('Usuários que mais solicitam', exclusions.users)}${reportBreakdown('Setores que mais solicitam', exclusions.sectors)}${reportBreakdown('Tipos de exclusão', exclusions.types)}${reportBreakdown('Categorias de motivo', exclusions.reasons)}</div><section class="panel exclusion-chart"><div class="panel-heading"><div><h3>Evolução das exclusões por mês</h3><div class="panel-subtitle">Dados prontos para análise no Power BI.</div></div></div>${exclusions.months.length ? `<div class="bar-list">${exclusions.months.map(item => `<div class="bar-row"><span>${esc(monthName(item.month))}</span><div><i style="width:${Math.max(4, Math.round(item.total / max * 100))}%"></i></div><b>${item.total}</b></div>`).join('')}</div>` : '<div class="empty">Sem exclusões no período.</div>'}</section><div class="report-grid">${reportBreakdown('Exclusões por status', exclusions.statuses)}${reportBreakdown('Reincidência por usuário e motivo', exclusions.recurring)}</div>`;
}
function demandReportFilters(report) {
  const fields = [['assignee', 'Responsável', report.selectors.assignees], ['requester', 'Solicitante', report.selectors.requesters], ['sector', 'Setor', report.selectors.sectors], ['reason', 'Motivo', report.selectors.reasons], ['category', 'Categoria', report.selectors.categories], ['status', 'Status', report.selectors.statuses]];
  const selected = key => state.demandReportDraft[key] || report.filters[key] || [];
  const start = state.demandReportStart ?? state.start;
  const end = state.demandReportEnd ?? state.end;
  return `<section class="panel demand-query-panel"><div class="panel-heading"><div><h3>Filtros da consulta</h3><div class="panel-subtitle">Defina o período e os critérios antes de gerar o relatório.</div></div></div><div class="demand-query-fields"><label>Período inicial<input type="date" value="${esc(start)}" onchange="setDemandReportPeriod('Start',this.value)"/></label><label>Período final<input type="date" value="${esc(end)}" onchange="setDemandReportPeriod('End',this.value)"/></label>${fields.map(([key, label, options]) => `<label>${label}<select aria-label="Filtrar demandas por ${label.toLowerCase()}" onchange="setDemandReportFilter('${key}',this.value?[this.value]:[])"><option value="">Todos</option>${options.map(option => `<option value="${esc(option)}" ${selected(key).includes(option) ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`).join('')}</div><div class="demand-query-actions"><button class="secondary" type="button" onclick="clearDemandReportFilters()">Limpar filtros</button><button class="add-record" type="button" onclick="applyDemandReportFilters()">Atualizar relatório</button></div></section>`;
}
function demandReportTable(title, headers, rows) {
  return `<section class="panel table-panel demand-report-table"><div class="panel-heading"><h3>${esc(title)}</h3></div>${rows.length ? `<table class="data-table"><thead><tr>${headers.map(item => `<th>${esc(item)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table>` : '<div class="empty">Sem dados no período.</div>'}</section>`;
}
function demandReportBars(title, rows) {
  const maximum = Math.max(1, ...rows.map(item => item.total));
  return `<section class="panel exclusion-chart"><div class="panel-heading"><h3>${esc(title)}</h3></div>${rows.length ? `<div class="bar-list">${rows.map(item => `<div class="bar-row"><span>${esc(item.label)}</span><div><i style="width:${Math.max(4, Math.round(item.total / maximum * 100))}%"></i></div><b>${item.total}</b></div>`).join('')}</div>` : '<div class="empty">Sem dados no período.</div>'}</section>`;
}
function demandReportsPage(demand) {
  const metrics = demand.metrics;
  const period = `${state.start ? formatDate(`${state.start}T12:00:00`) : 'Início'} até ${state.end ? formatDate(`${state.end}T12:00:00`) : 'Hoje'}`;
  const printHeader = `<header class="print-document-header"><div><b>Central TI</b><span>Relatório de Demandas</span></div><div><strong>${esc(period)}</strong><small>Emitido em ${esc(formatDate(new Date().toISOString()))}</small></div></header>`;
  const printFooter = '<footer class="print-document-footer">Central TI · Relatório gerado conforme os filtros aplicados.</footer>';
  const mainReasons = demandReportTable('Principal motivo por solicitante', ['Solicitante', 'Setor', 'Total', 'Principal motivo', 'Qtd.', '% no usuário', '% geral'], demand.mainReasons.map(item => `<tr><td>${esc(item.requester)}</td><td>${esc(item.sector)}</td><td>${item.total}</td><td>${esc(item.reason)}</td><td>${item.quantity}</td><td>${item.percentOfRequester}%</td><td>${item.percentOfTotal}%</td></tr>`));
  const professionals = demandReportTable('Distribuição por profissional', ['Profissional', 'Assumidas', 'Concluídas', 'Em aberto', '% do total'], demand.professionals.map(item => `<tr><td>${esc(item.professional)}</td><td>${item.assumed}</td><td>${item.completed}</td><td>${item.open}</td><td>${item.percentOfTotal}%</td></tr>`));
  const columns = [['ticket', 'Ticket', item => esc(item.ticket)], ['createdAt', 'Abertura', item => item.createdAt ? esc(formatDate(item.createdAt)) : '—'], ['requester', 'Solicitante', item => esc(item.requester)], ['sector', 'Setor', item => esc(item.sector)], ['reason', 'Motivo', item => esc(item.reason)], ['category', 'Categoria', item => esc(item.category)], ['assignee', 'Responsável', item => esc(item.assignee)], ['status', 'Status', item => tag(item.status)]];
  const visibleColumns = columns.filter(([key]) => state.demandReportColumns[key]);
  const pageSize = 25;
  const pages = Math.max(1, Math.ceil(demand.records.length / pageSize));
  const page = Math.min(state.demandReportPage, pages);
  const pageRows = demand.records.slice((page - 1) * pageSize, page * pageSize);
  const chooser = `<details class="report-column-chooser"><summary>Colunas exibidas</summary><div>${columns.map(([key, label]) => `<label><input type="checkbox" ${state.demandReportColumns[key] ? 'checked' : ''} onchange="setDemandReportColumn('${key}',this.checked)"/> ${esc(label)}</label>`).join('')}</div></details>`;
  const details = `<section class="panel table-panel demand-report-table"><div class="panel-heading"><div><h3>Demandas detalhadas</h3><div class="panel-subtitle">${demand.records.length} registro(s) encontrados · página ${page} de ${pages}</div></div>${chooser}</div>${pageRows.length && visibleColumns.length ? `<table class="data-table"><thead><tr>${visibleColumns.map(([, label]) => `<th>${esc(label)}</th>`).join('')}</tr></thead><tbody>${pageRows.map(item => `<tr>${visibleColumns.map(([, , render]) => `<td>${render(item)}</td>`).join('')}</tr>`).join('')}</tbody></table>` : '<div class="empty">Sem demandas para os filtros ou nenhuma coluna selecionada.</div>'}<div class="report-pagination"><button class="secondary" type="button" ${page === 1 ? 'disabled' : ''} onclick="setDemandReportPage(${page - 1})">← Anterior</button><span>Página ${page} de ${pages}</span><button class="secondary" type="button" ${page === pages ? 'disabled' : ''} onclick="setDemandReportPage(${page + 1})">Próxima →</button></div></section>`;
  return `${printHeader}${demandReportFilters(demand)}<section class="metrics report-metrics">${[['Total de demandas', metrics.total], ['Concluídas', `${metrics.completed} (${metrics.completedPercent}%)`], ['Em aberto', metrics.open], ['Usuário com mais demandas', metrics.topRequester], ['Motivo mais frequente', metrics.topReason]].map(([label, value]) => `<div class="metric"><div class="metric-name">${esc(label)}</div><div class="metric-number">${esc(value)}</div></div>`).join('')}</section><div class="report-grid">${mainReasons}${professionals}</div><div class="report-grid">${demandReportBars('Motivos mais frequentes', demand.reasons)}${demandReportBars('Demandas abertas por data', demand.openedByDate)}</div>${details}${printFooter}`;
}
function reportPage() {
  const report = state.report || { modules: [], alerts: [], demandStatus: [], total: 0, demandReport: null, exclusions: { total: 0, pending: 0, completed: 0, declined: 0, users: [], sectors: [], types: [], reasons: [], statuses: [], months: [], recurring: [], records: [], filters: {} }, audit: [] };
  const demand = report.demandReport || { filters: state.demandReportFilters, selectors: { assignees: [], requesters: [], sectors: [], reasons: [], categories: [], statuses: [] }, metrics: { total: 0, completed: 0, open: 0, completedPercent: 0, topRequester: '—', topReason: '—' }, mainReasons: [], professionals: [], reasons: [], openedByDate: [], records: [] };
  const activeTab = state.reportTab === 'materials' ? 'overview' : state.reportTab;
  const tabs = [['overview', 'Visão Geral'], ['demands', 'Demandas'], ['exclusions', 'Exclusões'], ['inventory', 'Inventário'], ['audit', 'Auditoria']];
  const content = activeTab === 'exclusions' ? exclusionReportPage(report.exclusions) : activeTab === 'demands' ? demandReportsPage(demand) : activeTab === 'inventory' ? `<div class="report-grid">${reportTable('Inventário por módulo', report.modules.filter(item => ['computadores', 'equipamentos', 'patrimonio', 'ramais', 'redes'].includes(item.resource)).map(item => ({ label: modules[item.resource]?.name || item.resource, total: item.total })))}${reportTable('Alertas técnicos', report.alerts.map(item => ({ label: `${item.item} · ${item.avaliacao}`, total: 1 })))}</div>` : activeTab === 'audit' ? `<section class="panel table-panel"><div class="panel-heading"><h3>Auditoria do período</h3></div>${report.audit?.length ? `<table class="data-table"><thead><tr><th>Data / hora</th><th>Usuário</th><th>Ação</th><th>Módulo</th></tr></thead><tbody>${report.audit.map(item => `<tr><td>${item.createdAt ? esc(formatDate(item.createdAt)) : '—'}</td><td>${esc(item.userName || 'Usuário removido')}</td><td>${esc(item.action || '—')}</td><td>${esc(item.resource || 'Sistema')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem registros de auditoria no período.</div>'}</section>` : reportOverview(report);
  const actions = activeTab === 'demands'
    ? '<div class="report-actions report-export-actions"><span>Exporte os dados filtrados ou gere o documento para impressão.</span><button class="secondary" onclick="exportReport()">⇩ CSV / Excel</button><button class="add-record" onclick="printDemandReport()">🖨 Gerar PDF</button></div>'
    : `<div class="report-actions"><label>De<input type="date" value="${esc(state.start)}" onchange="setPeriod(this.value,state.end)"/></label><label>Até<input type="date" value="${esc(state.end)}" onchange="setPeriod(state.start,this.value)"/></label><button class="secondary" onclick="exportReport()">⇩ CSV / Excel</button><button class="add-record" onclick="window.print()">🖨 Gerar PDF</button></div>`;
  return `${header('Relatórios', 'Análise e auditoria')}${actions}<nav class="report-tabs">${tabs.map(([id, label]) => `<button class="${activeTab === id ? 'active' : ''}" onclick="setReportTab('${id}')">${esc(label)}</button>`).join('')}</nav>${content}`;
}
function printDemandReport() {
  const demand = state.report?.demandReport;
  if (!demand) return toast('Carregue o relatório antes de gerar o PDF.');
  const printWindow = window.open('', '_blank');
  if (!printWindow) return toast('Permita a abertura da janela de impressão para gerar o PDF.');
  const period = `${state.start ? formatDate(`${state.start}T12:00:00`) : 'Início'} até ${state.end ? formatDate(`${state.end}T12:00:00`) : 'Hoje'}`;
  const table = (title, headers, rows) => `<section><h2>${esc(title)}</h2><table><thead><tr>${headers.map(header => `<th>${esc(header)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></section>`;
  const metrics = [['Total de demandas', demand.metrics.total], ['Concluídas', `${demand.metrics.completed} (${demand.metrics.completedPercent}%)`], ['Em aberto', demand.metrics.open], ['Usuário com mais demandas', demand.metrics.topRequester], ['Motivo mais frequente', demand.metrics.topReason]];
  const summary = `<section class="metrics">${metrics.map(([label, value]) => `<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join('')}</section>`;
  const mainReasons = table('Principal motivo por solicitante', ['Solicitante', 'Setor', 'Total', 'Principal motivo', 'Qtd.', '% no usuário', '% geral'], demand.mainReasons.map(item => `<tr><td>${esc(item.requester)}</td><td>${esc(item.sector)}</td><td>${item.total}</td><td>${esc(item.reason)}</td><td>${item.quantity}</td><td>${item.percentOfRequester}%</td><td>${item.percentOfTotal}%</td></tr>`));
  const professionals = table('Distribuição por profissional', ['Profissional', 'Assumidas', 'Concluídas', 'Em aberto', '% do total'], demand.professionals.map(item => `<tr><td>${esc(item.professional)}</td><td>${item.assumed}</td><td>${item.completed}</td><td>${item.open}</td><td>${item.percentOfTotal}%</td></tr>`));
  const details = table('Demandas detalhadas', ['Ticket', 'Abertura', 'Solicitante', 'Setor', 'Motivo', 'Categoria', 'Responsável', 'Status'], demand.records.map(item => `<tr><td>${esc(item.ticket)}</td><td>${item.createdAt ? esc(formatDate(item.createdAt)) : '—'}</td><td>${esc(item.requester)}</td><td>${esc(item.sector)}</td><td>${esc(item.reason)}</td><td>${esc(item.category)}</td><td>${esc(item.assignee)}</td><td>${esc(item.status)}</td></tr>`));
  const generatedBy = state.user?.nome || 'Usuário autenticado';
  printWindow.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório de Demandas — Central TI</title><style>@page{size:A4 landscape;margin:12mm}*{box-sizing:border-box}body{margin:0;color:#172234;font:9pt Arial,sans-serif}.header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1c3349;padding-bottom:8mm;margin-bottom:7mm}.brand{font-size:19pt;font-weight:800;color:#14202d}.subtitle{display:block;margin-top:2mm;color:#526274;font-size:10pt}.meta{text-align:right;color:#526274;line-height:1.55}.metrics{display:grid;grid-template-columns:repeat(5,1fr);gap:3mm;margin-bottom:7mm}.metrics div{border:1px solid #d8e0e7;border-radius:2mm;padding:4mm;background:#f7f9fb}.metrics span{display:block;color:#526274;font-size:8pt}.metrics b{display:block;margin-top:2mm;font-size:12pt}section{margin:0 0 7mm;break-inside:avoid}h2{margin:0 0 3mm;font-size:11pt;color:#14202d}table{width:100%;border-collapse:collapse;font-size:8pt}th{background:#eaf0f5;color:#34485c;text-align:left;font-size:7.5pt;text-transform:uppercase;letter-spacing:.2pt}th,td{border:1px solid #d8e0e7;padding:2.4mm;vertical-align:top}tr{break-inside:avoid}thead{display:table-header-group}.footer{margin-top:8mm;padding-top:3mm;border-top:1px solid #d8e0e7;color:#6c7c8d;font-size:7.5pt;text-align:center}</style></head><body><header class="header"><div><div class="brand">Central TI</div><span class="subtitle">Relatório de Demandas</span></div><div class="meta"><b>Período:</b> ${esc(period)}<br><b>Emitido por:</b> ${esc(generatedBy)}<br><b>Emitido em:</b> ${esc(formatDate(new Date().toISOString()))}</div></header>${summary}${mainReasons}${professionals}${details}<footer class="footer">Central TI · Relatório gerado conforme os filtros aplicados. Use a numeração do diálogo de impressão para páginas.</footer><script>window.onload=()=>window.print();<\/script></body></html>`);
  printWindow.document.close();
}
function messageThreadId(message) { return message.threadId || message.id; }
function visibleMessageForMe(message, mine) { return (message.recipient.id === mine && !message.recipientDeletedAt) || (message.sender.id === mine && !message.senderDeletedAt); }
function canonicalMailSubject(subject) { return String(subject || '').replace(/^(?:re:\s*)+/i, '').trim() || 'Sem assunto'; }
function mailThreads(messages, mine) {
  const threads = new Map();
  for (const message of messages) {
    const key = messageThreadId(message);
    if (!threads.has(key)) threads.set(key, []);
    threads.get(key).push(message);
  }
  return [...threads.entries()].map(([id, entries]) => ({ id, messages: entries.sort((a, b) => a.createdAt.localeCompare(b.createdAt)) }));
}
function emailPage() {
  const mine = state.user.id;
  const folders = {
    inbox: state.messages.filter(message => message.recipient.id === mine && !message.recipientDeletedAt && !message.recipientArchivedAt),
    sent: state.messages.filter(message => message.sender.id === mine && !message.senderDeletedAt && !message.senderArchivedAt),
    archived: state.messages.filter(message => (message.recipient.id === mine && message.recipientArchivedAt && !message.recipientDeletedAt) || (message.sender.id === mine && message.senderArchivedAt && !message.senderDeletedAt)),
    trash: state.messages.filter(message => (message.recipient.id === mine && message.recipientDeletedAt) || (message.sender.id === mine && message.senderDeletedAt))
  };
  const labels = { inbox: 'Caixa de entrada', sent: 'Enviadas', archived: 'Arquivadas', trash: 'Apagadas' }, icons = { inbox: '✉', sent: '↗', archived: '▣', trash: '♲' };
  const unread = folders.inbox.filter(message => !message.readAt).length;
  const visibleThreads = mailThreads(folders[state.mailFolder], mine).map(thread => {
    const allMessages = state.messages.filter(message => messageThreadId(message) === thread.id && visibleMessageForMe(message, mine)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const latest = thread.messages[thread.messages.length - 1];
    const participant = latest.sender.id === mine ? latest.recipient : latest.sender;
    const unreadCount = allMessages.filter(message => message.recipient.id === mine && !message.readAt).length;
    return { ...thread, allMessages, latest, participant, unreadCount };
  }).filter(thread => `${thread.participant.nome} ${thread.latest.subject} ${thread.allMessages.map(message => message.body).join(' ')}`.toLowerCase().includes(state.mailQuery.toLowerCase())).sort((a, b) => b.latest.createdAt.localeCompare(a.latest.createdAt));
  const selected = new Set(state.selectedMailThreadIds), allSelected = visibleThreads.length && visibleThreads.every(thread => selected.has(thread.id));
  const archiveAction = state.mailFolder === 'archived' ? `<button class="icon-btn" title="Restaurar selecionadas" ${selected.size ? '' : 'disabled'} onclick="restoreSelectedMailThreads()">↶</button>` : `<button class="icon-btn" title="Arquivar selecionadas" ${selected.size ? '' : 'disabled'} onclick="archiveSelectedMailThreads()">▣</button>`;
  return `${header('E-mail interno', 'Conversas entre usuários')}<section class="webmail"><aside class="mail-folders"><button class="compose-button" onclick="compose()">✎ <span>Escrever</span></button>${[['inbox', unread], ['sent', 0], ['archived', 0], ['trash', 0]].map(([folder, count]) => `<button class="folder ${state.mailFolder === folder ? 'active' : ''}" onclick="setMailFolder('${folder}')"><span>${icons[folder]} ${labels[folder]}</span><b>${count || ''}</b></button>`).join('')}<div class="mail-note">As respostas ficam agrupadas na mesma conversa.</div></aside><section class="mail-list panel"><div class="mail-list-tools"><input value="${esc(state.mailQuery)}" oninput="setMailSearch(this.value)" placeholder="Pesquisar conversas"/><button class="icon-btn" title="Atualizar" onclick="load()">↻</button></div><div class="mail-bulk-toolbar"><label><input type="checkbox" ${allSelected ? 'checked' : ''} onchange="toggleAllMailThreads(this.checked)"/> Selecionar todas</label><span>${selected.size ? `${selected.size} selecionada${selected.size === 1 ? '' : 's'}` : ''}</span><button class="icon-btn" title="Marcar como lida" ${selected.size ? '' : 'disabled'} onclick="markSelectedMailRead()">✓</button>${archiveAction}<button class="icon-btn" title="Mover para Apagadas" ${selected.size ? '' : 'disabled'} onclick="deleteSelectedMailThreads()">♲</button></div><div class="mail-list-title">${labels[state.mailFolder]}</div>${visibleThreads.map(thread => `<button class="mail-item ${thread.unreadCount ? 'unread' : ''}" onclick="readThread('${thread.id}')"><input class="mail-select" type="checkbox" ${selected.has(thread.id) ? 'checked' : ''} onclick="event.stopPropagation()" onchange="toggleMailThreadSelection('${thread.id}',this.checked)"/><span class="mail-avatar">${esc(thread.participant.nome.slice(0, 1).toUpperCase())}</span><span class="mail-item-content"><span class="mail-item-top"><b>${esc(thread.latest.sender.id === mine ? `Para: ${thread.participant.nome}` : thread.participant.nome)}</b><time>${formatDate(thread.latest.createdAt)}</time></span><span class="mail-subject">${esc(canonicalMailSubject(thread.latest.subject))}${thread.unreadCount ? ` <small class="mail-thread-count">${thread.unreadCount}</small>` : ''}</span><span class="mail-preview">${esc(thread.latest.body)}</span></span></button>`).join('') || '<div class="empty">Nenhuma conversa nesta caixa.</div>'}</section></section>`;
}
function usersPage() {
  const filters = { query: state.resourceFilters['usuarios-query'] || '', sector: state.resourceFilters['usuarios-sector'] || '', status: state.resourceFilters['usuarios-status'] || '', profile: state.resourceFilters['usuarios-profile'] || '' };
  const accessStatus = user => user.activationStatus === 'pre-cadastro' ? 'Pré-cadastro' : user.activationStatus === 'aguardando aprovação' ? 'Aguardando aprovação' : user.active === false ? 'Desativado' : 'Ativo';
  const sectors = [...new Set(state.users.map(user => user.setor).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  const profiles = [...new Set(state.users.map(user => user.perfil).filter(Boolean))];
  const normalized = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const users = state.users.filter(user => (!filters.query || normalized(`${user.nome} ${user.email} ${user.login}`).includes(normalized(filters.query))) && (!filters.sector || user.setor === filters.sector) && (!filters.status || accessStatus(user) === filters.status) && (!filters.profile || user.perfil === filters.profile));
  const actions = user => `${user.activationStatus === 'aguardando aprovação' ? `<button class="add-record" onclick="approveUser('${user.id}')">Ativar cadastro</button> ` : ''}${user.id === state.user.id ? '<span class="muted">Seu usuário</span>' : `<button class="link-button" onclick="openPasswordReset('${user.id}')">Redefinir senha</button> <button class="link-button" onclick="openPermissions('${user.id}')">Permissões</button> <button class="${user.active === false ? 'link-button' : 'danger-link'}" onclick="setUserActive('${user.id}',${user.active === false})">${user.active === false ? 'Ativar' : 'Desativar'}</button>`}`;
  return `${header('Usuários', 'Cadastro, acessos e permissões')}<section class="users-admin"><div class="users-command-bar"><div class="users-command-title"><span aria-hidden="true">♙</span><div><b>Gestão de usuários</b><small>${state.users.length} cadastro${state.users.length === 1 ? '' : 's'} no sistema</small></div></div><div class="users-command-actions"><button class="secondary" onclick="createBackup()">▣ Backup</button><button class="secondary" onclick="openPreRegistration()">＋ Pré-cadastro</button><button class="add-record" onclick="openUser()">＋ Novo usuário</button></div></div><div class="users-filters"><label>Pesquisar<input class="users-search" value="${esc(filters.query)}" oninput="setUserFilter('query',this.value)" placeholder="Nome, e-mail ou login"/></label><label>Setor<select onchange="setUserFilter('sector',this.value)"><option value="">Todos os setores</option>${sectors.map(value => `<option value="${esc(value)}" ${filters.sector === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label><label>Situação<select onchange="setUserFilter('status',this.value)"><option value="">Todas</option>${['Ativo', 'Pré-cadastro', 'Aguardando aprovação', 'Desativado'].map(value => `<option ${filters.status === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}</select></label><label>Perfil<select onchange="setUserFilter('profile',this.value)"><option value="">Todos</option>${profiles.map(value => `<option value="${esc(value)}" ${filters.profile === value ? 'selected' : ''}>${esc(role(value))}</option>`).join('')}</select></label></div><div class="panel table-panel users-table"><div class="users-table-head"><div><h3>Cadastros de usuários</h3><span>${users.length} resultado${users.length === 1 ? '' : 's'}</span></div></div>${users.length ? `<table class="data-table"><thead><tr><th>Usuário</th><th>Contato / login</th><th>Setor e perfil</th><th>Situação</th><th>Segurança</th><th>Ações</th></tr></thead><tbody>${users.map(user => `<tr><td><b>${esc(user.nome)}</b></td><td>${esc(user.email || 'Ainda não informado')}<small>${esc(user.login || '')}</small></td><td>${esc(user.setor || 'Não informado')}<small>${esc(role(user.perfil))}</small></td><td>${tag(accessStatus(user))}</td><td>${user.mustChangePassword ? tag('Troca de senha pendente') : tag('Senha configurada')}</td><td>${actions(user)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum usuário encontrado com estes filtros.</div>'}</div></section>`;
}
function field([key, label, source], record) {
  if (key === 'prazoSla' || state.user?.perfil !== 'admin' && ['tecnicoResponsavel', 'empresa', 'contato', 'email', 'status'].includes(key)) return '';
  const demandType = record?.tipo || state.newDemandType || 'interna';
  if (state.modal?.resource === 'demandas' && ['empresa', 'contato', 'email'].includes(key) && demandType !== 'externa') return '';
  if (state.modal?.resource === 'patrimonio' && key === 'codigo' && !record) return `<label class="field">${label}<input value="Será gerado automaticamente" readonly aria-readonly="true" style="background:#f5f7fa;color:#65758a;cursor:not-allowed"/></label>`;
  if (key === 'tipo' && state.user?.perfil !== 'admin' && state.newDemandType === 'externa') return `<label class="field">${label}<input name="tipo" value="externa" readonly style="text-transform:uppercase"/></label>`;
  if (key === 'solicitante' && state.user?.perfil !== 'admin' && state.newDemandType === 'externa') return `<label class="field">${label}<input name="solicitante" value="${esc(state.user.nome)}" readonly/></label>`;
  const value = record?.[key] || (key === 'tipo' ? (state.newDemandType || 'interna') : '');
  if (source === 'DEMAND_CATEGORY') { const selectedCategory = record?.categoria || ''; const selectedSubject = record?.assunto || ''; return `<label class="field">${label}<input type="hidden" name="categoria" value="${esc(selectedCategory)}"/><select name="assunto" required onchange="updateDemandCategory(this)"><option value="">Selecione a categoria e o item</option>${Object.entries(DEMAND_CATEGORIES).map(([category, subjects]) => category === 'Outros' ? `<option value="Outros" data-category="Outros" ${selectedCategory === 'Outros' ? 'selected' : ''}>Outros</option>` : `<optgroup label="${esc(category)}">${subjects.map(subject => `<option value="${esc(subject)}" data-category="${esc(category)}" ${selectedCategory === category && selectedSubject === subject ? 'selected' : ''}>${esc(subject)}</option>`).join('')}</optgroup>`).join('')}</select></label>`; }
  if (source === 'DEMAND_SUBCATEGORY') { const category = record?.categoria || ''; const options = DEMAND_CATEGORIES[category] || []; return `<label class="field demand-subcategory" ${category === 'Outros' ? 'hidden' : ''}>${label}<select name="${key}" ${category && category !== 'Outros' ? 'required' : ''}><option value="">Selecione</option>${options.map(option => `<option ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`; }
  if (source === 'DEMAND_OTHER') { const category = record?.categoria || ''; return `<label class="field demand-other ${category === 'Outros' ? '' : 'hidden'}">${label}<input name="${key}" maxlength="250" value="${esc(value)}" placeholder="Descreva o tipo da solicitação" ${category === 'Outros' ? 'required' : ''}/></label>`; }
  if (source.startsWith('OPTIONAL_SELECT:')) { const options = source.slice('OPTIONAL_SELECT:'.length).split(','); return `<label class="field">${label}<select name="${key}"><option value="">Não informado</option>${options.map(option => `<option ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`; }
  if (source === 'OPTIONAL_TEXTAREA') { const existingDemand = Boolean(record?.id); const locked = key === 'descricao' && existingDemand ? 'readonly aria-readonly="true"' : ''; const lockedStyle = locked ? 'background:#f5f7fa;color:#536273;cursor:not-allowed;' : ''; const creator = existingDemand && key === 'descricao' ? (state.users.find(user => user.id === record.createdBy)?.nome || record.solicitante || 'Usuário não informado') : ''; const createdInfo = creator ? `<small style="display:block;margin-top:7px;color:#65758a;font-size:12px">Solicitação registrada por <b>${esc(creator)}</b>${record.createdAt ? ` em ${formatDate(record.createdAt)}` : ''}.</small>` : ''; return `<label class="field">${label}<textarea name="${key}" rows="3" maxlength="3000" placeholder="Informe detalhes adicionais, se necessário" ${locked} style="resize:none;overflow-y:auto;${lockedStyle}">${esc(value)}</textarea>${createdInfo}</label>`; }
  if (source === 'OPTIONAL' || source === 'OPTIONAL_EMAIL') return `<label class="field">${label}<input name="${key}" ${source === 'OPTIONAL_EMAIL' ? 'type="email"' : ''} maxlength="250" value="${esc(value)}" placeholder="Não informado"/></label>`;
  if (source === 'DATE_OPTIONAL') return `<label class="field">${label}<input type="date" name="${key}" value="${esc(value)}"/></label>`;
  if (source === 'DATE_REQUIRED') return `<label class="field">${label}<input type="date" name="${key}" value="${esc(value)}" required/></label>`;
  if (source === 'CURRENCY') return `<label class="field">${label}<input name="${key}" required inputmode="numeric" value="${value ? esc(formatCurrency(value)) : ''}" placeholder="R$ 0,00" oninput="formatCurrencyInput(this)"/></label>`;
  if (source === 'EMAIL_REQUIRED') return `<label class="field">${label}<input type="email" name="${key}" value="${esc(value)}" required maxlength="250"/></label>`;
  if (source === 'PASSWORD_REQUIRED') return `<label class="field">${label}<input type="text" name="${key}" value="${esc(value)}" required maxlength="250" autocomplete="off"/></label>`;
  if (key === 'quantidade') return `<label class="field">${label}<input type="number" name="${key}" required min="0" step="1" value="${esc(value)}" placeholder="0"/></label>`;
  if (source === 'USER') { const optionalRamalResponsible = state.modal?.resource === 'ramais' && key === 'responsavel'; return `<label class="field">${label}<select name="${key}" ${optionalRamalResponsible ? '' : 'required'}><option value="" ${optionalRamalResponsible && (!value || value === 'Não informado') ? 'selected' : ''}>${optionalRamalResponsible ? 'Não informado' : 'Selecione'}</option>${state.users.map(user => `<option ${user.nome === value ? 'selected' : ''}>${esc(user.nome)}</option>`).join('')}</select></label>`; }
  if (source === 'RAMAL_SECTOR') { const existing = state.records.filter(item => item.setor).map(item => item.setor); const options = [...new Set([...RAMAL_SECTORS, ...existing])].sort((a, b) => a.localeCompare(b, 'pt-BR')); return `<label class="field">${label}<input name="${key}" list="ramal-sector-options" required maxlength="120" value="${esc(value)}" placeholder="Selecione ou digite o setor" title="Escolha uma sugestão ou digite uma nova categoria / setor."/></label><datalist id="ramal-sector-options">${options.map(option => `<option value="${esc(option)}"></option>`).join('')}</datalist>`; }
  if (source === 'TECHNICIAN') return `<label class="field">${label}<select name="${key}"><option value="">Ainda não assumida</option>${state.users.filter(user => user.perfil === 'admin').map(user => `<option ${user.nome === value ? 'selected' : ''}>${esc(user.nome)}</option>`).join('')}</select></label>`;
  if (key === 'ip') return `<label class="field">${label}<input name="ip" required inputmode="decimal" maxlength="45" value="${esc(value)}" placeholder="Ex.: 192.168.1.25" title="Informe um endereço IPv4 ou IPv6 válido."/></label>`;
  if (key === 'patrimonio') return `<label class="field">${label}<input name="patrimonio" required maxlength="50" pattern="[A-Za-z0-9][A-Za-z0-9._/-]{1,49}" value="${esc(value)}" placeholder="Ex.: PC-0048" oninput="this.value=this.value.toUpperCase()" title="Use letras, números, ponto, hífen, sublinhado ou barra."/></label>`;
  const options = source === 'DEMAND_STATUS' ? state.statuses : source === 'COMPUTER_GROUP' ? state.computerGroups : source.split(',');
  return `<label class="field">${label}${source.includes(',') || source === 'DEMAND_STATUS' || source === 'COMPUTER_GROUP' ? `<select name="${key}" required><option value="">Selecione</option>${options.map(option => `<option ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>` : `<input name="${key}" required value="${esc(value)}" placeholder="${esc(source)}"/>`}</label>`;
}
function exclusionRequestFields(record) {
  const active = isExclusionRequest(record?.assunto);
  const required = active ? 'required' : '';
  return `<section class="demand-form-section exclusion-request ${active ? '' : 'hidden'}"><div class="exclusion-request-heading"><div><h3>Solicitação de Exclusão</h3><p>Preencha os dados abaixo para garantir a identificação correta do registro.</p></div><span>Obrigatório</span></div><div class="demand-form-row exclusion-request-grid"><label class="field">Número do atendimento<input name="numeroAtendimento" maxlength="100" value="${esc(record?.numeroAtendimento || '')}" placeholder="Ex.: 123456" ${required}/></label><label class="field">Nome do paciente<input name="nomePaciente" maxlength="250" value="${esc(record?.nomePaciente || '')}" placeholder="Nome completo" ${required}/></label></div><label class="field">Categoria do motivo<select name="categoriaMotivoExclusao" ${required}><option value="">Selecione a categoria</option>${EXCLUSION_REASON_CATEGORIES.map(category => `<option ${record?.categoriaMotivoExclusao === category ? 'selected' : ''}>${esc(category)}</option>`).join('')}</select></label><label class="field">Breve descrição do motivo<textarea name="motivoExclusao" rows="3" maxlength="1000" placeholder="Descreva brevemente o motivo da solicitação." ${required}>${esc(record?.motivoExclusao || '')}</textarea></label></section>`;
}
function demandDetailRule(subject) { const normalized = normalizeDemandText(subject); return DEMAND_DETAIL_RULES.find(rule => rule.subjects.some(item => normalized.includes(item))); }
function demandDetailFields(subject, record = {}) {
  const rule = demandDetailRule(subject);
  if (!rule) return '';
  const fields = rule.fields.map(([key, label, placeholder]) => `<label class="field">${label}<input name="${key}" required maxlength="250" value="${esc(record[key] || '')}" placeholder="${placeholder}" ${key === 'valorProcedimento' ? 'inputmode="numeric" oninput="formatCurrencyInput(this)"' : ''}/></label>`).join('');
  return `<section class="demand-form-section demand-detail-request"><div class="demand-detail-heading"><h3>${rule.title}</h3><span>Obrigatório</span></div><div class="demand-detail-grid">${fields}</div></section>`;
}
function demandModal(record) {
  const draft = record || { status: 'Aberta' };
  const demandField = (key, label) => { const definition = modules.demandas.fields.find(item => item[0] === key); return field([key, label || definition[1], definition[2]], draft); };
  const requester = record?.solicitante || state.user?.nome || '';
  const isExclusion = isExclusionRequest(record?.assunto);
  return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal modal-wide demand-modal" onsubmit="saveRecord(event,'demandas','${record?.id || ''}')"><div class="modal-header"><h2>${record ? 'Editar demanda' : 'Criar nova demanda'}</h2><button type="button" class="close" onclick="closeModal()">×</button></div><input type="hidden" name="solicitante" value="${esc(requester)}"/><div class="demand-form"><section class="demand-form-section demand-summary">${demandField('titulo', 'Resumo')}</section><section class="demand-form-row"><div>${demandField('categoria', 'Categoria')}${demandField('outroDetalhe', 'Informe o que é')}</div><div>${demandField('tipo', 'Tipo')}</div></section><div class="demand-detail-fields-container">${demandDetailFields(record?.assunto, record)}</div>${exclusionRequestFields(record)}<section class="demand-form-section demand-description ${isExclusion ? 'hidden' : ''}">${demandField('descricao', 'Descrição')}</section><section class="demand-form-row demand-assignment"><div>${demandField('tecnicoResponsavel', 'Responsável')}</div><div>${demandField('prioridade', 'Prioridade')}</div></section><section class="demand-form-section demand-status">${demandField('status', 'Status')}</section></div><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">${record ? 'Salvar alterações' : 'Criar demanda'}</button></div></form></div>`;
}
function demandDetailsModal(record) {
  const interactions = record.interacoes || [];
  const information = [
    ['Status', tag(record.status), true],
    ['Responsável', record.tecnicoResponsavel || 'Não atribuído'],
    ['Solicitante', record.solicitante || 'Não informado'],
    ['Tipo', record.tipo === 'interna' ? 'Interna (T.I.)' : record.tipo === 'externa' ? 'Hospital' : 'Não informado'],
    ['Categoria', record.categoria || 'Não informada'],
    ['Subcategoria / assunto', record.assunto || 'Não informado'],
    ...(record.codigoProcedimento ? [['Código do procedimento', record.codigoProcedimento]] : []),
    ...(record.convenio ? [['Convênio', record.convenio]] : []),
    ...(record.valorProcedimento ? [['Valor', record.valorProcedimento]] : []),
    ...(record.tuss ? [['TUSS', record.tuss]] : []),
    ...(record.tabela ? [['Tabela', record.tabela]] : []),
    ...(record.outroDetalhe ? [['Detalhe informado', record.outroDetalhe]] : []),
    ...(record.numeroAtendimento ? [['Nº do atendimento', record.numeroAtendimento]] : []),
    ...(record.nomePaciente ? [['Paciente', record.nomePaciente]] : []),
    ...(record.usuarioSolicitante ? [['Usuário solicitante', record.usuarioSolicitante]] : []),
    ...(record.setorSolicitante ? [['Setor solicitante', record.setorSolicitante]] : []),
    ...(record.categoriaMotivoExclusao ? [['Categoria do motivo', record.categoriaMotivoExclusao]] : []),
    ...(record.motivoExclusao ? [['Motivo da exclusão', record.motivoExclusao]] : []),
    ...(record.exclusaoConcluidaPor ? [['Exclusão realizada por', record.exclusaoConcluidaPor]] : []),
    ...(record.exclusaoConcluidaEm ? [['Concluída em', formatDate(record.exclusaoConcluidaEm)]] : []),
    ['Prioridade', tag(record.prioridade), true],
    ['Criado em', formatDate(record.createdAt)]
  ].map(([label, value, html]) => `<div><dt>${esc(label)}</dt><dd>${html ? value : esc(value)}</dd></div>`).join('');
  const comment = item => {
    const screenshot = item.anexoPrint?.data && ['image/png', 'image/jpeg', 'image/webp'].includes(item.anexoPrint.mime) ? `<img class="mail-screenshot" role="button" tabindex="0" onclick="openScreenshot(this.src)" onkeydown="if(event.key==='Enter')openScreenshot(this.src)" alt="Abrir print anexado ao comentário" src="data:${item.anexoPrint.mime};base64,${item.anexoPrint.data}"/>` : '';
    return `<article class="ticket-comment ${item.autorId === state.user.id ? 'mine' : ''}"><div class="comment-avatar">${esc((item.autorNome || 'U').slice(0, 2).toUpperCase())}</div><div><header><b>${esc(item.autorNome || 'Usuário')}</b><time>${formatDate(item.criadoEm)}</time></header>${item.texto ? `<p>${esc(item.texto).replace(/\n/g, '<br/>')}</p>` : ''}${screenshot}</div></article>`;
  };
  return `<div class="modal-backdrop" onclick="closeBack(event)"><section class="modal ticket-details-modal"><div class="modal-header ticket-details-head"><div><span class="ticket-reference">${esc(record.ticket || 'Chamado')}</span><h2>${esc(record.titulo)}</h2></div><button type="button" class="close" onclick="closeModal(true)">×</button></div><div class="ticket-details-layout"><main><section class="ticket-description"><h3>Descrição enviada pelo solicitante</h3><p>${esc(record.descricao || 'Nenhuma descrição informada.').replace(/\n/g, '<br/>')}</p></section><section class="ticket-activity"><h3>Atividade</h3><div class="ticket-conversation">${interactions.length ? interactions.map(comment).join('') : '<div class="ticket-no-comments">Ainda não há comentários. Envie a primeira resposta abaixo.</div>'}</div><form class="ticket-reply" onsubmit="sendDemandComment(event,'${record.id}')"><textarea name="text" maxlength="3000" rows="3" placeholder="Adicionar comentário..."></textarea><button class="primary">Responder</button></form></section></main><aside class="ticket-information"><h3>Informações da demanda</h3><dl>${information}</dl>${canUpdate('demandas') && !record.tecnicoResponsavel && !/conclu|finaliz|resolvid|encerr/i.test(String(record.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ? `<button class="primary ticket-assume" onclick="assignDemandToMe('${record.id}')">Assumir chamado</button>` : ''}${canUpdate('demandas') ? `<button class="secondary ticket-edit" onclick="openRecord('demandas','${record.id}')">Editar chamado</button>` : ''}${canDelete('demandas') ? `<button class="danger-link ticket-delete" onclick="deleteDemandFromDetails('${record.id}')">Excluir chamado</button>` : ''}</aside></div></section></div>`;
}
function mailThreadMessage(message, mine) { const screenshot = message.hasAttachment && ['image/png', 'image/jpeg', 'image/webp'].includes(message.attachmentMime) ? `<div class="mail-screenshot-placeholder" data-mail-attachment="${esc(message.id)}">Carregando print…</div>` : ''; return `<article class="mail-thread-message ${message.sender.id === mine ? 'mine' : ''}"><header><span><b>${esc(message.sender.id === mine ? 'Você' : message.sender.nome)}</b>${message.sender.id === mine ? '<small>Enviado por você</small>' : ''}</span><time>${formatDate(message.createdAt)}</time></header>${message.body ? `<p>${esc(message.body).replace(/\n/g, '<br/>')}</p>` : ''}${screenshot}</article>`; }
function mailThreadSummary(person, count) { return `${person.nome} · ${count} mensagem${count === 1 ? '' : 'ens'}`; }
function modal() { if (!state.modal) return ''; if (state.modal.type === 'demand-details') return demandDetailsModal(state.modal.record); if (state.modal.type === 'network-qr') { const network = state.modal.record; return `<div class="modal-backdrop" onclick="closeBack(event)"><section class="modal network-qr-modal"><div class="modal-header"><div><h2>QR Code do Wi-Fi</h2><p class="modal-intro">Rede: <b>${esc(network.nome)}</b></p></div><button type="button" class="close" aria-label="Fechar QR Code" onclick="closeModal(true)">×</button></div><img class="network-qr-image" src="${state.networkQrUrl}" alt="QR Code para conectar na rede ${esc(network.nome)}"/><p class="network-qr-help">Aponte a câmera do celular para conectar à rede automaticamente.</p><div class="modal-actions"><button type="button" class="primary" onclick="closeModal(true)">Fechar</button></div></section></div>`; } if (state.modal.type === 'record') { const resource = state.modal.resource, record = state.modal.record, module = modules[resource]; if (resource === 'demandas') return demandModal(record); return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal modal-wide" onsubmit="saveRecord(event,'${resource}','${record?.id || ''}')"><div class="modal-header"><h2>${record ? 'Editar' : 'Novo cadastro'} · ${module.name}</h2><button type="button" class="close" onclick="closeModal()">×</button></div>${resource === 'computadores' ? '<p class="modal-intro">Cadastre o IP para localizar a máquina na rede. As datas são opcionais e registram o ciclo de solicitação, entrega e devolução.</p>' : ''}<div class="two-col">${module.fields.map(item => field(item, record)).join('')}</div>${resource === 'computadores' ? `<fieldset class="checklist"><legend>Checklist do kit entregue</legend><div class="checklist-grid">${KIT.map(item => `<label class="check-item"><input type="checkbox" name="checklist" value="${item}" ${(record?.checklist || []).includes(item) ? 'checked' : ''}/><span>✓</span>${item}</label>`).join('')}</div></fieldset>` : ''}<div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Salvar</button></div></form></div>`; }
  if (state.modal.type === 'pre-registration') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="savePreRegistration(event)"><div class="modal-header"><h2>Pré-cadastro de colaborador</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p class="modal-intro">A pessoa fará o primeiro acesso usando primeiro nome e CPF. Depois completará os próprios dados e aguardará sua ativação.</p><label class="field">Nome completo<input name="nome" required maxlength="120"/></label><label class="field">CPF<input name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"/></label><label class="field">Setor<input name="setor" required maxlength="120" placeholder="Ex.: Auditoria Faturamento"/></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Criar pré-cadastro</button></div></form></div>`;
  if (state.modal.type === 'computer-groups') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="saveComputerGroups(event)"><div class="modal-header"><h2>Grupos de computadores</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p class="modal-intro">Cadastre os grupos que organizam as máquinas, como Faturamento, Eletivas e Laboratório. Grupos em uso não podem ser removidos.</p><div id="group-fields">${state.computerGroups.map(group => `<label class="status-editor"><input name="group" value="${esc(group)}" required maxlength="50"/><button type="button" onclick="this.parentElement.remove()">×</button></label>`).join('')}</div><button type="button" class="secondary" onclick="addComputerGroup()">+ Adicionar grupo</button><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Salvar grupos</button></div></form></div>`;
  if (state.modal.type === 'statuses') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="saveStatuses(event)"><div class="modal-header"><h2>Status das demandas</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p class="modal-intro">Edite as colunas. Status com demandas não podem ser removidos.</p><div id="status-fields">${state.statuses.map(status => `<label class="status-editor"><input name="status" value="${esc(status)}" required maxlength="50"/><button type="button" onclick="this.parentElement.remove()">×</button></label>`).join('')}</div><button type="button" class="secondary" onclick="addStatus()">+ Adicionar status</button><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Salvar status</button></div></form></div>`;
  if (state.modal.type === 'announcement') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="saveAnnouncement(event)"><div class="modal-header"><h2>Novo comunicado</h2><button type="button" class="close" onclick="closeModal()">×</button></div><label class="field">Título<input name="title" required maxlength="120" placeholder="Ex.: Manutenção programada"/></label><label class="field">Comunicado<textarea name="body" required rows="7" maxlength="2000" placeholder="Escreva a informação que todos devem visualizar."></textarea></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Publicar</button></div></form></div>`;
  if (state.modal.type === 'mail') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="sendMail(event)"><div class="modal-header"><h2>Nova mensagem interna</h2><button type="button" class="close" onclick="closeModal()">×</button></div><label class="field">Para<select name="recipientId" required><option value="">Selecione</option>${state.users.filter(user => user.id !== state.user.id).map(user => `<option value="${user.id}">${esc(user.nome)} · ${esc(user.email)}</option>`).join('')}</select></label><label class="field">Assunto<input name="subject" required maxlength="160"/></label><label class="field">Mensagem<textarea name="body" required rows="6" maxlength="5000" autofocus></textarea></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Enviar</button></div></form></div>`;
  if (state.modal.type === 'mail-thread') {
    const mine = state.user.id;
    const messages = state.messages.filter(message => messageThreadId(message) === state.modal.threadId && visibleMessageForMe(message, mine)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (!messages.length) return '';
    const latest = messages[messages.length - 1];
    const correspondent = latest.sender.id === mine ? latest.recipient : latest.sender;
    const isTrash = state.mailFolder === 'trash';
    return `<div class="modal-backdrop" onclick="closeBack(event)"><section class="modal modal-wide mail-thread-modal"><div class="modal-header mail-thread-header"><div class="mail-thread-person"><span class="mail-thread-avatar">${esc(correspondent.nome.slice(0, 1).toUpperCase())}</span><div><h2>${esc(canonicalMailSubject(latest.subject))}</h2><p class="modal-intro" data-mail-thread-summary>${esc(mailThreadSummary(correspondent, messages.length))}</p></div></div><button type="button" class="close" aria-label="Fechar conversa" onclick="closeModal(true)">×</button></div><div class="mail-thread-history" aria-label="Histórico da conversa">${messages.map(message => mailThreadMessage(message, mine)).join('')}</div>${isTrash ? '' : `<form class="mail-thread-reply" onsubmit="sendMail(event,'${latest.id}','${state.modal.threadId}')"><label class="field">Responder<textarea name="body" required rows="3" maxlength="5000" autofocus placeholder="Escreva sua resposta..."></textarea></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal(true)">Fechar</button><button class="primary">Responder</button></div></form>`}</section></div>`;
  }
  if (state.modal.type === 'password-reset') { const target = state.modal.user; return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="resetUserPassword(event,'${target.id}')"><div class="modal-header"><h2>Redefinir senha</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p class="modal-intro">Defina uma senha temporária para <b>${esc(target.nome)}</b> · ${esc(target.email || target.login || 'usuário sem e-mail')}. As sessões atuais serão encerradas e a troca será obrigatória no próximo acesso.</p><label class="field">Senha temporária<input name="password" type="password" required minlength="8" autocomplete="new-password" autofocus/></label><label class="field">Confirmar senha temporária<input name="passwordConfirmation" type="password" required minlength="8" autocomplete="new-password"/></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Redefinir senha</button></div></form></div>`; }
  if (state.modal.type === 'permissions') { const target = state.modal.user, permissions = target.permissions || {}; return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal modal-permissions" onsubmit="savePermissions(event,'${target.id}')"><div class="modal-header"><div><h2>Permissões de ${esc(target.nome)}</h2><p class="modal-intro">Marque exatamente o que este usuário pode fazer.</p></div><button type="button" class="close" onclick="closeModal()">×</button></div>${permissionTable(permissions)}<div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Salvar permissões</button></div></form></div>`; }
  return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal modal-permissions" onsubmit="saveUser(event)"><div class="modal-header"><h2>Novo usuário</h2><button type="button" class="close" onclick="closeModal()">×</button></div><div class="two-col"><label class="field">Nome<input name="nome" required/></label><label class="field">E-mail<input name="email" type="email" required/></label><label class="field">Perfil<select name="perfil"><option value="consulta">Consulta</option><option value="ti">Equipe de TI</option><option value="admin">Administrador</option></select></label><label class="field">Senha inicial<input name="senha" type="password" required minlength="12"/></label></div>${permissionTable({})}<div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Criar usuário</button></div></form></div>`; }
function standardLoginPage() {
  const passwordStep = state.loginStep === 'password';
  const form = passwordStep
    ? `<form class="login-card" onsubmit="authenticate(event)"><h2>Informe sua senha</h2><p>Acessando como <b>${esc(state.loginIdentifier)}</b>.</p><input type="hidden" name="email" value="${esc(state.loginIdentifier)}"/><label class="field">Senha<input name="password" type="password" required autocomplete="current-password" autofocus/></label><button class="primary">Entrar na plataforma</button><button type="button" class="login-back" onclick="backToLoginIdentifier()">Voltar</button></form>`
    : `<form class="login-card" onsubmit="continueLogin(event)"><h2>Boas-vindas</h2><p>Informe seu e-mail ou login para continuar.</p><label class="field">E-mail ou login<input name="email" required autocomplete="username" value="${esc(state.loginIdentifier)}" autofocus/></label><button class="primary">Continuar</button><button type="button" class="login-back" onclick="startFirstAccess()">Primeiro acesso</button></form>`;
  return `<div class="login-page"><section class="login-brand"><div class="brand-lockup"><div class="brand-mark">✦</div><span>Central TI</span></div><div class="login-copy"><h1>Suporte Revitalite</h1><p>Equipe de Tecnologia da Informação</p></div></section><section class="login-panel">${form}</section></div>`;
}
function loginPage() { if (state.firstAccess?.token) return `<div class="login-page"><section class="login-brand"><div class="brand-lockup"><div class="brand-mark">✦</div><span>Central TI</span></div></section><section class="login-panel"><form class="login-card" onsubmit="completeFirstAccess(event)"><h2>Complete seu cadastro</h2><p>Olá, <b>${esc(state.firstAccess.nome)}</b>. Informe seus dados e crie sua senha.</p><label class="field">Data de nascimento<input name="dataNascimento" type="date" required/></label><label class="field">E-mail<input name="email" type="email" required/></label><label class="field">Login<input name="login" required minlength="3" maxlength="50" placeholder="Ex.: suseli"/></label><label class="field">Senha<input name="senha" type="password" required minlength="12"/></label><button class="primary">Concluir cadastro</button><button type="button" class="login-back" onclick="cancelFirstAccess()">Voltar</button></form></section></div>`; if (state.firstAccess) return `<div class="login-page"><section class="login-brand"><div class="brand-lockup"><div class="brand-mark">✦</div><span>Central TI</span></div></section><section class="login-panel"><form class="login-card" onsubmit="identifyFirstAccess(event)"><h2>Primeiro acesso</h2><p>Informe seu primeiro nome e CPF para localizar seu pré-cadastro.</p><label class="field">Primeiro nome<input name="nome" required maxlength="60"/></label><label class="field">CPF<input name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"/></label><button class="primary">Validar dados</button><button type="button" class="login-back" onclick="cancelFirstAccess()">Voltar</button></form></section></div>`; if (state.pending) return `<div class="login-page"><section class="login-brand"><div class="brand-lockup"><div class="brand-mark">✦</div><span>Central TI</span></div></section><section class="login-panel"><form class="login-card" onsubmit="verifyCode(event)"><h2>Confirme seu acesso</h2><p>Enviamos um código de seis dígitos para <b>${esc(state.pending.email)}</b>.</p><label class="field">Código<input name="code" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" required autofocus/></label><button class="primary">Validar e entrar</button><button type="button" class="login-back" onclick="cancelCode()">Voltar</button></form></section></div>`; return standardLoginPage(); }
function passwordPage() { return `<div class="login-page"><section class="login-brand"><div class="brand-lockup"><div class="brand-mark">✦</div><span>Central TI</span></div><div class="login-copy"><h1>Proteja seu acesso.</h1><p>Antes de usar o sistema, defina uma senha pessoal e segura.</p></div></section><section class="login-panel"><form class="login-card" onsubmit="changeOwnPassword(event)"><h2>Troca obrigatória de senha</h2><p>Use 8+ caracteres, maiúscula, minúscula, número e símbolo.</p><label class="field">Senha atual<input name="currentPassword" type="password" required autofocus/></label><label class="field">Nova senha<input name="newPassword" type="password" required minlength="8"/></label><button class="primary">Salvar senha e entrar</button></form></section></div>`; }
function render({ preserveScroll = false } = {}) { if (closingModal) return; const previousContent = preserveScroll ? document.querySelector('#app .content') : null; const scrollTop = previousContent?.scrollTop || 0; if (!state.token || !state.user) { $('#app').innerHTML = loginPage(); return; } if (state.user.mustChangePassword) { $('#app').innerHTML = passwordPage(); return; } const page = state.loading ? `<div class="loading-skeleton">${loadingPage()}</div>` : state.page === 'dashboard' ? dashboard() : state.page === 'demandas' ? demandBoard() : state.page === 'demandas-internas' ? filteredDemandBoard('interna') : state.page === 'demandas-externas' ? filteredDemandBoard('externa') : state.page === 'relatorios' ? reportPage() : state.page === 'email' ? emailPage() : state.page === 'usuarios' ? usersPage() : state.page === 'localizacao' ? locationPage() : !isModuleEnabled(state.page) ? moduleDisabledPage(state.page) : recordsPage(state.page); $('#app').innerHTML = `<div class="shell">${sidebar()}<main class="content">${page}</main></div>${modal()}`; if (preserveScroll) document.querySelector('#app .content')?.scrollTo({ top: scrollTop }); enhanceCurrentSurface(); }
function loadingPage() {
  const pages = {
    dashboard: ['Visão geral', 'Carregando indicadores e comunicados'],
    demandas: ['Demandas', 'Carregando quadro de trabalho'],
    'demandas-internas': ['Demandas internas', 'Carregando quadro de trabalho'],
    'demandas-externas': ['Demandas externas', 'Carregando quadro de trabalho'],
    relatorios: ['Relatórios', 'Carregando análise e auditoria'],
    email: ['E-mail interno', 'Carregando mensagens'],
    usuarios: ['Usuários', 'Carregando acessos e permissões'],
    localizacao: ['Localizar equipamentos', 'Carregando inventário']
  };
  const [title, subtitle] = pages[state.page] || [modules[state.page]?.name || 'Central TI', 'Carregando informações'];
  const line = width => `<span class="skeleton-line" style="--skeleton-width:${width}"></span>`;
  const table = `<section class="panel table-panel skeleton-table"><div class="skeleton-table-head">${line('32%')}${line('18%')}${line('18%')}${line('14%')}</div><div class="skeleton-table-body">${Array.from({ length: 6 }, () => `<div>${line('26%')}${line('22%')}${line('19%')}${line('15%')}</div>`).join('')}</div></section>`;
  if (state.page === 'dashboard') return `${header(title, subtitle)}<section class="metrics skeleton-metrics">${Array.from({ length: 4 }, () => `<div class="metric skeleton-card">${line('48%')}${line('28%')}</div>`).join('')}</section><section class="dashboard-grid"><div class="panel skeleton-panel">${line('38%')}${line('72%')}${line('60%')}</div><div class="panel skeleton-panel">${line('42%')}${line('84%')}${line('58%')}</div></section>`;
  if (state.page.startsWith('demandas')) return `${header(title, subtitle)}<div class="skeleton-toolbar">${line('220px')}${line('130px')}</div><section class="kanban skeleton-kanban">${Array.from({ length: 3 }, () => `<div class="kanban-column">${line('42%')}<div class="skeleton-card">${line('82%')}${line('54%')}</div><div class="skeleton-card">${line('70%')}${line('46%')}</div></div>`).join('')}</section>`;
  if (state.page === 'relatorios') return `${header(title, subtitle)}<div class="skeleton-toolbar">${line('180px')}${line('150px')}${line('130px')}</div><section class="metrics skeleton-metrics">${Array.from({ length: 4 }, () => `<div class="metric skeleton-card">${line('50%')}${line('26%')}</div>`).join('')}</section>${table}`;
  return `${header(title, subtitle)}<div class="skeleton-toolbar">${line('260px')}${line('130px')}</div>${table}`;
}
function unreadCount(messages) { return messages.filter(message => message.recipient?.id === state.user?.id && !message.readAt && !message.recipientDeletedAt).length; }
async function refreshUnreadMessages(renderWhenChanged = false) {
  if (!state.token || !state.user) return false;
  try {
    const mail = await api('/api/messages');
    const unreadMessages = (mail.messages || []).filter(message => message.recipient?.id === state.user.id && !message.readAt && !message.recipientDeletedAt);
    const unreadIds = new Set(unreadMessages.map(message => message.id));
    if (knownUnreadMessageIds) {
      const newMessages = unreadMessages.filter(message => !knownUnreadMessageIds.has(message.id));
      if (newMessages.length) {
        const newest = newMessages.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
        toast(newMessages.length === 1 ? `Nova mensagem de ${newest.sender.nome}: ${canonicalMailSubject(newest.subject)}` : `Você recebeu ${newMessages.length} novas mensagens.`);
      }
    }
    knownUnreadMessageIds = unreadIds;
    const changed = state.unreadMessages !== unreadMessages.length;
    if (changed) { state.unreadMessages = unreadMessages.length; if (renderWhenChanged && !state.modal && !state.formDirty && !state.loading) render(); }
    return changed;
  } catch (_) { return false; /* A atualização do aviso não deve interromper a tela atual. */ }
}
function dataSnapshot() { const dashboard = state.dashboard ? { ...state.dashboard } : null; if (dashboard) delete dashboard.generatedAt; return JSON.stringify({ dashboard, records: state.records, users: state.users, messages: state.messages, report: state.report, statuses: state.statuses, locations: state.locations, unreadMessages: state.unreadMessages }); }
async function load(options = {}) {
  const silent = Boolean(options.silent);
  const requestId = options.requestId ?? navigationRequest;
  const requestedPage = state.page;
  const before = silent ? dataSnapshot() : '';
  const isCurrentRequest = () => requestId === navigationRequest && requestedPage === state.page;
  const usersForPage = () => state.user.perfil === 'admin' ? api('/api/users') : Promise.resolve({ users: [] });

  if (!silent) {
    state.loading = true;
    render();
  }

  try {
    if (requestedPage === 'dashboard') {
      const dashboard = await api('/api/dashboard');
      if (!isCurrentRequest()) return;
      state.dashboard = dashboard;
      state.unreadMessages = dashboard.inbox || 0;
    } else if (requestedPage === 'demandas' || requestedPage.startsWith('demandas-')) {
      const [records, statuses, users] = await Promise.all([api('/api/resources/demandas'), api('/api/demand-statuses'), usersForPage()]);
      if (!isCurrentRequest()) return;
      state.records = records.records;
      state.statuses = statuses.statuses;
      state.users = users.users;
    } else if (requestedPage === 'relatorios') {
      const params = new URLSearchParams();
      if (state.start) params.set('start', state.start);
      if (state.end) params.set('end', state.end);
      for (const [key, value] of Object.entries(state.exclusionFilters)) if (value) params.set(`exclusion${key[0].toUpperCase()}${key.slice(1)}`, value);
      for (const [key, values] of Object.entries(state.demandReportFilters)) for (const value of values) params.append(`demand${key[0].toUpperCase()}${key.slice(1)}`, value);
      const report = await api(`/api/reports?${params}`);
      if (!isCurrentRequest()) return;
      state.report = report;
    } else if (requestedPage === 'email') {
      const [mail, users] = await Promise.all([api('/api/messages'), usersForPage()]);
      if (!isCurrentRequest()) return;
      state.messages = mail.messages;
      state.users = users.users;
      state.unreadMessages = unreadCount(state.messages);
    } else if (requestedPage === 'usuarios') {
      const users = await api('/api/users');
      if (!isCurrentRequest()) return;
      state.users = users.users;
    } else if (requestedPage === 'localizacao') {
      const locations = await api('/api/locations/computadores');
      if (!isCurrentRequest()) return;
      state.locations = locations;
    } else {
      const [records, users] = await Promise.all([api(`/api/resources/${requestedPage}`), usersForPage()]);
      if (!isCurrentRequest()) return;
      state.records = records.records;
      state.users = users.users;
    }
  } catch (error) {
    if (isCurrentRequest()) toast(error.message);
  } finally {
    if (!isCurrentRequest()) return;
    if (!silent) {
      state.loading = false;
      render();
    } else if (before !== dataSnapshot()) render({ preserveScroll: true });
  }
}
async function go(page) {
  const requestId = ++navigationRequest;
  state.page = page;
  state.query = '';
  state.modal = null;
  await load({ requestId });
}
function setSearch(value) { state.query = value; render(); const input = $('.search'); if (input) { input.focus(); input.setSelectionRange(value.length, value.length); } }
function setDemandAssignee(value) { state.demandAssignee = value; render(); }
function setProgramFilter(field, value) { state[field] = value; render(); }
function setResourceFilter(resource, key, value) { state.resourceFilters[`${resource}-${key}`] = value; render(); }
function setUserFilter(key, value) { state.resourceFilters[`usuarios-${key}`] = value; render(); const input = $('.users-search'); if (key === 'query' && input) { input.focus(); input.setSelectionRange(value.length, value.length); } }
function toggleRamalOrder() { state.ramalOrder = state.ramalOrder === 'asc' ? 'desc' : 'asc'; render(); }
function setPeriod(start, end) { state.start = start; state.end = end; load(); }
function setReportTab(tab) { state.reportTab = tab; render(); }
function setExclusionFilter(field, value) { state.exclusionFilters[field] = value; load(); }
function setDemandReportFilter(field, values) { state.demandReportDraft[field] = Array.isArray(values) ? values : []; state.demandReportPage = 1; render(); }
function setDemandReportPeriod(field, value) { state[`demandReport${field}`] = value; render(); }
function applyDemandReportFilters() { state.start = state.demandReportStart ?? state.start ?? ''; state.end = state.demandReportEnd ?? state.end ?? ''; state.demandReportFilters = Object.fromEntries(Object.entries(state.demandReportDraft).map(([field, values]) => [field, [...values]])); state.demandReportPage = 1; load(); }
function clearDemandReportFilters() { state.demandReportDraft = { assignee: [], requester: [], sector: [], reason: [], category: [], status: [] }; state.demandReportStart = ''; state.demandReportEnd = ''; applyDemandReportFilters(); }
function setDemandReportColumn(column, visible) { state.demandReportColumns[column] = visible; render(); }
function setDemandReportPage(page) { state.demandReportPage = Math.max(1, page); render(); }
function openRecord(resource, id = '') {
  state.formDirty = false;
  state.newDemandType = null;
  state.modal = { type: 'record', resource, record: id ? state.records.find(record => record.id === id) : null };
  render();
  addObservationField();
  if (resource === 'computadores') api('/api/computer-groups').then(result => { if (state.modal?.type === 'record' && state.modal.resource === 'computadores' && !state.formDirty) { state.computerGroups = result.groups; render(); addObservationField(); } }).catch(error => toast(error.message));
}
async function openNetworkQr(id) {
  const record = state.records.find(item => item.id === id);
  if (!record) return toast('Rede não encontrada.');
  try {
    const response = await fetch(`/api/resources/redes/${encodeURIComponent(id)}/qrcode`, { headers: { authorization: `Bearer ${state.token}` } });
    if (!response.ok) { const data = await response.json().catch(() => ({})); throw new Error(data.error || 'Não foi possível gerar o QR Code.'); }
    state.networkQrUrl = `data:image/svg+xml;base64,${btoa(await response.text())}`;
    state.modal = { type: 'network-qr', record };
    state.formDirty = false;
    render();
  } catch (error) { toast(error.message); }
}
function openDemand(type) { state.newDemandType = type; openRecord('demandas'); state.newDemandType = type; render(); addObservationField(); }
async function openDemandDetails(id) {
  try {
    const result = await api(`/api/resources/demandas/${id}`);
    const record = result.records?.[0];
    if (!record) return toast('Chamado não encontrado.');
    state.modal = { type: 'demand-details', record };
    state.formDirty = false;
    render();
  } catch (error) { toast(error.message); }
}
async function sendDemandComment(event, id) {
  event.preventDefault();
  const form = event.target;
  const text = new FormData(form).get('text')?.trim();
  const screenshot = form.querySelector('[name="commentScreenshot"]')?.files[0];
  if (!text && !screenshot) return toast('Escreva uma resposta ou anexe um print.');
  const data = { text };
  if (screenshot) {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(screenshot.type) || screenshot.size > 5_000_000) return toast('Envie somente um print PNG, JPG ou WEBP de até 5 MB.');
    const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(screenshot); });
    data.anexoPrint = { mime: screenshot.type, data: base64 };
  }
  try {
    await api(`/api/resources/demandas/${id}/comments`, { method: 'POST', body: JSON.stringify(data) });
    await openDemandDetails(id);
    await refreshUnreadMessages(true);
    toast('Resposta enviada e participantes notificados.');
  } catch (error) {
    toast(error.message);
  }
}
async function assignDemandToMe(id) {
  const status = String(state.modal?.record?.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/conclu|finaliz|resolvid|encerr/i.test(status)) return toast('Este chamado já está concluído.');
  const button = document.querySelector('.ticket-assume');
  beginPendingAction(button, { label: 'Atribuindo…', form: true });
  try {
    await api(`/api/resources/demandas/${id}/assign-self`, { method: 'PUT', body: '{}' });
    await openDemandDetails(id);
    toast('Chamado atribuído a você.');
  } catch (error) {
    toast(error.message);
  }
}
function updateDemandCategory(select) {
  const form = select.closest('form');
  const option = select.selectedOptions[0];
  const category = option?.dataset.category || '';
  const categoryInput = form.querySelector('input[name="categoria"]');
  const otherField = form.querySelector('.demand-other');
  const other = otherField?.querySelector('input');

  if (categoryInput) categoryInput.value = category;
  const detailFields = form.querySelector('.demand-detail-fields-container');
  if (detailFields) detailFields.innerHTML = demandDetailFields(option?.value);
  otherField?.classList.toggle('hidden', category !== 'Outros');
  if (other) {
    other.required = category === 'Outros';
    if (category !== 'Outros') other.value = '';
  }
  const exclusionSection = form.querySelector('.exclusion-request');
  const isExclusion = isExclusionRequest(option?.value);
  exclusionSection?.classList.toggle('hidden', !isExclusion);
  exclusionSection?.querySelectorAll('input, textarea, select').forEach(field => {
    field.required = isExclusion;
    if (!isExclusion) field.value = '';
  });
  form.querySelector('.demand-description')?.classList.toggle('hidden', isExclusion);
}
function addObservationField() {
  const form = document.querySelector('form.modal');
  if (!form || form.querySelector('.observations-field')) return;
  const demand = state.modal?.resource === 'demandas';
  if (demand && !state.modal?.record) return;
  const field = document.createElement('section');
  field.className = 'observations-field';
  if (demand) {
    const interactions = state.modal?.record?.interacoes || [];
    field.innerHTML = `<label class="field"><span class="observation-title">Observação da T.I.</span><textarea name="novaObservacao" rows="3" maxlength="3000" placeholder="Descreva o atendimento, ação realizada ou próximo passo." style="resize:none;overflow-y:auto"></textarea></label><div class="observation-title">Histórico do ticket</div><div class="ticket-timeline">${interactions.length ? interactions.slice().reverse().map(item => `<div><b>${esc(item.autorNome || 'Equipe de T.I.')}</b><small>${formatDate(item.criadoEm)}</small><p>${esc(item.texto)}</p></div>`).join('') : '<span>Sem atualizações registradas.</span>'}</div>`;
    const descriptionField = form.querySelector('textarea[name="descricao"]')?.closest('.field');
    if (descriptionField) { descriptionField.after(field); return; }
  } else {
    field.innerHTML = '<label class="field">Observações<textarea name="observacoes" rows="5" maxlength="5000" placeholder="Registre informações, atualizações e próximos passos."></textarea></label>';
    field.querySelector('textarea').value = state.modal?.record?.observacoes || '';
  }
  const anchor = form.querySelector('.checklist') || form.querySelector('.modal-actions');
  form.insertBefore(field, anchor);
}
function openStatusManager() { state.modal = { type: 'statuses' }; render(); }
async function openGroupManager() { try { state.computerGroups = (await api('/api/computer-groups')).groups; state.modal = { type: 'computer-groups' }; render(); } catch (error) { toast(error.message); } }
function addStatus() { const row = document.createElement('label'); row.className = 'status-editor'; row.innerHTML = '<input name="status" required maxlength="50" placeholder="Novo status"/><button type="button" onclick="this.parentElement.remove()">×</button>'; $('#status-fields').append(row); }
function addComputerGroup() { const row = document.createElement('label'); row.className = 'status-editor'; row.innerHTML = '<input name="group" required maxlength="50" placeholder="Novo grupo"/><button type="button" onclick="this.parentElement.remove()">×</button>'; $('#group-fields').append(row); }
function permissionTable(current) { const actions = [['list','Listar'],['create','Incluir'],['update','Alterar'],['consult','Consultar'],['delete','Excluir']]; return `<fieldset class="permission-table"><legend>Permissões por módulo</legend><p class="modal-intro">Marque somente os módulos e ações que este usuário poderá utilizar. Módulos sem permissão não aparecem para ele.</p><div class="permission-scroll"><table><thead><tr><th>Módulo</th><th>Todos</th>${actions.map(([,label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${Object.entries(modules).filter(([id]) => isModuleEnabled(id)).map(([id, module]) => { const value = current[id]; const legacy = value ? value.read !== false : false; const checked = action => { if (!value) return false; return action === 'list' || action === 'consult' ? value[action] ?? legacy : value[action] ?? value.write ?? false; }; return `<tr><td><b>${esc(module.name)}</b></td><td><input type="checkbox" class="permission-all" data-resource="${id}" onchange="toggleAllPermissions('${id}',this.checked)" ${actions.every(([action]) => checked(action)) ? 'checked' : ''}/></td>${actions.map(([action]) => `<td><input type="checkbox" name="permission-${id}-${action}" ${checked(action) ? 'checked' : ''} onchange="syncPermissionAll('${id}')"/></td>`).join('')}</tr>`; }).join('')}</tbody></table></div></fieldset>`; }
function openUser() { state.modal = { type: 'user' }; render(); }
function openPreRegistration() { state.modal = { type: 'pre-registration' }; render(); }
function openPermissions(id) { const user = state.users.find(item => item.id === id); if (!user) return; state.modal = { type: 'permissions', user }; render(); }
function openPasswordReset(id) { const user = state.users.find(item => item.id === id); if (!user) return; state.modal = { type: 'password-reset', user }; render(); }
function toggleAllPermissions(resource, checked) { document.querySelectorAll(`[name^="permission-${resource}-"]`).forEach(input => { input.checked = checked; }); }
function syncPermissionAll(resource) { const inputs = [...document.querySelectorAll(`[name^="permission-${resource}-"]`)]; const all = document.querySelector(`.permission-all[data-resource="${resource}"]`); if (all) { all.checked = inputs.every(input => input.checked); all.indeterminate = !all.checked && inputs.some(input => input.checked); } }
async function compose() { if (!state.users.length) state.users = (await api('/api/users')).users; state.modal = { type: 'mail' }; render(); }
function openAnnouncement() { state.modal = { type: 'announcement' }; state.formDirty = false; render(); }
async function saveAnnouncement(event) { event.preventDefault(); try { await api('/api/announcements', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); closeModal(true); await load(); toast('Comunicado publicado para todos.'); } catch (error) { toast(error.message); } }
async function deleteAnnouncement(id) { if (!await confirmDialog({ title: 'Remover comunicado', message: 'Este comunicado deixará de ser exibido para todos os usuários.', confirmLabel: 'Remover', destructive: true })) return; try { await api(`/api/announcements/${id}`, { method: 'DELETE' }); await load(); toast('Comunicado removido.'); } catch (error) { toast(error.message); } }
async function replyMail(id) { const message = state.messages.find(item => item.id === id); if (message) await readThread(messageThreadId(message)); }
function prefersReducedMotion() { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
function waitForSurfaceExit(surface) {
  if (!surface || prefersReducedMotion()) return Promise.resolve();
  surface.classList.add('is-closing');
  return new Promise(resolve => {
    let completed = false;
    const finish = () => {
      if (completed) return;
      completed = true;
      clearTimeout(timeout);
      surface.removeEventListener('transitionend', onTransitionEnd);
      resolve();
    };
    const onTransitionEnd = event => { if (event.target === surface && event.propertyName === 'opacity') finish(); };
    const timeout = setTimeout(finish, 220);
    surface.addEventListener('transitionend', onTransitionEnd);
  });
}
async function closeModal(force = false) { if (!force && state.formDirty && !await confirmDialog({ title: 'Descartar alterações?', message: 'Há dados não salvos. Deseja fechar mesmo assim?', confirmLabel: 'Descartar', destructive: true })) return; closingModal = true; await waitForSurfaceExit(document.querySelector('.modal-backdrop')); state.networkQrUrl = null; state.modal = null; state.formDirty = false; state.newDemandType = null; closingModal = false; render(); }
function closeBack(event) { /* O fundo do modal não fecha formulários: evita perda de dados digitados. */ }
async function saveRecord(event, resource, id) { event.preventDefault(); const form = new FormData(event.target), data = Object.fromEntries(form); delete data.demandScreenshot; const screenshot = event.target.querySelector('[name="demandScreenshot"]')?.files[0]; if (screenshot) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(screenshot.type) || screenshot.size > 5_000_000) return toast('Envie somente um print PNG, JPG ou WEBP de até 5 MB.'); const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(screenshot); }); data.anexoPrint = { mime: screenshot.type, data: base64 }; } const observation = event.target.querySelector('[name="novaObservacao"]'); if (observation) data.novaObservacao = observation.value.trim(); if (resource === 'computadores') data.checklist = form.getAll('checklist'); try { await api(`/api/resources/${resource}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeModal(true); if (state.page.startsWith('demandas-')) await go(state.page); else await load(); toast('Cadastro salvo.'); } catch (error) { toast(error.message); } }
async function deleteRecord(resource, id) { if (!await confirmDialog({ title: 'Excluir registro', message: 'Este registro será removido permanentemente e não poderá ser recuperado.', confirmLabel: 'Excluir', destructive: true })) return; try { await api(`/api/resources/${resource}/${id}`, { method: 'DELETE' }); await load(); toast('Registro excluído.'); } catch (error) { toast(error.message); } }
async function deleteDemandFromDetails(id) {
  const record = state.modal?.type === 'demand-details' && state.modal.record?.id === id ? state.modal.record : null;
  const reference = record?.ticket || id;
  if (!await confirmDialog({ title: `Excluir chamado ${reference}`, message: 'Este chamado será removido permanentemente e não poderá ser recuperado.', confirmLabel: 'Excluir chamado', destructive: true })) return;
  try {
    await api(`/api/resources/demandas/${id}`, { method: 'DELETE' });
    state.modal = null;
    await load();
    toast('Chamado excluído.');
  } catch (error) { toast(error.message); }
}
let activeDraggedBoard = null;
let dragPointerX = null;
let dragScrollFrame = null;
function dragDemand(event, id) {
  event.dataTransfer.setData('demandId', id);
  activeDraggedBoard = event.currentTarget.closest('.kanban');
  dragPointerX = event.clientX;
  startKanbanAutoScroll();
}
function autoScrollKanban(event, board = activeDraggedBoard) {
  if (!board) return;
  activeDraggedBoard = board;
  if (event.clientX) dragPointerX = event.clientX;
  startKanbanAutoScroll();
}
function startKanbanAutoScroll() {
  if (dragScrollFrame || !activeDraggedBoard) return;
  const scroll = () => {
    dragScrollFrame = null;
    const board = activeDraggedBoard;
    if (!board || dragPointerX === null) return;
    const bounds = board.getBoundingClientRect();
    const edge = Math.min(150, bounds.width * 0.22);
    const leftDistance = dragPointerX - bounds.left;
    const rightDistance = bounds.right - dragPointerX;
    let horizontal = 0;

    if (leftDistance < edge) horizontal = -Math.min(28, Math.max(5, Math.ceil((edge - leftDistance) / 3)));
    else if (rightDistance < edge) horizontal = Math.min(28, Math.max(5, Math.ceil((edge - rightDistance) / 3)));

    if (horizontal) board.scrollLeft += horizontal;
    dragScrollFrame = requestAnimationFrame(scroll);
  };
  dragScrollFrame = requestAnimationFrame(scroll);
}
function stopKanbanAutoScroll() {
  activeDraggedBoard = null;
  dragPointerX = null;
  if (dragScrollFrame) cancelAnimationFrame(dragScrollFrame);
  dragScrollFrame = null;
}
async function dropDemand(event, status) { event.preventDefault(); const demandId = event.dataTransfer.getData('demandId'); stopKanbanAutoScroll(); await moveDemand(demandId, status); }
async function moveDemand(id, status) { const demand = state.records.find(record => record.id === id); if (!demand || demand.status === status) return; if (!demand.tecnicoResponsavel) { await openDemandDetails(id); return toast('Veja as informações e assuma o chamado antes de alterar o status.'); } try { await api(`/api/resources/demandas/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) }); if (state.page.startsWith('demandas-')) await go(state.page); else await load(); toast(`Demanda movida para ${status}.`); } catch (error) { toast(error.message); } }
async function saveStatuses(event) { event.preventDefault(); const statuses = new FormData(event.target).getAll('status').map(value => value.trim()).filter(Boolean); try { const result = await api('/api/demand-statuses', { method: 'PUT', body: JSON.stringify({ statuses }) }); state.statuses = result.statuses; closeModal(true); await load(); toast('Status atualizados.'); } catch (error) { toast(error.message); } }
async function saveComputerGroups(event) { event.preventDefault(); const groups = new FormData(event.target).getAll('group').map(value => value.trim()).filter(Boolean); try { const result = await api('/api/computer-groups', { method: 'PUT', body: JSON.stringify({ groups }) }); state.computerGroups = result.groups; closeModal(true); toast('Grupos atualizados.'); } catch (error) { toast(error.message); } }
async function sendMail(event, replyToId = '', currentThreadId = '') {
  event.preventDefault();
  const form = event.target, data = Object.fromEntries(new FormData(form));
  const screenshot = form.querySelector('[name="screenshot"]')?.files[0]; delete data.screenshot;
  if (screenshot) { if (!['image/png', 'image/jpeg', 'image/webp'].includes(screenshot.type) || screenshot.size > 5_000_000) return toast('Envie somente um print PNG, JPG ou WEBP de até 5 MB.'); const base64 = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = reject; reader.readAsDataURL(screenshot); }); data.attachment = { mime: screenshot.type, data: base64 }; }
  if (replyToId) data.replyToId = replyToId;
  try {
    const result = await api('/api/messages', { method: 'POST', body: JSON.stringify(data) });
    if (currentThreadId) {
      const parent = state.messages.find(message => message.id === replyToId);
      const recipient = parent?.senderId === state.user.id ? parent.recipient : parent?.sender || state.users.find(user => user.id === result.message.recipientId);
      const message = { ...result.message, sender: state.user, recipient, hasAttachment: Boolean(data.attachment), attachmentMime: data.attachment?.mime || null };
      state.messages.unshift(message);
      state.formDirty = false;
      form.reset();
      const history = document.querySelector('.mail-thread-history');
      history?.insertAdjacentHTML('beforeend', mailThreadMessage(message, state.user.id));
      if (history) history.scrollTop = history.scrollHeight;
      const summary = document.querySelector('[data-mail-thread-summary]');
      if (summary && recipient) summary.textContent = mailThreadSummary(recipient, state.messages.filter(item => messageThreadId(item) === currentThreadId && visibleMessageForMe(item, state.user.id)).length);
    } else { await closeModal(true); await load(); }
    toast('Mensagem enviada.');
  } catch (error) { toast(error.message); }
}
function setMailFolder(folder) { state.mailFolder = folder; state.selectedMessageId = null; state.selectedMailThreadIds = []; state.mailQuery = ''; render(); }
function setMailSearch(value) { state.mailQuery = value; state.selectedMessageId = null; state.selectedMailThreadIds = []; render(); const input = document.querySelector('.mail-list-tools input'); if (input) { input.focus(); input.setSelectionRange(value.length, value.length); } }
function visibleMailThreadIds() { const mine = state.user.id, folders = { inbox: state.messages.filter(message => message.recipient.id === mine && !message.recipientDeletedAt && !message.recipientArchivedAt), sent: state.messages.filter(message => message.sender.id === mine && !message.senderDeletedAt && !message.senderArchivedAt), archived: state.messages.filter(message => (message.recipient.id === mine && message.recipientArchivedAt && !message.recipientDeletedAt) || (message.sender.id === mine && message.senderArchivedAt && !message.senderDeletedAt)), trash: state.messages.filter(message => (message.recipient.id === mine && message.recipientDeletedAt) || (message.sender.id === mine && message.senderDeletedAt) || message.deletedAt) }, query = state.mailQuery.toLowerCase(); return mailThreads(folders[state.mailFolder] || [], mine).filter(thread => { const messages = state.messages.filter(message => messageThreadId(message) === thread.id); const latest = thread.messages.at(-1), participant = latest.sender.id === mine ? latest.recipient : latest.sender; return `${participant.nome} ${latest.subject} ${messages.map(message => message.body).join(' ')}`.toLowerCase().includes(query); }).map(thread => thread.id); }
function toggleMailThreadSelection(threadId, checked) { const selected = new Set(state.selectedMailThreadIds); checked ? selected.add(threadId) : selected.delete(threadId); state.selectedMailThreadIds = [...selected]; render({ preserveScroll: true }); }
function toggleAllMailThreads(checked) { const selected = new Set(state.selectedMailThreadIds); visibleMailThreadIds().forEach(threadId => checked ? selected.add(threadId) : selected.delete(threadId)); state.selectedMailThreadIds = [...selected]; render({ preserveScroll: true }); }
function selectedMailMessages() { const selected = new Set(state.selectedMailThreadIds); return state.messages.filter(message => selected.has(messageThreadId(message)) && visibleMessageForMe(message, state.user.id)); }
async function markSelectedMailRead() { const messages = selectedMailMessages().filter(message => message.recipient.id === state.user.id && !message.readAt && !message.recipientDeletedAt); if (!messages.length) { toast('As conversas selecionadas já foram lidas.'); return; } try { await Promise.all(messages.map(message => api(`/api/messages/${message.id}/read`, { method: 'PUT' }))); state.selectedMailThreadIds = []; await load({ silent: true }); toast('Conversas marcadas como lidas.'); } catch (error) { toast(error.message); } }
async function deleteSelectedMailThreads() { const messages = selectedMailMessages(); if (!messages.length) return; const count = state.selectedMailThreadIds.length; if (!await confirmDialog({ title: 'Mover conversas para Apagadas', message: `${count} conversa${count === 1 ? '' : 's'} será${count === 1 ? '' : 'ão'} movida${count === 1 ? '' : 's'} para Apagadas.`, confirmLabel: 'Mover conversas', destructive: true })) return; try { await Promise.all(messages.map(message => api(`/api/messages/${message.id}`, { method: 'DELETE' }))); state.selectedMailThreadIds = []; await load({ silent: true }); toast('Conversas movidas para Apagadas.'); } catch (error) { toast(error.message); } }
async function archiveSelectedMailThreads() { const messages = selectedMailMessages(); if (!messages.length) return; try { await Promise.all(messages.map(message => api(`/api/messages/${message.id}/archive`, { method: 'PUT' }))); state.selectedMailThreadIds = []; await load({ silent: true }); toast('Conversas arquivadas.'); } catch (error) { toast(error.message); } }
async function restoreSelectedMailThreads() { const messages = selectedMailMessages(); if (!messages.length) return; try { await Promise.all(messages.map(message => api(`/api/messages/${message.id}/restore`, { method: 'PUT' }))); state.selectedMailThreadIds = []; await load({ silent: true }); toast('Conversas restauradas.'); } catch (error) { toast(error.message); } }
async function readThread(threadId) { const unreadMessages = state.messages.filter(message => messageThreadId(message) === threadId && message.recipient.id === state.user.id && !message.readAt && !message.recipientDeletedAt); try { await Promise.all(unreadMessages.map(async message => { await api(`/api/messages/${message.id}/read`, { method: 'PUT' }); message.readAt = new Date().toISOString(); })); state.unreadMessages = unreadCount(state.messages); knownUnreadMessageIds = new Set(state.messages.filter(message => message.recipient.id === state.user.id && !message.readAt && !message.recipientDeletedAt).map(message => message.id)); } catch (error) { toast(error.message); } state.modal = { type: 'mail-thread', threadId }; render(); }
async function deleteMail(id) { if (!await confirmDialog({ title: 'Mover para Apagadas', message: 'A mensagem será removida da sua caixa atual.', confirmLabel: 'Mover mensagem', destructive: true })) return; try { await api(`/api/messages/${id}`, { method: 'DELETE' }); closeModal(true); await load(); toast('Mensagem movida para Apagadas.'); } catch (error) { toast(error.message); } }
function collectPermissions(form) { const permissions = {}; for (const resource of Object.keys(modules)) { const list = form.get(`permission-${resource}-list`) === 'on', create = form.get(`permission-${resource}-create`) === 'on', update = form.get(`permission-${resource}-update`) === 'on', consult = form.get(`permission-${resource}-consult`) === 'on', remove = form.get(`permission-${resource}-delete`) === 'on'; if (list || create || update || consult || remove) permissions[resource] = { list, create, update, consult, delete: remove }; } return permissions; }
async function saveUser(event) { event.preventDefault(); const form = new FormData(event.target), data = Object.fromEntries(form); data.permissions = collectPermissions(form); try { await api('/api/users', { method: 'POST', body: JSON.stringify(data) }); closeModal(true); await load(); toast('Usuário criado.'); } catch (error) { toast(error.message); } }
async function savePreRegistration(event) { event.preventDefault(); try { await api('/api/users/pre-cadastro', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); closeModal(true); await load(); toast('Pré-cadastro criado.'); } catch (error) { toast(error.message); } }
async function savePermissions(event, id) { event.preventDefault(); try { await api(`/api/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions: collectPermissions(new FormData(event.target)) }) }); closeModal(true); await load(); toast('Permissões atualizadas.'); } catch (error) { toast(error.message); } }
async function resetUserPassword(event, id) { event.preventDefault(); const form = new FormData(event.target); const password = form.get('password'); if (password !== form.get('passwordConfirmation')) { releasePendingAction(); return toast('As senhas temporárias não coincidem.'); } try { await api(`/api/users/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }); closeModal(true); await load(); toast('Senha redefinida. O usuário deverá trocá-la no próximo acesso.'); } catch (error) { toast(error.message); } }
async function setUserActive(id, active) { const action = active ? 'ativar' : 'desativar'; if (!await confirmDialog({ title: `${active ? 'Ativar' : 'Desativar'} usuário`, message: `Deseja ${action} este usuário?`, confirmLabel: active ? 'Ativar usuário' : 'Desativar usuário', destructive: !active })) return; try { await api(`/api/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ active }) }); await load(); toast(`Usuário ${active ? 'ativado' : 'desativado'}.`); } catch (error) { toast(error.message); } }
async function approveUser(id) { if (!await confirmDialog({ title: 'Ativar cadastro', message: 'O colaborador passará a ter acesso à Central T.I.', confirmLabel: 'Ativar cadastro' })) return; try { await api(`/api/users/${id}/approve`, { method: 'PUT', body: '{}' }); await load(); toast('Cadastro ativado.'); } catch (error) { toast(error.message); } }
async function changeOwnPassword(event) { event.preventDefault(); try { await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); state.user.mustChangePassword = false; toast('Senha atualizada com sucesso.'); load(); } catch (error) { toast(error.message); } }
async function createBackup() { try { const result = await api('/api/backups', { method: 'POST' }); toast(result.message || 'Backup criado.'); } catch (error) { toast(error.message); } }
async function openHistory(resource, id) { try { const result = await api(`/api/resources/${resource}/${id}/history`); const lines = result.logs.map(log => `${formatDate(log.createdAt)} — ${log.userName || 'Usuário'}: ${log.action}`).join('\n'); alert(lines || 'Ainda não há movimentações registradas.'); } catch (error) { toast(error.message); } }
async function download(url, name) {
  beginPendingAction(document.activeElement, { label: 'Exportando…' });
  try {
    const response = await fetch(url, { headers: { authorization: `Bearer ${state.token}` } });
    if (!response.ok) return toast('Falha na exportação.');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(await response.blob());
    link.download = name;
    link.click();
    URL.revokeObjectURL(link.href);
  } catch (error) {
    toast(error.message || 'Falha na exportação.');
  } finally {
    releasePendingAction();
  }
}
function exportResource(resource) { download(`/api/resources/${resource}/export`, `central-ti-${resource}.csv`); }
function exportReport() { const query = new URLSearchParams(); if (state.start) query.set('start', state.start); if (state.end) query.set('end', state.end); for (const [key, value] of Object.entries(state.exclusionFilters)) if (value) query.set(`exclusion${key[0].toUpperCase()}${key.slice(1)}`, value); for (const [key, values] of Object.entries(state.demandReportFilters)) for (const value of values) query.append(`demand${key[0].toUpperCase()}${key.slice(1)}`, value); download(`/api/reports/export?${query}`, 'relatorio-central-ti.csv'); }
async function finishLogin(result) { state.token = result.token; state.user = result.user; state.pending = null; knownUnreadMessageIds = null; localStorage.setItem(TOKEN, state.token); const me = await api('/api/me'); state.networkUrls = me.networkUrls || []; load(); }
async function authenticate(event) { event.preventDefault(); try { const result = await api('/api/auth/login', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); if (result.requiresVerification) { state.pending = result; render(); return; } await finishLogin(result); } catch (error) { toast(error.message); } }
function flipAuthCard(updateView, backwards = false) {
  const card = document.querySelector('.login-card');
  if (!card || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    updateView();
    render();
    return;
  }
  card.classList.add(backwards ? 'auth-flip-out-back' : 'auth-flip-out');
  setTimeout(() => {
    updateView();
    render();
    const nextCard = document.querySelector('.login-card');
    if (!nextCard) return;
    nextCard.classList.add(backwards ? 'auth-flip-in-back' : 'auth-flip-in');
    requestAnimationFrame(() => requestAnimationFrame(() => nextCard.classList.remove('auth-flip-in', 'auth-flip-in-back')));
  }, 360);
}
function continueLogin(event) {
  event.preventDefault();
  const identifier = String(new FormData(event.target).get('email') || '').trim();
  if (!identifier) { releasePendingAction(); return; }
  releasePendingAction();
  flipAuthCard(() => {
    state.loginIdentifier = identifier;
    state.loginStep = 'password';
  });
}
function backToLoginIdentifier() {
  flipAuthCard(() => { state.loginStep = 'identifier'; }, true);
}
function startFirstAccess() { flipAuthCard(() => { state.firstAccess = {}; }); }
function cancelFirstAccess() { flipAuthCard(() => { state.firstAccess = null; state.loginStep = 'identifier'; }, true); }
function forgotPassword() { toast('Solicite ao administrador da Central TI a redefinição da sua senha.'); }
function toggleSidebar() {
  sidebarCollapsed = !sidebarCollapsed;
  localStorage.setItem('central-ti-sidebar-collapsed', String(sidebarCollapsed));
  applySidebarChrome();
}
function toggleColorTheme() {
  colorTheme = colorTheme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('central-ti-theme', colorTheme);
  applyColorTheme();
}
async function identifyFirstAccess(event) { event.preventDefault(); try { state.firstAccess = await api('/api/first-access/identify', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); render(); } catch (error) { toast(error.message); } }
async function completeFirstAccess(event) { event.preventDefault(); try { await api('/api/first-access/complete', { method: 'POST', body: JSON.stringify({ ...Object.fromEntries(new FormData(event.target)), token: state.firstAccess.token }) }); state.firstAccess = null; render(); toast('Cadastro enviado. Aguarde a ativação do administrador.'); } catch (error) { toast(error.message); } }
async function verifyCode(event) { event.preventDefault(); try { const result = await api('/api/auth/verify-email', { method: 'POST', body: JSON.stringify({ verificationToken: state.pending.verificationToken, code: new FormData(event.target).get('code') }) }); await finishLogin(result); } catch (error) { toast(error.message); } }
function cancelCode() { state.pending = null; render(); }
async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} state.token = null; state.user = null; state.pending = null; knownUnreadMessageIds = null; state.loginStep = 'identifier'; state.loginIdentifier = ''; localStorage.removeItem(TOKEN); render(); }
function dismissToast(toastElement) { if (!toastElement?.isConnected) return; if (prefersReducedMotion()) { toastElement.remove(); return; } toastElement.classList.add('is-closing'); setTimeout(() => toastElement.remove(), 160); }
function toast(message) { $('.toast')?.remove(); const toastElement = document.createElement('div'); toastElement.className = 'toast'; toastElement.setAttribute('role', 'status'); toastElement.setAttribute('aria-live', 'polite'); toastElement.textContent = message; document.body.append(toastElement); setTimeout(() => dismissToast(toastElement), 3500); }
function confirmDialog({ title = 'Confirmar ação', message = '', confirmLabel = 'Confirmar', destructive = false } = {}) {
  return new Promise(resolve => {
    document.querySelector('.system-confirmation')?.remove();
    const dialog = document.createElement('div');
    dialog.className = 'system-confirmation';
    dialog.innerHTML = `<section class="system-confirmation-card" role="alertdialog" aria-modal="true" aria-labelledby="system-confirmation-title"><div class="system-confirmation-icon" aria-hidden="true">${destructive ? '!' : '✓'}</div><div><h2 id="system-confirmation-title">${esc(title)}</h2><p>${esc(message)}</p></div><div class="system-confirmation-actions"><button type="button" class="secondary">Cancelar</button><button type="button" class="${destructive ? 'danger-confirm' : 'add-record'}">${esc(confirmLabel)}</button></div></section>`;
    const finish = async answer => { await waitForSurfaceExit(dialog); dialog.remove(); resolve(answer); };
    const [cancelButton, confirmButton] = dialog.querySelectorAll('button');
    cancelButton.addEventListener('click', () => finish(false));
    confirmButton.addEventListener('click', () => finish(true));
    dialog.addEventListener('click', event => { if (event.target === dialog) finish(false); });
    document.body.append(dialog);
    confirmButton.focus();
  });
}
async function boot() { if (!state.token) return render(); try { const me = await api('/api/me'); state.user = me.user; state.networkUrls = me.networkUrls || []; load(); } catch { state.token = null; localStorage.removeItem(TOKEN); render(); } }
