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
  document.querySelectorAll('input[type="password"]:not([data-password-visibility])').forEach(input => {
    input.dataset.passwordVisibility = 'ready';
    const wrapper = document.createElement('span');
    wrapper.className = 'password-input-control';
    input.before(wrapper);
    wrapper.append(input);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'password-visibility-toggle';
    button.setAttribute('aria-label', 'Mostrar senha');
    button.setAttribute('aria-pressed', 'false');
    button.title = 'Mostrar senha';
    const updateVisibilityToggle = visible => {
      button.setAttribute('aria-label', visible ? 'Ocultar senha' : 'Mostrar senha');
      button.setAttribute('aria-pressed', String(visible));
      button.title = visible ? 'Ocultar senha' : 'Mostrar senha';
      button.innerHTML = visible
        ? '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.7 10.7 0 0 1 12 4.9c6.5 0 10 7.1 10 7.1a18.5 18.5 0 0 1-3.1 4.1M6.2 6.2C3.6 8.1 2 12 2 12s3.5 7.1 10 7.1c1.2 0 2.3-.2 3.3-.6"/></svg>'
        : '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.5-7.1 10-7.1S22 12 22 12s-3.5 7.1-10 7.1S2 12 2 12Zm13 0a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"/></svg>';
    };
    updateVisibilityToggle(false);
    button.addEventListener('click', () => {
      const visible = input.type === 'password';
      input.type = visible ? 'text' : 'password';
      updateVisibilityToggle(visible);
    });
    wrapper.append(button);
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

+(function registerAttachmentFeature(root) {
  const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];
  const preview = (field, file) => { field.querySelector('.mail-screenshot-preview').textContent = file ? `${file.name} · ${(file.size / 1024 / 1024).toFixed(2)} MB` : ''; };

  function addFileField(form, label, inputName, beforeActions = false) {
    if (form.querySelector(`[name="${inputName}"]`)) return;
    const field = document.createElement('label');
    field.className = `field mail-screenshot-field${inputName === 'commentScreenshot' ? ' ticket-comment-screenshot-field' : ''}`;
    field.innerHTML = `<span>${label} <small>PNG, JPG ou WEBP · até 5 MB · ou cole com Ctrl+V</small></span><input name="${inputName}" type="file" accept="image/png,image/jpeg,image/webp"/><small class="mail-screenshot-preview"></small>`;
    if (beforeActions) form.querySelector('.modal-actions')?.before(field); else form.append(field);
    field.querySelector('input').addEventListener('change', event => preview(field, event.target.files[0]));
  }

  function openScreenshot(src) {
    document.querySelector('.screenshot-lightbox')?.remove();
    const viewer = document.createElement('div');
    viewer.className = 'screenshot-lightbox';
    viewer.innerHTML = `<button type="button" class="close" aria-label="Fechar print">×</button><img alt="Print ampliado" src="${src}"/>`;
    viewer.addEventListener('click', event => { if (event.target === viewer || event.target.matches('.close')) viewer.remove(); });
    document.body.append(viewer);
  }

  async function loadMailAttachment(messageId, target, token, urls) {
    if (!target || target.dataset.loading === 'true') return;
    target.dataset.loading = 'true';
    try {
      let src = urls.get(messageId);
      if (!src) {
        const response = await fetch(`/api/messages/${messageId}/attachment`, { headers: { authorization: `Bearer ${token}` } });
        if (!response.ok) throw new Error();
        src = URL.createObjectURL(await response.blob());
        urls.set(messageId, src);
      }
      target.innerHTML = `<img class="mail-screenshot" role="button" tabindex="0" onclick="openScreenshot(this.src)" onkeydown="if(event.key==='Enter')openScreenshot(this.src)" alt="Abrir print anexado à mensagem" src="${src}"/>`;
    } catch { target.textContent = 'Não foi possível carregar o print.'; target.classList.add('attachment-error'); }
  }

  function enhanceCurrentSurface({ state, token, mailAttachmentUrls, toast }) {
    document.querySelectorAll('form[onsubmit^="sendMail"]').forEach(form => addFileField(form, 'Adicionar print', 'screenshot', true));
    document.querySelectorAll('form.demand-modal').forEach(form => addFileField(form, 'Anexo · adicionar print', 'demandScreenshot', true));
    document.querySelectorAll('form.ticket-reply').forEach(form => addFileField(form, 'Anexar print', 'commentScreenshot'));
    const record = state.modal?.type === 'demand-details' ? state.modal.record : null;
    const target = document.querySelector('.ticket-description');
    if (record?.anexoPrint?.data && allowedTypes.includes(record.anexoPrint.mime) && target && !document.querySelector('.demand-attachment')) {
      const section = document.createElement('section');
      section.className = 'demand-attachment';
      section.innerHTML = `<h3>Anexo</h3><img class="mail-screenshot" role="button" tabindex="0" onclick="openScreenshot(this.src)" onkeydown="if(event.key==='Enter')openScreenshot(this.src)" alt="Abrir print anexado à demanda" src="data:${record.anexoPrint.mime};base64,${record.anexoPrint.data}"/>`;
      target.after(section);
    }
    document.querySelectorAll('[data-mail-attachment]').forEach(target => loadMailAttachment(target.dataset.mailAttachment, target, token, mailAttachmentUrls));
    document.querySelectorAll('form[onsubmit^="sendMail"],form.demand-modal,form.ticket-reply').forEach(form => {
      if (form.dataset.screenshotPaste) return;
      const input = form.querySelector('[name="screenshot"],[name="demandScreenshot"],[name="commentScreenshot"]');
      if (!input) return;
      form.dataset.screenshotPaste = 'true';
      form.addEventListener('paste', event => {
        const file = [...(event.clipboardData?.files || [])].find(item => item.type.startsWith('image/'));
        if (!file) return;
        if (!allowedTypes.includes(file.type) || file.size > 5_000_000) return toast('Cole somente um print PNG, JPG ou WEBP de até 5 MB.');
        const transfer = new DataTransfer(); transfer.items.add(file); input.files = transfer.files; input.dispatchEvent(new Event('change')); event.preventDefault(); toast('Print colado no anexo.');
      });
    });
  }

  root.openScreenshot = openScreenshot;
  root.CentralTiAttachments = { enhanceCurrentSurface };
})(window);
