(function registerAttachmentFeature(root) {
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
