const BLUE = '#2163a8';
const INK = '#243449';
const MUTED = '#526274';
const TONES = [BLUE, '#60778d', '#8d9baa', '#36485b', '#b3bec9', '#718da9'];
const hasLineBreak = value => /[\r\n\u2028\u2029]/.test(String(value));
const compactRow = row => row.every(value => String(value).length <= 160 && !hasLineBreak(value));
const FILTERS = { assignee: 'Responsável', requester: 'Solicitante', sector: 'Setor', reason: 'Motivo', category: 'Categoria', status: 'Status' };

function validateReportPdfFilters(url) {
  const invalid = message => { throw Object.assign(new Error(message), { statusCode: 400 }); };
  for (const key of ['start', 'end']) {
    const values = url.searchParams.getAll(key);
    const value = values[0];
    if (values.length > 1 || (value && (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(`${value}T12:00:00Z`)) || new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) !== value))) invalid('Informe datas válidas para o período.');
  }
  const start = url.searchParams.get('start'), end = url.searchParams.get('end');
  if (start && end && start > end) invalid('A data inicial deve ser anterior ou igual à final.');
  for (const key of Object.keys(FILTERS)) {
    const values = url.searchParams.getAll(`demand${key[0].toUpperCase()}${key.slice(1)}`);
    if (values.length > 100 || values.some(value => value.length > 500 || /[\u0000-\u001f]/.test(value))) invalid('Os filtros do relatório são inválidos.');
  }
}

function reportPdfData(demand, period, generatedAt) {
  // Indicadores e distribuições vêm do mesmo serviço usado pela tela, sem recalcular regras de conclusão.
  const months = new Map();
  for (const row of demand.openedByDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.label)) continue;
    const month = row.label.slice(0, 7);
    months.set(month, (months.get(month) || 0) + row.total);
  }
  return {
    period, generatedAt, metrics: demand.metrics, filters: demand.filters,
    requesters: new Set(demand.records.map(record => record.requester)).size,
    months: [...months].sort(([a], [b]) => a.localeCompare(b)).map(([label, total]) => ({ label, total })),
    statuses: demand.statuses, records: demand.records,
    professionals: demand.professionals.map(person => ({ ...person, completionRate: person.assumed ? Math.round(person.completed / person.assumed * 100) : 0 }))
  };
}

const date = value => value ? value.slice(0, 10).split('-').reverse().join('/') : '';
const dateTime = value => Number.isFinite(Date.parse(value)) ? new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value)) : 'Sem data';
const section = text => ({ text, style: 'section', headlineLevel: 1 });

function barsSvg(rows) {
  const max = Math.max(1, ...rows.map(row => row.total));
  const width = 500, baseline = 148, step = width / rows.length;
  const bars = rows.map((row, index) => {
    const height = row.total / max * 110, x = index * step + step * .2;
    return `<rect x="${x}" y="${baseline - height}" width="${step * .6}" height="${height}" fill="${BLUE}"/><text x="${index * step + step / 2}" y="${baseline - height - 7}" text-anchor="middle" font-size="10" fill="${INK}">${row.total}</text><text x="${index * step + step / 2}" y="166" text-anchor="middle" font-size="9" fill="${MUTED}">${row.label.slice(5)}/${row.label.slice(2, 4)}</text>`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="500" height="178"><line x1="0" y1="148" x2="500" y2="148" stroke="#d8e1eb"/>${bars}</svg>`;
}

function donutSvg(statuses, total) {
  let angle = -Math.PI / 2;
  const point = value => `${100 + 78 * Math.cos(value)} ${100 + 78 * Math.sin(value)}`;
  const shapes = statuses.map((status, index) => {
    const next = angle + status.total / total * 2 * Math.PI;
    const shape = status.total === total
      ? `<circle cx="100" cy="100" r="78" fill="${TONES[index % TONES.length]}"/>`
      : `<path d="M 100 100 L ${point(angle)} A 78 78 0 ${next - angle > Math.PI ? 1 : 0} 1 ${point(next)} Z" fill="${TONES[index % TONES.length]}"/>`;
    angle = next;
    return shape;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200">${shapes}<circle cx="100" cy="100" r="53" fill="#ffffff"/><text x="100" y="103" text-anchor="middle" font-size="25" fill="${INK}">${total}</text><text x="100" y="123" text-anchor="middle" font-size="10" fill="${MUTED}">Demandas</text></svg>`;
}

function reportTable(title, headers, rows, widths, numericColumns = []) {
  const count = headers.length;
  const cell = (value, index, heading = false) => ({ text: String(value), alignment: numericColumns.includes(index) ? 'right' : 'left', ...(heading ? { bold: true, color: BLUE, fillColor: '#eef3f8' } : {}) });
  return {
    margin: [0, 14, 0, 0], fontSize: 9,
    table: {
      headerRows: 2, keepWithHeaderRows: rows[0] && compactRow(rows[0]) ? 1 : 0, widths,
      // Linhas comuns ficam inteiras; textos excepcionalmente longos podem continuar na página seguinte.
      dontBreakRows: rows.every(compactRow),
      body: [
        [{ text: title, colSpan: count, style: 'section', margin: [0, 0, 0, 7] }, ...Array.from({ length: count - 1 }, () => ({}))],
        headers.map((header, index) => cell(header, index, true)),
        ...rows.map(row => row.map((value, index) => cell(value, index)))
      ]
    },
    layout: { hLineWidth: index => index < 2 ? 0 : .5, vLineWidth: () => 0, hLineColor: () => '#d8e1eb', paddingTop: () => 7, paddingBottom: () => 7, paddingLeft: () => 6, paddingRight: () => 6 }
  };
}

function buildReportPdfDefinition(data) {
  const { metrics } = data;
  const period = `${date(data.period.start) || 'Início dos registros'} até ${date(data.period.end) || 'a data de geração'}`;
  const filters = Object.entries(FILTERS).map(([key, label]) => `${label}: ${data.filters[key]?.join(', ') || 'Todos'}`).join(' · ');
  const content = [
    { text: 'HOSPITAL DIA REVITALITE', color: BLUE, bold: true, fontSize: 10, characterSpacing: 1 },
    { text: 'Relatório de Demandas de TI', fontSize: 23, bold: true, color: INK, margin: [0, 10, 0, 10] },
    { text: `Período: ${period}`, color: MUTED },
    { text: `Gerado em ${dateTime(data.generatedAt)} (America/Sao_Paulo)`, color: MUTED, margin: [0, 3, 0, 12] },
    { text: filters, fontSize: 9, color: MUTED, margin: [0, 0, 0, 16] },
    {
      unbreakable: true, columnGap: 12,
      columns: [
        ['Total de demandas', metrics.total, 'Registros nos filtros aplicados'],
        ['Taxa de conclusão', `${metrics.completedPercent}%`, `${metrics.completed} demandas concluídas`],
        ['Em aberto', metrics.open, 'Aguardam conclusão'],
        ['Solicitantes distintos', data.requesters, 'Pessoas na consulta']
      ].map(([label, value, hint]) => ({ width: '*', stack: [{ text: label, color: MUTED, fontSize: 9 }, { text: String(value), color: BLUE, bold: true, fontSize: 26, margin: [0, 7, 0, 5] }, { text: hint, color: MUTED, fontSize: 8 }] }))
    }
  ];
  if (!metrics.total) content.push({ text: 'Nenhuma demanda encontrada para os filtros aplicados', margin: [0, 30, 0, 20], color: MUTED });
  if (data.months.length) {
    for (let start = 0; start < data.months.length; start += 12) {
      content.push({ unbreakable: true, margin: [0, 18, 0, 0], stack: [section(`Demandas abertas por mês${start ? ' (continuação)' : ''}`), { svg: barsSvg(data.months.slice(start, start + 12)), width: 500 }] });
    }
  } else if (metrics.total) content.push({ text: 'Sem data de abertura informada para o gráfico mensal.', color: MUTED, margin: [0, 18, 0, 0] });
  if (metrics.total) {
    const statusTable = reportTable('Distribuição por status', ['Status', 'Quantidade'], data.statuses.map(status => [status.label, status.total]), ['*', 65], [1]);
    data.statuses.forEach((status, index) => { statusTable.table.body[index + 2][0].color = TONES[index % TONES.length]; });
    const chart = { svg: donutSvg(data.statuses, metrics.total), width: 150 };
    // Legendas curtas acompanham a rosca; listas extensas continuam como tabela paginada.
    if (data.statuses.length <= 8 && data.statuses.every(status => status.label.length <= 120 && !hasLineBreak(status.label))) {
      content.push({ unbreakable: true, margin: [0, 18, 0, 0], stack: [section('Demandas por status'), { columns: [{ width: 170, stack: [chart] }, { width: '*', stack: [statusTable] }], columnGap: 18 }] });
    } else {
      content.push({ unbreakable: true, margin: [0, 18, 0, 0], stack: [section('Demandas por status'), chart] }, statusTable);
    }
  }
  if (data.professionals.length) content.push(reportTable('Desempenho por profissional', ['Profissional', 'Assumidas', 'Concluídas', 'Em aberto', '% conclusão'], data.professionals.map(person => [person.professional, person.assumed, person.completed, person.open, `${person.completionRate}%`]), ['*', 60, 60, 58, 68], [1, 2, 3, 4]));
  content.push({ unbreakable: metrics.topRequester.length + metrics.topReason.length <= 1000 && !hasLineBreak(metrics.topRequester) && !hasLineBreak(metrics.topReason), margin: [0, 18, 0, 0], stack: [section('Leitura do período'), { text: [{ text: 'Solicitante com mais demandas: ', bold: true }, metrics.topRequester], margin: [0, 4, 0, 5] }, { text: [{ text: 'Motivo mais frequente: ', bold: true }, metrics.topReason], margin: [0, 0, 0, 5] }, { text: `Acompanhamento: ${metrics.open} demanda(s) em aberto nesta consulta.` }] });
  if (data.records.length) {
    const annex = reportTable('Anexo - Demandas do período', ['Nº', 'Data', 'Solicitante', 'Setor', 'Motivo', 'Status', 'Responsável'], data.records.map(record => [record.ticket, record.createdAt ? dateTime(record.createdAt) : 'Sem data', record.requester, record.sector, record.reason, record.status, record.assignee]), [38, 49, '*', 51, '*', 52, 60]);
    annex.fontSize = 8;
    annex.pageBreak = 'before';
    content.push(annex);
  }
  return {
    pageSize: 'A4', pageOrientation: 'portrait', pageMargins: [42, 40, 42, 48],
    info: { title: 'Relatório de Demandas de TI', author: 'Central TI', subject: 'Hospital Dia Revitalite' },
    defaultStyle: { font: 'Roboto', fontSize: 10, color: INK, lineHeight: 1.2 },
    styles: { section: { fontSize: 12, bold: true, color: INK, margin: [0, 0, 0, 8] } },
    footer: (page, pages) => ({ text: `Central TI · Página ${page} de ${pages}`, alignment: 'center', fontSize: 8, color: MUTED, margin: [42, 16, 42, 0] }),
    pageBreakBefore: (node, following) => node.headlineLevel === 1 && following.length === 0,
    content
  };
}

let printer;
async function generateReportPdf(demand, period, generatedAt) {
  if (!printer) {
    const PdfPrinter = require('pdfmake');
    const vfs = require('pdfmake/build/vfs_fonts');
    const font = name => Buffer.from(vfs[name], 'base64');
    printer = new PdfPrinter({ Roboto: { normal: font('Roboto-Regular.ttf'), bold: font('Roboto-Medium.ttf'), italics: font('Roboto-Italic.ttf'), bolditalics: font('Roboto-MediumItalic.ttf') } });
  }
  const definition = buildReportPdfDefinition(reportPdfData(demand, period, generatedAt));
  return new Promise((resolve, reject) => {
    const document = printer.createPdfKitDocument(definition);
    const chunks = [];
    document.on('data', chunk => chunks.push(chunk));
    document.on('error', reject);
    document.on('end', () => resolve(Buffer.concat(chunks)));
    document.end();
  });
}

module.exports = { validateReportPdfFilters, reportPdfData, buildReportPdfDefinition, generateReportPdf };
