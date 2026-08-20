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
    const values = [...new Set(state.records.map(record => record[key]).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), 'pt-BR'));
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
applyPasswordMinimum();
applySidebarChrome();
applyColorTheme();
setInterval(refreshInBackground, 4000);
window.addEventListener('focus', refreshInBackground);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshInBackground(); });
boot();
