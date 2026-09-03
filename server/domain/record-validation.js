const net = require('node:net');

function sanitizeChecklist(value, allowedItems) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter(item => allowedItems.includes(item)))];
}

function sanitizeOptionalDate(value) {
  if (value === undefined || value === null || value === '') return '';
  const date = String(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function normalizeProgramValue(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const cents = Number(digits);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : null;
}

function automaticSla(priority) {
  const hours = { 'Crítica': 4, Alta: 24, 'Média': 48, Baixa: 120 }[priority] || 48;
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function validateRecordCharacters(resource, payload, isAsset) {
  for (const value of Object.values(payload)) {
    if (typeof value === 'string' && /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>\uFFFD]/.test(value)) {
      return 'Há caracteres inválidos no cadastro. Revise acentos, símbolos e texto copiado.';
    }
  }
  if (isAsset(resource)) {
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{1,49}$/.test(payload.patrimonio)) return 'O patrimônio deve ter de 2 a 50 caracteres: letras, números, ponto, hífen, sublinhado ou barra.';
    if (resource === 'computadores' && !net.isIP(payload.ip)) return 'Informe um endereço IP válido, por exemplo: 192.168.1.25.';
  }
  if (resource === 'computadores' && !/^[\p{L}\p{N}][\p{L}\p{N} .&()/_-]{1,49}$/u.test(payload.grupo)) return 'O grupo possui caracteres inválidos.';
  if (resource === 'computadores') {
    const dates = [payload.dataSolicitacao, payload.dataRetirada, payload.dataDevolucao].filter(Boolean);
    if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) return 'Informe datas válidas.';
    if (payload.dataSolicitacao && payload.dataRetirada && payload.dataSolicitacao > payload.dataRetirada) return 'A retirada não pode ser anterior à solicitação.';
    if (payload.dataRetirada && payload.dataDevolucao && payload.dataRetirada > payload.dataDevolucao) return 'A devolução não pode ser anterior à retirada.';
  }
  if (resource === 'equipamentos') {
    if (!net.isIP(payload.ip)) return 'Informe um endereço IP válido para localizar o equipamento na rede.';
    const dates = [payload.dataRetirada, payload.dataDevolucao].filter(Boolean);
    if (dates.some(date => !/^\d{4}-\d{2}-\d{2}$/.test(date))) return 'Informe datas válidas.';
    if (payload.dataRetirada && payload.dataDevolucao && payload.dataRetirada > payload.dataDevolucao) return 'A devolução não pode ser anterior à retirada.';
  }
  if (resource === 'ramais' && payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) return 'Informe um e-mail válido para o ramal.';
  if (resource === 'programas') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(payload.dataContratacao) || !/^\d{4}-\d{2}-\d{2}$/.test(payload.dataRenovacao)) return 'Informe datas válidas para contratação e renovação.';
    if (payload.dataRenovacao < payload.dataContratacao) return 'A data de renovação não pode ser anterior à contratação.';
    if (!Number.isSafeInteger(payload.valor) || payload.valor <= 0) return 'Informe um valor válido para o programa.';
  }
  return null;
}

module.exports = { sanitizeChecklist, sanitizeOptionalDate, normalizeProgramValue, automaticSla, validateRecordCharacters };
