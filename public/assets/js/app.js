const $ = (selector, root = document) => root.querySelector(selector);
const TOKEN = 'central-ti-token';
const KIT = ['Computador', 'Monitor', 'Teclado', 'Mouse', 'Leitor de cartão', 'Fone'];
const modules = {
  demandas: { name: 'Demandas', icon: '✓', fields: [['titulo', 'Demanda', 'Resumo da demanda'], ['tipo', 'Tipo', 'interna,externa'], ['solicitante', 'Solicitante', 'Nome do solicitante'], ['categoria', 'Categoria', 'DEMAND_CATEGORY'], ['outroDetalhe', 'Informe o que é', 'DEMAND_OTHER'], ['tecnicoResponsavel', 'Técnico responsável', 'TECHNICIAN'], ['prioridade', 'Prioridade', 'Baixa,Média,Alta,Crítica'], ['prazoSla', 'Prazo / SLA', 'DATE_OPTIONAL'], ['status', 'Status', 'DEMAND_STATUS'], ['descricao', 'Descrição da demanda externa (opcional)', 'OPTIONAL_TEXTAREA']] },
  materiais: { name: 'Materiais disponíveis na T.I.', icon: '◫', fields: [['item', 'Item', 'Nome do material'], ['categoria', 'Categoria', 'Ex.: Periféricos'], ['quantidade', 'Quantidade disponível', '0'], ['localizacao', 'Onde está guardado', 'Ex.: Armário da T.I.']] },
  programas: { name: 'Controle de Programas', icon: '◫', fields: [['programa', 'Programa / serviço', 'Nome do programa'], ['fornecedor', 'Fornecedor', 'Empresa contratada'], ['dataContratacao', 'Data da contratação', 'DATE_REQUIRED'], ['formaPagamento', 'Forma de pagamento', 'Cartão,Boleto,PIX,Transferência,Outro'], ['periodicidade', 'Periodicidade', 'Mensal,Anual'], ['dataRenovacao', 'Próxima renovação', 'DATE_REQUIRED'], ['valor', 'Valor da cobrança', 'CURRENCY'], ['status', 'Status', 'Ativo,Em renovação,Cancelado']] },
  equipamentos: { name: 'Controle de Equipamentos', icon: '◉', fields: [['patrimonio', 'Patrimônio', 'Código ou etiqueta'], ['equipamento', 'Equipamento', 'Nome do equipamento'], ['categoriaEquipamento', 'Subgrupo', 'Periférico,Computador,Notebook,Totem,Impressora'], ['numeroSerie', 'Número de série', 'OPTIONAL'], ['ip', 'IP do equipamento', 'Ex.: 192.168.1.25'], ['responsavel', 'Responsável', 'USER'], ['localizacao', 'Localização', 'Setor / sala'], ['condicao', 'Status', 'Em uso,Devolvido,Em manutenção'], ['avaliacao', 'Avaliação', 'Bom,Ruim,Precisa de manutenção,Troca necessária'], ['dataRetirada', 'Data de retirada', 'DATE_OPTIONAL'], ['dataDevolucao', 'Data de devolução', 'DATE_OPTIONAL']] },
  ramais: { name: 'Ramais', icon: '☎', fields: [['ramal', 'Ramal', 'Ex.: 204'], ['setor', 'Categoria / setor', 'RAMAL_SECTOR'], ['responsavel', 'Responsável', 'USER'], ['email', 'E-mail', 'OPTIONAL_EMAIL'], ['status', 'Ativação', 'Ativo,Inativo'], ['funcionamento', 'Funcionamento', 'Bom funcionamento,Com falha,Em manutenção']] },
  redes: { name: 'Redes', icon: '⌁', fields: [['nome', 'Nome da rede', 'Nome da rede'], ['senha', 'Senha', 'PASSWORD_REQUIRED'], ['localizacao', 'Localização', 'Setor / rack'], ['status', 'Status', 'Ativa,Inativa,Em manutenção']] },
  patrimonio: { name: 'Patrimônio', icon: '◇', fields: [['codigo', 'Código', 'Código patrimonial'], ['produto', 'Produto', 'Nome do produto'], ['descricao', 'Descrição', 'Descrição do item'], ['localizacao', 'Localização', 'Setor / sala'], ['situacao', 'Situação', 'Em uso,Disponível,Em manutenção,Baixado']] }
};
const DEMAND_CATEGORIES = {
  Software: [
    'RealClinic — Login / Acesso',
    'RealClinic — Exclusão de pagamento particular',
    'RealClinic — Exclusão de fatura',
    'RealClinic — Exclusão de atendimento',
    'RealClinic — Alterar convênio',
    'RealClinic — Incluir procedimento',
    'RealClinic — Atualizar valor de procedimento',
    'RealClinic — Atualizar taxa',
    'RealClinic — Incluir profissional',
    'RealClinic — Abrir chamado TDSA',
    'RealClinic — Relatório',
    'RealClinic — Movimentação de estoque',
    'RealClinic — Atualizar tabela',
    'IPTell — Bot',
    'IPTell — Login / Acesso',
    'Site do hospital'
  ],
  Hardware: ['Computador', 'Fone', 'Impressora', 'Tomografia', 'Raio X', 'Etiquetadora', 'Scanner'],
  'Impressão': ['Toner', 'Etiqueta'],
  Telefonia: ['Telefones', 'Ramais', 'MicroSIP'],
  Outros: []
};
const normalizeDemandText = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const isExclusionRequest = value => normalizeDemandText(value).includes('exclusao');
const EXCLUSION_REASON_CATEGORIES = ['Atendimento duplicado', 'Paciente incorreto', 'Procedimento incorreto', 'Convênio incorreto', 'Guia/autorização incorreta', 'Lançamento por engano', 'Cadastro duplicado', 'Exame/procedimento duplicado', 'Outros'];
const DEMAND_DETAIL_RULES = [
  { subjects: ['atualizar taxa', 'atualizar valor de procedimento'], title: 'Dados para atualização', fields: [['codigoProcedimento', 'Código do procedimento', 'Ex.: 10101012'], ['convenio', 'Convênio', 'Informe o convênio'], ['valorProcedimento', 'Valor', 'R$ 0,00']] },
  { subjects: ['incluir procedimento'], title: 'Dados do procedimento', fields: [['valorProcedimento', 'Valor', 'R$ 0,00'], ['tuss', 'TUSS', 'Código TUSS']] },
  { subjects: ['atualizar tabela'], title: 'Dados da tabela', fields: [['convenio', 'Convênio', 'Informe o convênio'], ['tabela', 'Tabela', 'Informe a tabela']] }
];
const RAMAL_SECTORS = ['Administrativo', 'Atendimento', 'Auditoria', 'Centro Cirúrgico', 'Compras', 'Contabilidade', 'Enfermagem', 'Farmácia', 'Faturamento', 'Financeiro', 'Internação', 'Laboratório', 'Recepção', 'Recursos Humanos', 'T.I.', 'Tomografia', 'Raio X', 'Outros'];
const moduleFilters = {
  materiais: [['categoria', 'Categoria']],
  programas: [['status', 'Status'], ['periodicidade', 'Periodicidade']],
  equipamentos: [['categoriaEquipamento', 'Subgrupo'], ['condicao', 'Status'], ['responsavel', 'Responsável'], ['localizacao', 'Localização']],
  ramais: [['setor', 'Categoria / setor'], ['status', 'Ativação'], ['funcionamento', 'Funcionamento']],
  redes: [['status', 'Status'], ['localizacao', 'Localização']],
  patrimonio: [['situacao', 'Situação'], ['localizacao', 'Localização']]
};
const state = { token: localStorage.getItem(TOKEN), user: null, page: 'dashboard', records: [], users: [], messages: [], unreadMessages: 0, dashboard: null, report: null, reportTab: 'overview', exclusionFilters: {}, statuses: ['Aberta', 'Em andamento', 'Concluída'], computerGroups: ['Geral', 'Faturamento', 'Eletivas', 'Laboratório'], locations: null, query: '', start: '', end: '', networkUrls: [], modal: null, pending: null, firstAccess: null, loginStep: 'identifier', loginIdentifier: '', loading: false, formDirty: false, newDemandType: null, programStatus: '', programPeriodicity: '', resourceFilters: {}, ramalOrder: 'asc', mailFolder: 'inbox', selectedMessageId: null, mailQuery: '' };
let navigationRequest = 0;
let sidebarCollapsed = localStorage.getItem('central-ti-sidebar-collapsed') === 'true';
let colorTheme = localStorage.getItem('central-ti-theme') === 'light' ? 'light' : 'dark';
const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
const formatDate = value => new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const formatSla = value => value ? new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : '';
const formatCurrency = cents => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(cents || 0) / 100);
function formatCurrencyInput(input) { const digits = input.value.replace(/\D/g, ''); input.value = digits ? formatCurrency(Number(digits)) : ''; }
const role = value => ({ admin: 'Administrador', ti: 'Equipe de TI', recepcao: 'Recepção', consulta: 'Consulta' })[value] || value;
const permission = (resource, action) => { if (state.user?.perfil === 'admin') return true; const permissions = state.user?.permissions; const value = permissions?.[resource]; if (value) { const legacyRead = value.read !== false; return Boolean(value[action] ?? (action === 'list' || action === 'consult' ? legacyRead : action === 'create' || action === 'update' ? value.write : false)); } if (permissions && Object.keys(permissions).length) return false; return state.user?.perfil === 'ti' || (state.user?.perfil === 'consulta' && (action === 'list' || action === 'consult')); };
const canWrite = resource => permission(resource, 'create') || permission(resource, 'update');
const canRead = resource => permission(resource, 'list');
const canDelete = resource => permission(resource, 'delete');
const canCreate = resource => permission(resource, 'create');
const canUpdate = resource => permission(resource, 'update');
async function api(url, options = {}) {
  const response = await fetch(url, { ...options, headers: { ...(options.body ? { 'content-type': 'application/json' } : {}), ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Não foi possível concluir a operação.');
  return data;
}
function tag(value) { const text = String(value || ''), normalized = text.toLowerCase(); const kind = /(bom|ativo|online|operacional|concluída|disponível|em uso)/.test(normalized) ? 'success' : /(ruim|manutenção|média|andamento|renovação)/.test(normalized) ? 'warning' : /(troca|crítica|alta|offline|indisponível|baixado|cancelado)/.test(normalized) ? 'danger' : ''; return `<span class="tag ${kind}">${esc(text)}</span>`; }
function demandCardControl(card) {
  if (!canUpdate('demandas')) return '';
  if (!card.tecnicoResponsavel) return `<button class="card-details" onclick="event.stopPropagation();openDemandDetails('${card.id}')">Ver detalhes</button>`;
  return `<select onclick="event.stopPropagation()" onchange="moveDemand('${card.id}',this.value)">${state.statuses.map(option => `<option ${option === card.status ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select>`;
}
function nav(id, label, icon, count = 0) { return `<button class="${state.page === id ? 'active' : ''}" onclick="go('${id}')"><span class="nav-icon">${icon}</span><span class="label">${label}</span>${count ? `<b class="nav-badge" style="margin-left:auto;min-width:18px;height:18px;padding:0 5px;border-radius:9px;display:grid;place-items:center;background:#ef5a62;color:#fff;font-size:10px;line-height:1">${count > 99 ? '99+' : count}</b>` : ''}</button>`; }
function sidebar() { const links = Object.entries(modules).filter(([id]) => id !== 'demandas' && id !== 'computadores' && canRead(id)).map(([id, module]) => nav(id, module.name, module.icon)).join(''); const demandLinks = canRead('demandas') ? (state.user?.perfil === 'admin' ? `${nav('demandas-internas', 'Demandas Internas (T.I.)', '✓')}${nav('demandas-externas', 'Demandas Hospital', '✓')}` : nav('demandas-externas', 'Demandas Hospital', '✓')) : ''; return `<aside class="sidebar"><div class="brand-lockup"><div class="brand-mark">✦</div><span>Central TI</span></div><nav class="nav"><div class="nav-section">PAINEL</div>${nav('dashboard', 'Visão geral', '⌘')}${state.user?.perfil === 'admin' ? nav('relatorios', 'Relatórios', '▤') : ''}${canRead('equipamentos') ? nav('localizacao', 'Localizar equipamentos', '⌖') : ''}<div class="nav-section">GESTÃO</div>${demandLinks}${links}${state.user.perfil === 'admin' ? `<div class="nav-section">ACESSOS</div>${nav('usuarios', 'Usuários', '♙')}` : ''}<div class="nav-section">COMUNICAÇÃO</div>${nav('email', 'E-mail interno', '✉', state.unreadMessages)}</nav><div class="user-box"><div class="avatar">${esc(state.user.nome.slice(0, 2).toUpperCase())}</div><div><div class="user-name">${esc(state.user.nome)}</div><div class="user-role">${esc(role(state.user.perfil))}</div></div><button class="logout" onclick="logout()">↪</button></div></aside>`; }
function header(title, subtitle) { return `<div class="topbar"><div><div class="eyebrow">${esc(subtitle || 'Central TI')}</div><h1 class="page-title">${esc(title)}</h1></div></div>`; }
function dashboard() { const d = state.dashboard || { notifications: [], announcements: [], activeCount: 0, openDemands: 0, inbox: 0 }, notifications = d.notifications || []; return `${header('Visão geral', `Olá, ${state.user.nome}`)}<section class="metrics">${[['Ativos cadastrados', d.activeCount, '▣'], ['Demandas abertas', d.openDemands, '✓'], ['Alertas técnicos', notifications.length, '⚠'], ['Mensagens não lidas', d.inbox, '✉']].map(item => `<div class="metric"><div class="metric-head"><div class="metric-name">${item[0]}</div><div class="metric-icon">${item[2]}</div></div><div class="metric-number">${item[1]}</div></div>`).join('')}</section>${notifications.length ? `<section class="dashboard-grid"><div class="panel"><div class="panel-heading"><div><h3>Notificações técnicas</h3><div class="panel-subtitle">Itens que exigem atenção</div></div></div><div class="demand-list">${notifications.map(note => `<div class="demand"><span class="status ${note.avaliacao === 'Troca necessária' ? 'critical' : 'wait'}"></span><div><div class="demand-title">${esc(note.titulo)} · ${tag(note.avaliacao)}</div><div class="demand-meta">${esc(note.detalhe)}</div></div></div>`).join('')}</div></div><div class="panel"><div class="panel-heading"><div><h3>Acesso pela rede</h3><div class="panel-subtitle">Compartilhe com sua equipe</div></div></div><div class="network-box">${state.networkUrls.map(url => `<code>${esc(url)}</code>`).join('') || 'Endereço não identificado.'}<p>Os dados são compartilhados entre todos os usuários da Central TI.</p></div></div></section>` : ''}<section class="panel announcements"><div class="panel-heading"><div><h3>Comunicados da T.I.</h3><div class="panel-subtitle">Informações importantes para todos os usuários</div></div>${state.user?.perfil === 'admin' ? '<button class="add-record" onclick="openAnnouncement()">+ Comunicado</button>' : ''}</div><div class="announcement-list">${(d.announcements || []).map(item => `<article class="announcement"><div><h4>${esc(item.title)}</h4><p>${esc(item.body).replace(/\n/g, '<br/>')}</p><small>Por ${esc(item.authorName)} · ${formatDate(item.createdAt)}</small></div>${state.user?.perfil === 'admin' ? `<button class="danger-link" onclick="deleteAnnouncement('${item.id}')">Remover</button>` : ''}</article>`).join('') || '<div class="empty">Nenhum comunicado publicado.</div>'}</div></section>`; }
function locationPage() { const data = state.locations || { groups: [], records: [] }; const records = data.records.filter(record => Object.values(record).join(' ').toLowerCase().includes(state.query.toLowerCase())); return `${header('Localizar equipamentos', 'Busca por IP, patrimônio, subgrupo ou setor')}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" oninput="setSearch(this.value)" placeholder="Ex.: 192.168.2.25, PC-0048 ou Computador"/></div><section class="location-groups">${data.groups.map(item => `<button onclick="setSearch('${esc(item.group)}')"><b>${esc(item.group)}</b><span>${item.total} item(ns)</span></button>`).join('')}</section><div class="panel table-panel">${records.length ? `<table class="data-table"><thead><tr><th>Patrimônio</th><th>IP</th><th>Subgrupo</th><th>Localização</th><th>Responsável</th><th>Status</th></tr></thead><tbody>${records.map(record => `<tr><td><b>${esc(record.patrimonio)}</b></td><td><code>${esc(record.ip)}</code></td><td>${tag(record.grupo)}</td><td>${esc(record.localizacao)}</td><td>${esc(record.responsavel)}</td><td>${tag(record.status)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum equipamento encontrado.</div>'}</div>`; }
function demandBoard() { const cards = state.records.filter(record => String(record.titulo || '').toLowerCase().includes(state.query.toLowerCase())); return `${header('Demandas', 'Quadro de trabalho')}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" oninput="setSearch(this.value)" placeholder="Pesquisar demanda..."/><div class="toolbar-actions">${canWrite('demandas') ? `<button class="secondary" onclick="openStatusManager()">⚙ Status</button><button class="add-record" onclick="openRecord('demandas')">+ Abrir chamado</button>` : ''}</div></div><div class="kanban">${state.statuses.map((status, index) => `<section class="kanban-column" ondragover="event.preventDefault()" ondrop="dropDemand(event,'${esc(status)}')"><header><span class="kanban-dot dot-${index % 4}"></span><b>${esc(status)}</b><small>${cards.filter(card => card.status === status).length}</small></header><div class="kanban-cards">${cards.filter(card => card.status === status).map(card => `<article class="demand-card" draggable="true" onclick="openDemandDetails('${card.id}')" ondragstart="dragDemand(event,'${card.id}')"><div class="demand-card-title">${esc(card.titulo)}</div><div class="demand-card-meta">${esc(card.solicitante)}</div><div class="demand-card-bottom">${tag(card.prioridade)}${demandCardControl(card)}</div></article>`).join('') || '<div class="kanban-empty">Arraste uma demanda para cá</div>'}</div></section>`).join('')}</div>`; }
function filteredDemandBoard(type) {
  const external = type === 'externa';
  const cards = state.records.filter(record => (record.tipo || 'interna') === type && String(record.titulo || '').toLowerCase().includes(state.query.toLowerCase()));
  const title = external ? 'Demandas Hospital' : 'Demandas Internas';
  const subtitle = external ? 'Hospital · solicitações de setores externos' : 'T.I. · atividades internas da equipe';
  return `${header(title, subtitle)}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" oninput="setSearch(this.value)" placeholder="Pesquisar demanda..."/><div class="toolbar-actions">${canUpdate('demandas') ? `<button class="secondary" onclick="openStatusManager()">⚙ Status</button>` : ''}${canCreate('demandas') ? `<button class="add-record" onclick="openDemand('${type}')">+ Abrir chamado</button>` : ''}</div></div><div class="kanban">${state.statuses.map((status, index) => `<section class="kanban-column" ondragover="event.preventDefault()" ondrop="dropDemand(event,'${esc(status)}')"><header><span class="kanban-dot dot-${index % 4}"></span><b>${esc(status)}</b><small>${cards.filter(card => card.status === status).length}</small></header><div class="kanban-cards">${cards.filter(card => card.status === status).map(card => `<article class="demand-card" onclick="openDemandDetails('${card.id}')" ${canUpdate('demandas') ? 'draggable="true" ondragstart="dragDemand(event,\'' + card.id + '\')"' : ''}><div class="demand-card-code">${esc(card.ticket || 'TI')}</div><div class="demand-card-title">${esc(card.titulo)}</div><div class="demand-card-meta">${esc(card.categoria || 'Sem categoria')} · ${esc(card.tecnicoResponsavel || 'Sem técnico')}</div><div class="demand-card-meta">${esc(card.solicitante)}${external ? ` · ${esc(card.empresa || 'Hospital')}` : ''}${card.prazoSla ? ` · SLA: ${esc(card.prazoSla.split('-').reverse().join('/'))}` : ''}</div><div class="demand-card-bottom">${tag(card.prioridade)}${demandCardControl(card)}</div></article>`).join('') || '<div class="kanban-empty">Arraste uma demanda para cá</div>'}</div></section>`).join('')}</div>`;
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
  return `${header(module.name, 'Gestão')}<div class="section-toolbar"><input class="search" value="${esc(state.query)}" oninput="setSearch(this.value)" placeholder="${placeholder}"/>${resource === 'programas' ? `<select onchange="setProgramFilter('programStatus',this.value)"><option value="">Todos os status</option>${['Ativo','Em renovação','Cancelado'].map(value => `<option ${state.programStatus === value ? 'selected' : ''}>${value}</option>`).join('')}</select><select onchange="setProgramFilter('programPeriodicity',this.value)"><option value="">Mensal e anual</option>${['Mensal','Anual'].map(value => `<option ${state.programPeriodicity === value ? 'selected' : ''}>${value}</option>`).join('')}</select>` : ''}<div class="toolbar-actions"><button class="secondary" onclick="exportResource('${resource}')">⇩ Exportar CSV</button>${resource === 'computadores' && canUpdate(resource) ? `<button class="secondary" onclick="openGroupManager()">⚙ Grupos</button>` : ''}${canCreate(resource) ? `<button class="add-record" onclick="openRecord('${resource}')">+ Novo cadastro</button>` : ''}</div></div><div class="panel table-panel">${rows.length ? `<table class="data-table"><thead><tr>${columns}${resource === 'computadores' ? '<th>Checklist</th>' : ''}<th>Ações</th></tr></thead><tbody>${rows.map(record => `<tr>${module.fields.map(field => `<td>${cell(record, field)}</td>`).join('')}${resource === 'computadores' ? `<td>${record.checklist?.length ? `✓ ${record.checklist.length}/${KIT.length}` : '—'}</td>` : ''}<td>${canUpdate(resource) ? `<button class="link-button" onclick="openRecord('${resource}','${record.id}')">Editar</button>` : ''}${canDelete(resource) ? ` <button class="danger-link" onclick="deleteRecord('${resource}','${record.id}')">Excluir</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Nenhum registro encontrado.</div>'}</div>`;
}
function reportTable(title, rows, empty = 'Sem dados no período.') { return `<section class="panel report-table"><div class="panel-heading"><h3>${esc(title)}</h3></div>${rows.length ? `<table class="data-table"><tbody>${rows.map(row => `<tr><td>${esc(row.label)}</td><td><b>${row.total}</b></td></tr>`).join('')}</tbody></table>` : `<div class="empty">${esc(empty)}</div>`}</section>`; }
function reportBreakdown(title, rows) { return reportTable(title, rows); }
function reportOverview(report, materialCount) {
  const exclusions = report.exclusions || { total: 0, pending: 0, completed: 0 };
  const demandTotal = report.demandStatus.reduce((total, item) => total + item.total, 0);
  const open = report.demandStatus.filter(item => /abert|pendente/i.test(item.status)).reduce((total, item) => total + item.total, 0);
  const inProgress = report.demandStatus.filter(item => /andamento|atendi|execuc/i.test(item.status)).reduce((total, item) => total + item.total, 0);
  const completed = report.demandStatus.filter(item => /conclu|finaliz|resolvid|encerr/i.test(item.status)).reduce((total, item) => total + item.total, 0);
  const cards = [['◫', 'Total de registros', report.total], ['✓', 'Demandas abertas', open], ['◷', 'Em atendimento', inProgress], ['★', 'Demandas concluídas', completed], ['⌫', 'Exclusões pendentes', exclusions.pending], ['⚠', 'Alertas técnicos', report.alerts.length]];
  const chart = [['Abertas', open], ['Em atendimento', inProgress], ['Concluídas', completed], ['Exclusões', exclusions.total], ['Materiais', materialCount]];
  const maximum = Math.max(1, ...chart.map(([, total]) => total));
  return `<section class="overview-metrics">${cards.map(([icon, label, total]) => `<article class="overview-metric"><span class="overview-metric-icon">${icon}</span><div><div>${esc(label)}</div><b>${total}</b></div></article>`).join('')}</section><section class="panel overview-chart"><div class="panel-heading"><div><h3>Visão operacional</h3><div class="panel-subtitle">Distribuição consolidada do período - ${demandTotal} demanda(s).</div></div></div><div class="overview-bars">${chart.map(([label, total]) => `<div class="overview-bar"><div><i style="height:${Math.max(4, Math.round(total / maximum * 100))}%"></i></div><b>${total}</b><span>${esc(label)}</span></div>`).join('')}</div></section><div class="report-grid">${reportTable('Cadastros por módulo', report.modules.map(item => ({ label: modules[item.resource]?.name || item.resource, total: item.total })))}${reportTable('Demandas por status', report.demandStatus.map(item => ({ label: item.status, total: item.total })))}<section class="panel"><div class="panel-heading"><h3>Alertas técnicos</h3></div>${report.alerts.length ? `<table class="data-table"><tbody>${report.alerts.map(item => `<tr><td>${esc(item.item)}</td><td>${tag(item.avaliacao)}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem alertas no período.</div>'}</section><section class="panel"><div class="panel-heading"><h3>Power BI</h3></div><div class="empty">Use a exportação CSV/Excel para conectar os dados consolidados e detalhados ao Power BI.</div></section></div>`;
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
function reportPage() { const report = state.report || { modules: [], alerts: [], demandStatus: [], total: 0, exclusions: { total: 0, completed: 0, pending: 0, declined: 0, users: [], sectors: [], types: [], reasons: [], statuses: [], months: [], recurring: [], records: [], filters: {} }, audit: [] }; const materialCount = report.modules.find(item => item.resource === 'materiais')?.total || 0; const tabs = [['overview', 'Visão Geral'], ['demands', 'Demandas'], ['exclusions', 'Exclusões'], ['inventory', 'Inventário'], ['materials', 'Materiais'], ['audit', 'Auditoria']]; const content = state.reportTab === 'exclusions' ? exclusionReportPage(report.exclusions) : state.reportTab === 'demands' ? `<section class="metrics">${report.demandStatus.map(item => `<div class="metric"><div class="metric-name">${esc(item.status)}</div><div class="metric-number">${item.total}</div></div>`).join('')}</section>${reportTable('Demandas por status', report.demandStatus.map(item => ({ label: item.status, total: item.total })) )}` : state.reportTab === 'inventory' ? `<div class="report-grid">${reportTable('Inventário por módulo', report.modules.filter(item => ['computadores', 'equipamentos', 'patrimonio', 'ramais', 'redes'].includes(item.resource)).map(item => ({ label: modules[item.resource]?.name || item.resource, total: item.total })))}${reportTable('Alertas técnicos', report.alerts.map(item => ({ label: `${item.item} · ${item.avaliacao}`, total: 1 })) )}</div>` : state.reportTab === 'materials' ? `<section class="metrics"><div class="metric"><div class="metric-name">Materiais cadastrados</div><div class="metric-number">${materialCount}</div></div></section>${reportTable('Materiais disponíveis na T.I.', report.modules.filter(item => item.resource === 'materiais').map(item => ({ label: 'Itens cadastrados', total: item.total })) )}` : state.reportTab === 'audit' ? `<section class="panel table-panel"><div class="panel-heading"><h3>Auditoria do período</h3></div>${report.audit?.length ? `<table class="data-table"><thead><tr><th>Data / hora</th><th>Usuário</th><th>Ação</th><th>Módulo</th></tr></thead><tbody>${report.audit.map(item => `<tr><td>${item.createdAt ? esc(formatDate(item.createdAt)) : '—'}</td><td>${esc(item.userName || 'Usuário removido')}</td><td>${esc(item.action || '—')}</td><td>${esc(item.resource || 'Sistema')}</td></tr>`).join('')}</tbody></table>` : '<div class="empty">Sem registros de auditoria no período.</div>'}</section>` : reportOverview(report, materialCount); return `${header('Relatórios', 'Análise e auditoria')}<div class="report-actions"><label>De<input type="date" value="${esc(state.start)}" onchange="setPeriod(this.value,state.end)"/></label><label>Até<input type="date" value="${esc(state.end)}" onchange="setPeriod(state.start,this.value)"/></label><button class="secondary" onclick="exportReport()">⇩ CSV / Excel</button><button class="add-record" onclick="window.print()">🖨 Gerar PDF</button></div><nav class="report-tabs">${tabs.map(([id, label]) => `<button class="${state.reportTab === id ? 'active' : ''}" onclick="setReportTab('${id}')">${esc(label)}</button>`).join('')}</nav>${content}`; }
function emailPage() { const mine = state.user.id, folders = { inbox: state.messages.filter(message => message.recipient.id === mine && !message.recipientDeletedAt), sent: state.messages.filter(message => message.sender.id === mine && !message.senderDeletedAt), trash: state.messages.filter(message => (message.recipient.id === mine && message.recipientDeletedAt) || (message.sender.id === mine && message.senderDeletedAt)) }; const labels = { inbox: 'Caixa de entrada', sent: 'Enviadas', trash: 'Apagadas' }; const icons = { inbox: '✉', sent: '↗', trash: '♲' }; const unread = folders.inbox.filter(message => !message.readAt).length; const filtered = folders[state.mailFolder].filter(message => `${message.sender.nome} ${message.recipient.nome} ${message.subject} ${message.body}`.toLowerCase().includes(state.mailQuery.toLowerCase())); return `${header('E-mail interno', 'Comunicação entre usuários')}<section class="webmail"><aside class="mail-folders"><button class="compose-button" onclick="compose()">✎ <span>Escrever</span></button>${[['inbox', unread], ['sent', folders.sent.length], ['trash', folders.trash.length]].map(([folder, count]) => `<button class="folder ${state.mailFolder === folder ? 'active' : ''}" onclick="setMailFolder('${folder}')"><span>${icons[folder]} ${labels[folder]}</span><b>${count || ''}</b></button>`).join('')}<div class="mail-note">Mensagens internas são entregues diretamente aos usuários cadastrados.</div></aside><section class="mail-list panel"><div class="mail-list-tools"><input value="${esc(state.mailQuery)}" oninput="setMailSearch(this.value)" placeholder="Pesquisar mensagens"/><button class="icon-btn" title="Atualizar" onclick="load()">↻</button></div><div class="mail-list-title">${labels[state.mailFolder]} <span>${filtered.length}</span></div>${filtered.map(message => `<button class="mail-item ${!message.readAt && message.recipient.id === mine ? 'unread' : ''}" onclick="readMessage('${message.id}')"><span class="mail-avatar">${esc((message.sender.id === mine ? message.recipient.nome : message.sender.nome).slice(0, 1).toUpperCase())}</span><span class="mail-item-content"><span class="mail-item-top"><b>${esc(message.sender.id === mine ? `Para: ${message.recipient.nome}` : message.sender.nome)}</b><time>${formatDate(message.createdAt)}</time></span><span class="mail-subject">${esc(message.subject)}</span><span class="mail-preview">${esc(message.body)}</span></span></button>`).join('') || '<div class="empty">Nenhuma mensagem nesta caixa.</div>'}</section></section>`; }
function usersPage() { return `${header('Usuários', 'Acessos e permissões')}<div class="section-toolbar"><button class="secondary" onclick="createBackup()">▣ Gerar backup</button><div class="toolbar-actions"><button class="secondary" onclick="openPreRegistration()">+ Pré-cadastro</button><button class="add-record" onclick="openUser()">+ Novo usuário</button></div></div><div class="panel table-panel"><table class="data-table"><thead><tr><th>Nome</th><th>E-mail / Login</th><th>Setor</th><th>Acesso</th><th>Segurança</th><th>Ações</th></tr></thead><tbody>${state.users.map(user => `<tr><td>${esc(user.nome)}</td><td>${esc(user.email || user.login || 'Ainda não informado')}</td><td>${esc(user.setor || role(user.perfil))}</td><td>${tag(user.activationStatus === 'pre-cadastro' ? 'Pré-cadastro' : user.activationStatus === 'aguardando aprovação' ? 'Aguardando aprovação' : user.active === false ? 'Desativado' : 'Ativo')}</td><td>${user.mustChangePassword ? tag('Troca de senha pendente') : tag('Senha configurada')}</td><td>${user.activationStatus === 'aguardando aprovação' ? `<button class="add-record" onclick="approveUser('${user.id}')">Ativar cadastro</button> ` : ''}${user.id === state.user.id ? '<span class="muted">Seu usuário</span>' : `<button class="link-button" onclick="openPermissions('${user.id}')">Permissões</button> <button class="${user.active === false ? 'link-button' : 'danger-link'}" onclick="setUserActive('${user.id}',${user.active === false})">${user.active === false ? 'Ativar' : 'Desativar'}</button>`}</td></tr>`).join('')}</tbody></table></div>`; }
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
  if (source === 'OPTIONAL_TEXTAREA') { const locked = key === 'descricao' && record ? 'readonly aria-readonly="true"' : ''; const lockedStyle = locked ? 'background:#f5f7fa;color:#536273;cursor:not-allowed;' : ''; const creator = record && key === 'descricao' ? (state.users.find(user => user.id === record.createdBy)?.nome || record.solicitante || 'Usuário não informado') : ''; const createdInfo = creator ? `<small style="display:block;margin-top:7px;color:#65758a;font-size:12px">Solicitação registrada por <b>${esc(creator)}</b>${record.createdAt ? ` em ${formatDate(record.createdAt)}` : ''}.</small>` : ''; return `<label class="field">${label}<textarea name="${key}" rows="3" maxlength="3000" placeholder="Informe detalhes adicionais, se necessário" ${locked} style="resize:none;overflow-y:auto;${lockedStyle}">${esc(value)}</textarea>${createdInfo}</label>`; }
  if (source === 'OPTIONAL' || source === 'OPTIONAL_EMAIL') return `<label class="field">${label}<input name="${key}" ${source === 'OPTIONAL_EMAIL' ? 'type="email"' : ''} maxlength="250" value="${esc(value)}" placeholder="Não informado"/></label>`;
  if (source === 'DATE_OPTIONAL') return `<label class="field">${label}<input type="date" name="${key}" value="${esc(value)}"/></label>`;
  if (source === 'DATE_REQUIRED') return `<label class="field">${label}<input type="date" name="${key}" value="${esc(value)}" required/></label>`;
  if (source === 'CURRENCY') return `<label class="field">${label}<input name="${key}" required inputmode="numeric" value="${value ? esc(formatCurrency(value)) : ''}" placeholder="R$ 0,00" oninput="formatCurrencyInput(this)"/></label>`;
  if (source === 'EMAIL_REQUIRED') return `<label class="field">${label}<input type="email" name="${key}" value="${esc(value)}" required maxlength="250"/></label>`;
  if (source === 'PASSWORD_REQUIRED') return `<label class="field">${label}<input type="text" name="${key}" value="${esc(value)}" required maxlength="250" autocomplete="off"/></label>`;
  if (key === 'quantidade') return `<label class="field">${label}<input type="number" name="${key}" required min="0" step="1" value="${esc(value)}" placeholder="0"/></label>`;
  if (source === 'USER') return `<label class="field">${label}<select name="${key}" required><option value="">Selecione</option>${state.users.map(user => `<option ${user.nome === value ? 'selected' : ''}>${esc(user.nome)}</option>`).join('')}</select></label>`;
  if (source === 'RAMAL_SECTOR') { const existing = state.records.filter(item => item.setor).map(item => item.setor); const options = [...new Set([...RAMAL_SECTORS, ...existing])].sort((a, b) => a.localeCompare(b, 'pt-BR')); return `<label class="field">${label}<select name="${key}" required><option value="">Selecione o setor</option>${options.map(option => `<option ${option === value ? 'selected' : ''}>${esc(option)}</option>`).join('')}</select></label>`; }
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
  const demandField = (key, label) => { const definition = modules.demandas.fields.find(item => item[0] === key); return field([key, label || definition[1], definition[2]], record); };
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
  return `<div class="modal-backdrop" onclick="closeBack(event)"><section class="modal ticket-details-modal"><div class="modal-header ticket-details-head"><div><span class="ticket-reference">${esc(record.ticket || 'Chamado')}</span><h2>${esc(record.titulo)}</h2></div><button type="button" class="close" onclick="closeModal(true)">×</button></div><div class="ticket-details-layout"><main><section class="ticket-description"><h3>Descrição enviada pelo solicitante</h3><p>${esc(record.descricao || 'Nenhuma descrição informada.').replace(/\n/g, '<br/>')}</p></section><section class="ticket-activity"><h3>Atividade</h3><div class="ticket-conversation">${interactions.length ? interactions.map(item => `<article class="ticket-comment ${item.autorId === state.user.id ? 'mine' : ''}"><div class="comment-avatar">${esc((item.autorNome || 'U').slice(0, 2).toUpperCase())}</div><div><header><b>${esc(item.autorNome || 'Usuário')}</b><time>${formatDate(item.criadoEm)}</time></header><p>${esc(item.texto).replace(/\n/g, '<br/>')}</p></div></article>`).join('') : '<div class="ticket-no-comments">Ainda não há comentários. Envie a primeira resposta abaixo.</div>'}</div><form class="ticket-reply" onsubmit="sendDemandComment(event,'${record.id}')"><textarea name="text" required maxlength="3000" rows="3" placeholder="Adicionar comentário..."></textarea><button class="primary">Responder</button></form></section></main><aside class="ticket-information"><h3>Informações da demanda</h3><dl>${information}</dl>${canUpdate('demandas') && !record.tecnicoResponsavel && !/conclu|finaliz|resolvid|encerr/i.test(String(record.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')) ? `<button class="primary ticket-assume" onclick="assignDemandToMe('${record.id}')">Assumir chamado</button>` : ''}${canUpdate('demandas') ? `<button class="secondary ticket-edit" onclick="openRecord('demandas','${record.id}')">Editar chamado</button>` : ''}</aside></div></section></div>`;
}
function modal() { if (!state.modal) return ''; if (state.modal.type === 'demand-details') return demandDetailsModal(state.modal.record); if (state.modal.type === 'record') { const resource = state.modal.resource, record = state.modal.record, module = modules[resource]; if (resource === 'demandas') return demandModal(record); return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal modal-wide" onsubmit="saveRecord(event,'${resource}','${record?.id || ''}')"><div class="modal-header"><h2>${record ? 'Editar' : 'Novo cadastro'} · ${module.name}</h2><button type="button" class="close" onclick="closeModal()">×</button></div>${resource === 'computadores' ? '<p class="modal-intro">Cadastre o IP para localizar a máquina na rede. As datas são opcionais e registram o ciclo de solicitação, entrega e devolução.</p>' : ''}<div class="two-col">${module.fields.map(item => field(item, record)).join('')}</div>${resource === 'computadores' ? `<fieldset class="checklist"><legend>Checklist do kit entregue</legend><div class="checklist-grid">${KIT.map(item => `<label class="check-item"><input type="checkbox" name="checklist" value="${item}" ${(record?.checklist || []).includes(item) ? 'checked' : ''}/><span>✓</span>${item}</label>`).join('')}</div></fieldset>` : ''}<div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Salvar</button></div></form></div>`; }
  if (state.modal.type === 'pre-registration') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="savePreRegistration(event)"><div class="modal-header"><h2>Pré-cadastro de colaborador</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p class="modal-intro">A pessoa fará o primeiro acesso usando primeiro nome e CPF. Depois completará os próprios dados e aguardará sua ativação.</p><label class="field">Nome completo<input name="nome" required maxlength="120"/></label><label class="field">CPF<input name="cpf" required inputmode="numeric" maxlength="14" placeholder="000.000.000-00"/></label><label class="field">Setor<input name="setor" required maxlength="120" placeholder="Ex.: Auditoria Faturamento"/></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Criar pré-cadastro</button></div></form></div>`;
  if (state.modal.type === 'computer-groups') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="saveComputerGroups(event)"><div class="modal-header"><h2>Grupos de computadores</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p class="modal-intro">Cadastre os grupos que organizam as máquinas, como Faturamento, Eletivas e Laboratório. Grupos em uso não podem ser removidos.</p><div id="group-fields">${state.computerGroups.map(group => `<label class="status-editor"><input name="group" value="${esc(group)}" required maxlength="50"/><button type="button" onclick="this.parentElement.remove()">×</button></label>`).join('')}</div><button type="button" class="secondary" onclick="addComputerGroup()">+ Adicionar grupo</button><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Salvar grupos</button></div></form></div>`;
  if (state.modal.type === 'statuses') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="saveStatuses(event)"><div class="modal-header"><h2>Status das demandas</h2><button type="button" class="close" onclick="closeModal()">×</button></div><p class="modal-intro">Edite as colunas. Status com demandas não podem ser removidos.</p><div id="status-fields">${state.statuses.map(status => `<label class="status-editor"><input name="status" value="${esc(status)}" required maxlength="50"/><button type="button" onclick="this.parentElement.remove()">×</button></label>`).join('')}</div><button type="button" class="secondary" onclick="addStatus()">+ Adicionar status</button><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Salvar status</button></div></form></div>`;
  if (state.modal.type === 'announcement') return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="saveAnnouncement(event)"><div class="modal-header"><h2>Novo comunicado</h2><button type="button" class="close" onclick="closeModal()">×</button></div><label class="field">Título<input name="title" required maxlength="120" placeholder="Ex.: Manutenção programada"/></label><label class="field">Comunicado<textarea name="body" required rows="7" maxlength="2000" placeholder="Escreva a informação que todos devem visualizar."></textarea></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Publicar</button></div></form></div>`;
  if (state.modal.type === 'mail') { const reply = state.modal.reply; return `<div class="modal-backdrop" onclick="closeBack(event)"><form class="modal" onsubmit="sendMail(event)"><div class="modal-header"><h2>${reply ? 'Responder mensagem' : 'Nova mensagem interna'}</h2><button type="button" class="close" onclick="closeModal()">×</button></div><label class="field">Para<select name="recipientId" required><option value="">Selecione</option>${state.users.filter(user => user.id !== state.user.id).map(user => `<option value="${user.id}" ${user.id === reply?.recipientId ? 'selected' : ''}>${esc(user.nome)} · ${esc(user.email)}</option>`).join('')}</select></label><label class="field">Assunto<input name="subject" required maxlength="160" value="${esc(reply?.subject || '')}"/></label><label class="field">Mensagem<textarea name="body" required rows="6" maxlength="5000" autofocus></textarea></label><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal()">Cancelar</button><button class="primary">Enviar</button></div></form></div>`; }
  if (state.modal.type === 'mail-read') { const message = state.messages.find(item => item.id === state.modal.messageId); if (!message) return ''; const mine = state.user.id, trashed = (message.recipient.id === mine && message.recipientDeletedAt) || (message.sender.id === mine && message.senderDeletedAt); const canReply = message.sender.id !== mine && !trashed; return `<div class="modal-backdrop" onclick="closeBack(event)"><section class="modal modal-wide mail-message-modal"><div class="modal-header"><div><h2>${esc(message.subject)}</h2><p class="modal-intro">${message.sender.id === mine ? `Para: ${esc(message.recipient.nome)}` : `De: ${esc(message.sender.nome)}`} · ${formatDate(message.createdAt)}</p></div><button type="button" class="close" onclick="closeModal(true)">×</button></div><article class="mail-body">${esc(message.body).replace(/\n/g, '<br/>')}</article><div class="modal-actions"><button type="button" class="secondary" onclick="closeModal(true)">Fechar</button>${canReply ? `<button type="button" class="secondary" onclick="replyMail('${message.id}')">↩ Responder</button>` : ''}${trashed ? '' : `<button type="button" class="danger-link" onclick="deleteMail('${message.id}')">Mover para apagadas</button>`}</div></section></div>`; }
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
function render({ preserveScroll = false } = {}) { const previousContent = preserveScroll ? document.querySelector('#app .content') : null; const scrollTop = previousContent?.scrollTop || 0; if (!state.token || !state.user) { $('#app').innerHTML = loginPage(); return; } if (state.user.mustChangePassword) { $('#app').innerHTML = passwordPage(); return; } const page = state.loading ? '<div class="loading">Atualizando dados…</div>' : state.page === 'dashboard' ? dashboard() : state.page === 'demandas' ? demandBoard() : state.page === 'demandas-internas' ? filteredDemandBoard('interna') : state.page === 'demandas-externas' ? filteredDemandBoard('externa') : state.page === 'relatorios' ? reportPage() : state.page === 'email' ? emailPage() : state.page === 'usuarios' ? usersPage() : state.page === 'localizacao' ? locationPage() : recordsPage(state.page); $('#app').innerHTML = `<div class="shell">${sidebar()}<main class="content">${page}</main></div>${modal()}`; if (preserveScroll) document.querySelector('#app .content')?.scrollTo({ top: scrollTop }); }
function unreadCount(messages) { return messages.filter(message => message.recipient?.id === state.user?.id && !message.readAt && !message.recipientDeletedAt).length; }
async function refreshUnreadMessages(renderWhenChanged = false) { if (!state.token || !state.user) return false; try { const mail = await api('/api/messages'); const unread = unreadCount(mail.messages || []); const changed = state.unreadMessages !== unread; if (changed) { state.unreadMessages = unread; if (renderWhenChanged && !state.modal && !state.formDirty && !state.loading) render(); } return changed; } catch (_) { return false; /* A atualização do aviso não deve interromper a tela atual. */ } }
function dataSnapshot() { const dashboard = state.dashboard ? { ...state.dashboard } : null; if (dashboard) delete dashboard.generatedAt; return JSON.stringify({ dashboard, records: state.records, users: state.users, messages: state.messages, report: state.report, statuses: state.statuses, locations: state.locations, unreadMessages: state.unreadMessages }); }
async function load(options = {}) {
  const silent = Boolean(options.silent);
  const requestId = options.requestId ?? navigationRequest;
  const requestedPage = state.page;
  const before = silent ? dataSnapshot() : '';
  const isCurrentRequest = () => requestId === navigationRequest && requestedPage === state.page;

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
      const [records, statuses, users] = await Promise.all([api('/api/resources/demandas'), api('/api/demand-statuses'), api('/api/users')]);
      if (!isCurrentRequest()) return;
      state.records = records.records;
      state.statuses = statuses.statuses;
      state.users = users.users;
    } else if (requestedPage === 'relatorios') {
      const params = new URLSearchParams();
      if (state.start) params.set('start', state.start);
      if (state.end) params.set('end', state.end);
      for (const [key, value] of Object.entries(state.exclusionFilters)) if (value) params.set(`exclusion${key[0].toUpperCase()}${key.slice(1)}`, value);
      const report = await api(`/api/reports?${params}`);
      if (!isCurrentRequest()) return;
      state.report = report;
    } else if (requestedPage === 'email') {
      const [mail, users] = await Promise.all([api('/api/messages'), api('/api/users')]);
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
      const [records, users] = await Promise.all([api(`/api/resources/${requestedPage}`), api('/api/users')]);
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
function setProgramFilter(field, value) { state[field] = value; render(); }
function setResourceFilter(resource, key, value) { state.resourceFilters[`${resource}-${key}`] = value; render(); }
function toggleRamalOrder() { state.ramalOrder = state.ramalOrder === 'asc' ? 'desc' : 'asc'; render(); }
function setPeriod(start, end) { state.start = start; state.end = end; load(); }
function setReportTab(tab) { state.reportTab = tab; render(); }
function setExclusionFilter(field, value) { state.exclusionFilters[field] = value; load(); }
function openRecord(resource, id = '') {
  state.formDirty = false;
  state.newDemandType = null;
  state.modal = { type: 'record', resource, record: id ? state.records.find(record => record.id === id) : null };
  render();
  addObservationField();
  if (resource === 'computadores') api('/api/computer-groups').then(result => { if (state.modal?.type === 'record' && state.modal.resource === 'computadores' && !state.formDirty) { state.computerGroups = result.groups; render(); addObservationField(); } }).catch(error => toast(error.message));
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
  if (!text) return;
  const button = form.querySelector('button');
  button.disabled = true;
  try {
    await api(`/api/resources/demandas/${id}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
    await openDemandDetails(id);
    await refreshUnreadMessages(true);
    toast('Resposta enviada e participantes notificados.');
  } catch (error) {
    button.disabled = false;
    toast(error.message);
  }
}
async function assignDemandToMe(id) {
  const button = document.querySelector('.ticket-assume');
  if (button) button.disabled = true;
  try {
    await api(`/api/resources/demandas/${id}/assign-self`, { method: 'PUT', body: '{}' });
    await openDemandDetails(id);
    toast('Chamado atribuído a você.');
  } catch (error) {
    if (button) button.disabled = false;
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
function permissionTable(current) { const actions = [['list','Listar'],['create','Incluir'],['update','Alterar'],['consult','Consultar'],['delete','Excluir']]; return `<fieldset class="permission-table"><legend>Permissões por módulo</legend><p class="modal-intro">Marque somente os módulos e ações que este usuário poderá utilizar. Módulos sem permissão não aparecem para ele.</p><div class="permission-scroll"><table><thead><tr><th>Módulo</th><th>Todos</th>${actions.map(([,label]) => `<th>${label}</th>`).join('')}</tr></thead><tbody>${Object.entries(modules).map(([id, module]) => { const value = current[id]; const legacy = value ? value.read !== false : false; const checked = action => { if (!value) return false; return action === 'list' || action === 'consult' ? value[action] ?? legacy : value[action] ?? value.write ?? false; }; return `<tr><td><b>${esc(module.name)}</b></td><td><input type="checkbox" class="permission-all" data-resource="${id}" onchange="toggleAllPermissions('${id}',this.checked)" ${actions.every(([action]) => checked(action)) ? 'checked' : ''}/></td>${actions.map(([action]) => `<td><input type="checkbox" name="permission-${id}-${action}" ${checked(action) ? 'checked' : ''} onchange="syncPermissionAll('${id}')"/></td>`).join('')}</tr>`; }).join('')}</tbody></table></div></fieldset>`; }
function openUser() { state.modal = { type: 'user' }; render(); }
function openPreRegistration() { state.modal = { type: 'pre-registration' }; render(); }
function openPermissions(id) { const user = state.users.find(item => item.id === id); if (!user) return; state.modal = { type: 'permissions', user }; render(); }
function toggleAllPermissions(resource, checked) { document.querySelectorAll(`[name^="permission-${resource}-"]`).forEach(input => { input.checked = checked; }); }
function syncPermissionAll(resource) { const inputs = [...document.querySelectorAll(`[name^="permission-${resource}-"]`)]; const all = document.querySelector(`.permission-all[data-resource="${resource}"]`); if (all) { all.checked = inputs.every(input => input.checked); all.indeterminate = !all.checked && inputs.some(input => input.checked); } }
async function compose() { if (!state.users.length) state.users = (await api('/api/users')).users; state.modal = { type: 'mail' }; render(); }
function openAnnouncement() { state.modal = { type: 'announcement' }; state.formDirty = false; render(); }
async function saveAnnouncement(event) { event.preventDefault(); try { await api('/api/announcements', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); closeModal(true); await load(); toast('Comunicado publicado para todos.'); } catch (error) { toast(error.message); } }
async function deleteAnnouncement(id) { if (!confirm('Remover este comunicado para todos os usuários?')) return; try { await api(`/api/announcements/${id}`, { method: 'DELETE' }); await load(); toast('Comunicado removido.'); } catch (error) { toast(error.message); } }
async function replyMail(id) { const message = state.messages.find(item => item.id === id); if (!message) return; if (!state.users.length) state.users = (await api('/api/users')).users; state.modal = { type: 'mail', reply: { recipientId: message.senderId, subject: message.subject.startsWith('Re:') ? message.subject : `Re: ${message.subject}` } }; state.formDirty = false; render(); }
function closeModal(force = false) { if (!force && state.formDirty && !confirm('Há dados não salvos. Deseja fechar mesmo assim?')) return; state.modal = null; state.formDirty = false; state.newDemandType = null; render(); }
function closeBack(event) { /* O fundo do modal não fecha formulários: evita perda de dados digitados. */ }
async function saveRecord(event, resource, id) { event.preventDefault(); const form = new FormData(event.target), data = Object.fromEntries(form); const observation = event.target.querySelector('[name="novaObservacao"]'); if (observation) data.novaObservacao = observation.value.trim(); if (resource === 'computadores') data.checklist = form.getAll('checklist'); try { await api(`/api/resources/${resource}${id ? `/${id}` : ''}`, { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) }); closeModal(true); if (state.page.startsWith('demandas-')) await go(state.page); else await load(); toast('Cadastro salvo.'); } catch (error) { toast(error.message); } }
async function deleteRecord(resource, id) { if (!confirm('Excluir este registro?')) return; try { await api(`/api/resources/${resource}/${id}`, { method: 'DELETE' }); await load(); toast('Registro excluído.'); } catch (error) { toast(error.message); } }
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
async function moveDemand(id, status) { const demand = state.records.find(record => record.id === id); if (!demand || demand.status === status) return; if (!demand.tecnicoResponsavel) { await openDemandDetails(id); return toast('Veja as informações e assuma o chamado antes de alterar o status.'); } try { await api(`/api/resources/demandas/${id}`, { method: 'PUT', body: JSON.stringify({ ...demand, status }) }); if (state.page.startsWith('demandas-')) await go(state.page); else await load(); toast(`Demanda movida para ${status}.`); } catch (error) { toast(error.message); } }
async function saveStatuses(event) { event.preventDefault(); const statuses = new FormData(event.target).getAll('status').map(value => value.trim()).filter(Boolean); try { const result = await api('/api/demand-statuses', { method: 'PUT', body: JSON.stringify({ statuses }) }); state.statuses = result.statuses; closeModal(true); await load(); toast('Status atualizados.'); } catch (error) { toast(error.message); } }
async function saveComputerGroups(event) { event.preventDefault(); const groups = new FormData(event.target).getAll('group').map(value => value.trim()).filter(Boolean); try { const result = await api('/api/computer-groups', { method: 'PUT', body: JSON.stringify({ groups }) }); state.computerGroups = result.groups; closeModal(true); toast('Grupos atualizados.'); } catch (error) { toast(error.message); } }
async function sendMail(event) { event.preventDefault(); try { await api('/api/messages', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); closeModal(true); await load(); toast('Mensagem enviada.'); } catch (error) { toast(error.message); } }
function setMailFolder(folder) { state.mailFolder = folder; state.selectedMessageId = null; state.mailQuery = ''; render(); }
function setMailSearch(value) { state.mailQuery = value; state.selectedMessageId = null; render(); const input = document.querySelector('.mail-list-tools input'); if (input) { input.focus(); input.setSelectionRange(value.length, value.length); } }
async function readMessage(id) { const message = state.messages.find(item => item.id === id); if (message?.recipient.id === state.user.id && !message.readAt) { try { await api(`/api/messages/${id}/read`, { method: 'PUT' }); message.readAt = new Date().toISOString(); state.unreadMessages = unreadCount(state.messages); } catch (error) { toast(error.message); } } state.modal = { type: 'mail-read', messageId: id }; render(); }
async function deleteMail(id) { if (!confirm('Mover esta mensagem para Apagadas?')) return; try { await api(`/api/messages/${id}`, { method: 'DELETE' }); closeModal(true); await load(); toast('Mensagem movida para Apagadas.'); } catch (error) { toast(error.message); } }
function collectPermissions(form) { const permissions = {}; for (const resource of Object.keys(modules)) { const list = form.get(`permission-${resource}-list`) === 'on', create = form.get(`permission-${resource}-create`) === 'on', update = form.get(`permission-${resource}-update`) === 'on', consult = form.get(`permission-${resource}-consult`) === 'on', remove = form.get(`permission-${resource}-delete`) === 'on'; if (list || create || update || consult || remove) permissions[resource] = { list, create, update, consult, delete: remove }; } return permissions; }
async function saveUser(event) { event.preventDefault(); const form = new FormData(event.target), data = Object.fromEntries(form); data.permissions = collectPermissions(form); try { await api('/api/users', { method: 'POST', body: JSON.stringify(data) }); closeModal(true); await load(); toast('Usuário criado.'); } catch (error) { toast(error.message); } }
async function savePreRegistration(event) { event.preventDefault(); try { await api('/api/users/pre-cadastro', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); closeModal(true); await load(); toast('Pré-cadastro criado.'); } catch (error) { toast(error.message); } }
async function savePermissions(event, id) { event.preventDefault(); try { await api(`/api/users/${id}/permissions`, { method: 'PUT', body: JSON.stringify({ permissions: collectPermissions(new FormData(event.target)) }) }); closeModal(true); await load(); toast('Permissões atualizadas.'); } catch (error) { toast(error.message); } }
async function setUserActive(id, active) { const action = active ? 'ativar' : 'desativar'; if (!confirm(`Deseja ${action} este usuário?`)) return; try { await api(`/api/users/${id}/active`, { method: 'PUT', body: JSON.stringify({ active }) }); await load(); toast(`Usuário ${active ? 'ativado' : 'desativado'}.`); } catch (error) { toast(error.message); } }
async function approveUser(id) { if (!confirm('Ativar este cadastro para acesso ao sistema?')) return; try { await api(`/api/users/${id}/approve`, { method: 'PUT', body: '{}' }); await load(); toast('Cadastro ativado.'); } catch (error) { toast(error.message); } }
async function changeOwnPassword(event) { event.preventDefault(); try { await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(Object.fromEntries(new FormData(event.target))) }); state.user.mustChangePassword = false; toast('Senha atualizada com sucesso.'); load(); } catch (error) { toast(error.message); } }
async function createBackup() { try { const result = await api('/api/backups', { method: 'POST' }); toast(result.message || 'Backup criado.'); } catch (error) { toast(error.message); } }
async function openHistory(resource, id) { try { const result = await api(`/api/resources/${resource}/${id}/history`); const lines = result.logs.map(log => `${formatDate(log.createdAt)} — ${log.userName || 'Usuário'}: ${log.action}`).join('\n'); alert(lines || 'Ainda não há movimentações registradas.'); } catch (error) { toast(error.message); } }
async function download(url, name) { const response = await fetch(url, { headers: { authorization: `Bearer ${state.token}` } }); if (!response.ok) return toast('Falha na exportação.'); const link = document.createElement('a'); link.href = URL.createObjectURL(await response.blob()); link.download = name; link.click(); URL.revokeObjectURL(link.href); }
function exportResource(resource) { download(`/api/resources/${resource}/export`, `central-ti-${resource}.csv`); }
function exportReport() { const query = new URLSearchParams(); if (state.start) query.set('start', state.start); if (state.end) query.set('end', state.end); for (const [key, value] of Object.entries(state.exclusionFilters)) if (value) query.set(`exclusion${key[0].toUpperCase()}${key.slice(1)}`, value); download(`/api/reports/export?${query}`, 'relatorio-central-ti.csv'); }
async function finishLogin(result) { state.token = result.token; state.user = result.user; state.pending = null; localStorage.setItem(TOKEN, state.token); const me = await api('/api/me'); state.networkUrls = me.networkUrls || []; load(); }
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
  if (!identifier) return;
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
async function logout() { try { await api('/api/auth/logout', { method: 'POST' }); } catch {} state.token = null; state.user = null; state.pending = null; state.loginStep = 'identifier'; state.loginIdentifier = ''; localStorage.removeItem(TOKEN); render(); }
function toast(message) { $('.toast')?.remove(); const toastElement = document.createElement('div'); toastElement.className = 'toast'; toastElement.textContent = message; document.body.append(toastElement); setTimeout(() => toastElement.remove(), 3500); }
async function boot() { if (!state.token) return render(); try { const me = await api('/api/me'); state.user = me.user; state.networkUrls = me.networkUrls || []; load(); } catch { state.token = null; localStorage.removeItem(TOKEN); render(); } }
