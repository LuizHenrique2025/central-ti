function attachmentBytes(attachment) {
  return attachment?.data ? Buffer.byteLength(attachment.data, 'base64') : 0;
}

function sanitizeScreenshot(value) {
  if (!value) return undefined;
  const allowed = { 'image/png': '89504e470d0a1a0a', 'image/jpeg': 'ffd8ff', 'image/webp': '52494646' };
  if (!allowed[value.mime] || typeof value.data !== 'string' || value.data.length > 6_700_000) return null;
  const image = Buffer.from(value.data, 'base64');
  return image.length && image.length <= 5_000_000 && image.subarray(0, allowed[value.mime].length / 2).toString('hex') === allowed[value.mime]
    ? { mime: value.mime, data: image.toString('base64') }
    : null;
}

function interactionForResponse(interaction, includeAttachment = false) {
  const value = { ...interaction };
  if (!includeAttachment && value.anexoPrint?.data) value.anexoPrint = { mime: value.anexoPrint.mime, hasAttachment: true };
  return value;
}

function demandForResponse(record, includeAttachment = false) {
  const value = { ...record, interacoes: (record.interacoes || []).map(interaction => interactionForResponse(interaction, includeAttachment)) };
  if (!includeAttachment && value.anexoPrint?.data) value.anexoPrint = { mime: value.anexoPrint.mime, hasAttachment: true };
  return value;
}

function auditSafeRecord(record) {
  const value = { ...record, interacoes: (record.interacoes || []).map(interaction => interactionForResponse(interaction)) };
  if (value.anexoPrint?.data) value.anexoPrint = { mime: value.anexoPrint.mime, hasAttachment: true };
  return value;
}

module.exports = { attachmentBytes, sanitizeScreenshot, interactionForResponse, demandForResponse, auditSafeRecord };
