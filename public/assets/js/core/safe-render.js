(function registerSafeRender(root) {
  function escapeAttribute(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[char]));
  }

  function dataAttribute(name, value) {
    if (!/^[a-z][a-z0-9-]*$/i.test(name)) throw new Error('Nome de atributo de dados inválido.');
    return `data-${name}="${escapeAttribute(value)}"`;
  }

  const api = { escapeAttribute, dataAttribute };
  root.CentralTiSafeRender = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof window === 'undefined' ? globalThis : window);
