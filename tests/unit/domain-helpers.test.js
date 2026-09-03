const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { collaboratorPermissions, demandBelongsToUser } = require('../../server/domain/demand-access');
const { attachmentBytes, auditSafeRecord, sanitizeScreenshot } = require('../../server/domain/attachments');
const { wifiQrPayload } = require('../../server/domain/wifi');
const { assetSituation } = require('../../server/domain/assets');
const { normalizeProgramValue, sanitizeChecklist, validateRecordCharacters } = require('../../server/domain/record-validation');

test('regras de demanda preservam a visibilidade e permissões do colaborador', () => {
  const permissions = collaboratorPermissions();
  assert.equal(permissions.demandas.create, true);
  assert.equal(permissions.redes.update, false);
  assert.equal(demandBelongsToUser({ createdBy: 'u-1' }, { id: 'u-1', perfil: 'consulta' }), true);
  assert.equal(demandBelongsToUser({ createdBy: 'u-1' }, { id: 'u-2', perfil: 'consulta' }), false);
  assert.equal(demandBelongsToUser({ createdBy: 'u-1' }, { id: 'u-2', perfil: 'ti' }), true);
});

test('anexos são validados e removidos dos registros de auditoria', () => {
  const validPng = { mime: 'image/png', data: Buffer.from('89504e470d0a1a0a', 'hex').toString('base64') };
  assert.deepEqual(sanitizeScreenshot(validPng), validPng);
  assert.equal(sanitizeScreenshot({ mime: 'text/plain', data: validPng.data }), null);
  assert.equal(attachmentBytes(validPng), 8);
  const safe = auditSafeRecord({ anexoPrint: validPng, interacoes: [{ texto: 'Registro', anexoPrint: validPng }] });
  assert.deepEqual(safe.anexoPrint, { mime: 'image/png', hasAttachment: true });
  assert.deepEqual(safe.interacoes[0].anexoPrint, { mime: 'image/png', hasAttachment: true });
});

test('regras de Wi-Fi, ativos e cadastros permanecem isoladas e previsíveis', () => {
  assert.equal(wifiQrPayload({ nome: 'Rede; Visitantes', senha: 'a,b' }), 'WIFI:T:WPA;S:Rede\\; Visitantes;P:a\\,b;;');
  assert.equal(assetSituation('equipamentos', { condicao: 'Em manutenção' }), 'Em manutenção');
  assert.equal(normalizeProgramValue('R$ 1.234,56'), 123456);
  assert.deepEqual(sanitizeChecklist(['Monitor', 'Monitor', 'Outro'], ['Monitor']), ['Monitor']);
  assert.match(validateRecordCharacters('ramais', { email: 'invalido' }, () => false), /e-mail válido/);
});

test('a interface carrega o recurso de anexos separado da aplicação principal', () => {
  const root = path.resolve(__dirname, '..', '..');
  const page = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const app = fs.readFileSync(path.join(root, 'public', 'assets', 'js', 'app.js'), 'utf8');
  const feature = fs.readFileSync(path.join(root, 'public', 'assets', 'js', 'features', 'attachments.js'), 'utf8');
  assert.match(page, /assets\/js\/features\/attachments\.js/);
  assert.match(app, /CentralTiAttachments\?\.enhanceCurrentSurface/);
  assert.match(feature, /function enhanceCurrentSurface/);
});
