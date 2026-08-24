document.addEventListener('input', event => {
  if (event.target.closest('.modal form')) state.formDirty = true;
});

document.addEventListener('change', event => {
  if (event.target.closest('.modal form')) state.formDirty = true;
});

document.addEventListener('dblclick', event => {
  const card = event.target.closest('.demand-card');
  if (!card || event.target.closest('select')) return;
  const match = card.getAttribute('ondragstart')?.match(/'([^']+)'/);
  if (match) openRecord('demandas', match[1]);
});

document.addEventListener('dragover', event => {
  const board = event.target.closest('.kanban') || activeDraggedBoard;
  if (!board) return;
  event.preventDefault();
  autoScrollKanban(event, board);
});

document.addEventListener('dragend', stopKanbanAutoScroll);
document.addEventListener('drop', stopKanbanAutoScroll);

function applyPasswordMinimum() {
  document.querySelectorAll('input[name="senha"], input[name="newPassword"]').forEach(input => {
    input.minLength = 8;
  });
  const loginForm = document.querySelector('.login-card[onsubmit="authenticate(event)"]');
  const passwordField = loginForm?.querySelector('input[name="password"]')?.closest('.field');
  if (passwordField && !loginForm.querySelector('.forgot-password')) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'forgot-password';
    button.textContent = 'Esqueceu a senha?';
    button.onclick = forgotPassword;
    passwordField.after(button);
  }
}

function applySidebarChrome() {
  const shell = document.querySelector('.shell');
  const sidebar = shell?.querySelector('.sidebar');
  if (!shell || !sidebar) return;
  shell.classList.toggle('sidebar-collapsed', sidebarCollapsed);
  let button = sidebar.querySelector('.sidebar-toggle');
  if (!button) {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'sidebar-toggle';
    button.onclick = toggleSidebar;
    sidebar.append(button);
  }
  const label = sidebarCollapsed ? 'Expandir menu' : 'Recolher menu';
  const icon = sidebarCollapsed ? '›' : '‹';
  if (button.getAttribute('aria-label') !== label) button.setAttribute('aria-label', label);
  if (button.title !== label) button.title = label;
  if (button.textContent !== icon) button.textContent = icon;
}

function applyColorTheme() {
  document.body.classList.toggle('light-theme', colorTheme === 'light');
  let control = document.querySelector('.theme-toggle');
  if (!control) {
    control = document.createElement('label');
    control.className = 'ui-switch theme-toggle';
    control.innerHTML = '<input type="checkbox"/><span class="slider"><span class="circle"></span></span>';
    control.querySelector('input').onchange = toggleColorTheme;
    document.body.append(control);
  }
  const light = colorTheme === 'light';
  const label = light ? 'Ativar modo escuro' : 'Ativar modo claro';
  const input = control.querySelector('input');
  if (input.checked !== !light) input.checked = !light;
  if (control.getAttribute('aria-label') !== label) control.setAttribute('aria-label', label);
  if (control.title !== label) control.title = label;
}

function injectResourceFilters() {
  if (state.loading || !moduleFilters[state.page]?.length) return;
  const toolbar = document.querySelector('.section-toolbar');
  const actions = toolbar?.querySelector('.toolbar-actions');
  if (!toolbar || !actions || toolbar.querySelector('.generated-module-filters')) return;
  const box = document.createElement('span');
  box.className = 'generated-module-filters';
  for (const [key, label] of moduleFilters[state.page]) {
    const values = resourceFilterValues(state.page, key);
    if (!values.length) continue;
    const select = document.createElement('select');
    select.innerHTML = `<option value="">${key === 'periodicidade' ? 'Mensal e anual' : `Todos os ${label.toLowerCase()}`}</option>${values.map(value => `<option ${state.resourceFilters[`${state.page}-${key}`] === value ? 'selected' : ''}>${esc(value)}</option>`).join('')}`;
    select.onchange = () => setResourceFilter(state.page, key, select.value);
    box.append(select);
  }
  toolbar.insertBefore(box, actions);
}

function injectProgramCosts() {
  if (state.loading || state.page !== 'relatorios' || !state.report) return;
  const metrics = document.querySelector('.report-actions + .metrics');
  if (!metrics || metrics.querySelector('.program-cost-metric')) return;
  const costs = state.report.programCosts || {};
  for (const [label, value] of [['Custo mensal estimado', costs.monthlyEquivalent], ['Custo anual estimado', costs.annualEquivalent]]) {
    const card = document.createElement('div');
    card.className = 'metric program-cost-metric';
    card.innerHTML = `<div class="metric-name">${label}</div><div class="metric-number">${formatCurrency(value)}</div>`;
    metrics.append(card);
  }
}

function injectMicroSipButtons() {
  if (state.loading || state.page !== 'ramais') return;
  document.querySelectorAll('.data-table tbody tr').forEach(row => {
    const cells = row.querySelectorAll('td');
    const extension = cells[0]?.textContent.trim() || '';
    const status = cells[4]?.textContent.trim() || '';
    const actions = cells[cells.length - 1];
    if (!actions || actions.querySelector('.dial-extension') || !/^\d{2,6}$/.test(extension)) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'dial-extension';
    button.textContent = '☎ Ligar';
    button.title = `Ligar para o ramal ${extension} pelo MicroSIP`;
    button.disabled = status !== 'Ativo';
    if (button.disabled) button.title = 'O ramal precisa estar ativo para realizar a ligação.';
    button.onclick = () => dialWithMicroSip(button, extension);
    actions.prepend(button);
  });
}

async function dialWithMicroSip(button, extension) {
  if (button.dataset.checking === 'true') return;
  button.dataset.checking = 'true';
  button.disabled = true;
  const originalLabel = button.textContent;
  button.textContent = 'Verificando...';
  try {
    const status = await api('/api/integrations/microsip/status');
    if (!status.available) {
      toast(status.message || 'MicroSIP não está instalado. Use o telefone fixo para realizar a ligação.');
      return;
    }
    if (!confirm(`Abrir o MicroSIP para ligar ao ramal ${extension}?`)) return;
    window.location.href = `centralti-microsip://call/${encodeURIComponent(extension)}`;
  } catch {
    toast('Não foi possível validar o MicroSIP. Use o telefone fixo para realizar a ligação.');
  } finally {
    button.dataset.checking = '';
    button.disabled = false;
    button.textContent = originalLabel;
  }
}

function injectPrintableReportTemplate() {
  if (state.loading || state.page !== 'relatorios') return;
  const content = document.querySelector('.content');
  const actions = content?.querySelector('.report-actions');
  if (!content || !actions || content.querySelector('.print-document-header')) return;
  const title = content.querySelector('.page-title')?.textContent.trim() || 'Relatórios';
  const activeTab = content.querySelector('.report-tabs .active')?.textContent.trim() || 'Visão Geral';
  const dates = [...actions.querySelectorAll('input[type="date"]')].map(input => input.value ? new Date(`${input.value}T12:00:00`).toLocaleDateString('pt-BR') : 'Todo o período');
  const issuedAt = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const header = document.createElement('section');
  header.className = 'print-document-header';
  header.innerHTML = `<div><b>Central TI</b><span>Hospital Dia Revitalite</span></div><div><small>DOCUMENTO CONFIDENCIAL</small><strong>${esc(title)} - ${esc(activeTab)}</strong><span>Período: ${esc(dates[0])} até ${esc(dates[1])}</span></div>`;
  const footer = document.createElement('footer');
  footer.className = 'print-document-footer';
  footer.textContent = `Central TI - Relatório emitido em ${issuedAt} - Uso interno e auditoria`;
  content.prepend(header);
  content.append(footer);
}

async function refreshInBackground() {
  if (!state.token || !state.user || state.modal || state.formDirty || state.loading || state.backgroundRefreshing) return;
  state.backgroundRefreshing = true;
  try {
    const demandPage = state.page === 'demandas' || state.page.startsWith('demandas-');
    const knownDemandIds = demandPage ? new Set(state.records.map(record => record.id)) : null;
    if (state.page === 'localizacao') await refreshUnreadMessages(true);
    else {
      await refreshUnreadMessages(false);
      await load({ silent: true });
    }
    if (knownDemandIds) {
      const incoming = state.records.filter(record => !knownDemandIds.has(record.id));
      if (incoming.length) toast(incoming.length === 1 ? `Novo chamado recebido: ${incoming[0].ticket || incoming[0].titulo}` : `${incoming.length} novos chamados recebidos.`);
    }
  } finally {
    state.backgroundRefreshing = false;
  }
}

new MutationObserver(applyPasswordMinimum).observe(document.body, { childList: true, subtree: true });
new MutationObserver(applySidebarChrome).observe($('#app'), { childList: true, subtree: true });
new MutationObserver(injectResourceFilters).observe($('#app'), { childList: true, subtree: true });
new MutationObserver(injectProgramCosts).observe($('#app'), { childList: true, subtree: true });
new MutationObserver(injectMicroSipButtons).observe($('#app'), { childList: true, subtree: true });
new MutationObserver(injectPrintableReportTemplate).observe($('#app'), { childList: true, subtree: true });
applyPasswordMinimum();
applySidebarChrome();
applyColorTheme();
injectPrintableReportTemplate();
setInterval(refreshInBackground, 4000);
window.addEventListener('focus', refreshInBackground);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshInBackground(); });
boot();
