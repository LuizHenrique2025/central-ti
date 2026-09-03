function csvCell(value) {
  const text = String(value ?? '');
  const safe = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}

function csvDocument(rows) {
  return `\uFEFF${rows.map(row => row.map(csvCell).join(';')).join('\n')}`;
}

module.exports = { csvCell, csvDocument };
