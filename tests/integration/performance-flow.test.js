const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');
const { createSeedData } = require('../../server/domain/seed-data');
const { createEncryptedStore } = require('../../server/core/encrypted-store');
const { passwordHash } = require('../../server/core/security');
const { collaboratorPermissions } = require('../../server/domain/demand-access');

test('quadro paginado, painel e resumo de mensagens preservam dados e acesso por usuário', async () => {
  const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'central-ti-performance-'));
  const password = `Teste!${crypto.randomBytes(18).toString('hex')}A1`;
  const encryptionKey = crypto.randomBytes(32).toString('base64');
  const data = createSeedData({ id: crypto.randomUUID, now: () => new Date().toISOString(), passwordHash, bootstrapAdmin: { name: 'Administrador de teste', email: 'admin@performance.test', password } });
  const admin = data.users[0];
  admin.mustChangePassword = false;
  const requester = { id: crypto.randomUUID(), nome: 'Solicitante de teste', email: 'user@performance.test', perfil: 'consulta', active: true, activationStatus: 'ativo', permissions: collaboratorPermissions(), ...passwordHash(password), createdAt: new Date().toISOString(), mustChangePassword: false };
  const other = { ...requester, id: crypto.randomUUID(), nome: 'Outro solicitante', email: 'other@performance.test' };
  data.users.push(requester, other);
  const attachment = { mime: 'image/png', data: Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(10000)]).toString('base64') };
  data.demandas = Array.from({ length: 63 }, (_, index) => ({
    id: crypto.randomUUID(), ticket: `PERF-${String(index).padStart(3, '0')}`, titulo: `Registro ${index}`, solicitante: index < 30 || index === 60 ? requester.nome : other.nome,
    createdBy: index < 30 || index === 60 ? requester.id : other.id, solicitanteId: index < 30 || index === 60 ? requester.id : other.id,
    tipo: index === 62 ? 'interna' : 'externa', status: index < 60 ? 'Concluída' : 'Aberta', prioridade: 'Média', categoria: 'Software', assunto: 'Teste',
    tecnicoResponsavel: index === 0 ? 'Técnico antigo' : 'Técnico atual', descricao: 'Descrição completa preservada', anexoPrint: attachment,
    interacoes: [{ id: crypto.randomUUID(), texto: 'Histórico preservado', autorId: admin.id, criadoEm: '2026-10-01T01:00:00.000Z' }],
    createdAt: new Date(Date.parse('2026-10-01T01:00:00Z') + index * 86400000).toISOString(), updatedAt: new Date(Date.parse('2026-10-01T01:00:00Z') + index * 86400000).toISOString()
  }));
  data.messages = Array.from({ length: 5 }, (_, index) => ({ id: crypto.randomUUID(), senderId: other.id, recipientId: requester.id, subject: `Aviso ${index}`, body: 'Conteúdo que não deve sair no resumo', createdAt: new Date(Date.parse('2026-10-01T12:00:00Z') + index * 1000).toISOString(), readAt: index === 3 ? '2026-10-02T12:00:00Z' : null, recipientDeletedAt: index === 2 ? '2026-10-02T12:00:00Z' : null, recipientArchivedAt: index === 1 ? '2026-10-02T12:00:00Z' : null }));
  data.messages[4].recipientId = other.id;
  const storage = path.join(temporaryRoot, 'storage');
  fs.mkdirSync(storage);
  fs.writeFileSync(path.join(storage, 'central-ti.json'), createEncryptedStore(encryptionKey).serialize(data));
  const port = await new Promise((resolve, reject) => { const server = net.createServer(); server.once('error', reject); server.listen(0, '127.0.0.1', () => { const value = server.address().port; server.close(error => error ? reject(error) : resolve(value)); }); });
  const baseUrl = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server/server.js'], { cwd: path.resolve(__dirname, '../..'), env: { ...process.env, NODE_ENV: 'development', HOST: '127.0.0.1', PORT: String(port), DATABASE_URL: '', EMAIL_2FA_REQUIRED: 'false', CENTRAL_TI_REQUIRE_HTTPS: 'false', CENTRAL_TI_DATA_DIR: storage, BACKUP_DIR: path.join(temporaryRoot, 'backups'), CENTRAL_TI_DATA_ENCRYPTION_KEY: encryptionKey }, stdio: 'ignore' });
  try {
    let ready = false;
    for (let index = 0; index < 100; index++) { try { ready = (await fetch(`${baseUrl}/api/health`)).ok; } catch {} if (ready) break; await new Promise(resolve => setTimeout(resolve, 100)); }
    assert(ready, 'servidor isolado deve iniciar');
    const login = async email => { const response = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) }); assert.equal(response.status, 200); return (await response.json()).token; };
    const adminToken = await login(admin.email);
    const userToken = await login(requester.email);
    const get = async (route, token = adminToken) => { const response = await fetch(baseUrl + route, { headers: { authorization: `Bearer ${token}` } }); assert.equal(response.status, 200, route); return response.json(); };
    for (const route of ['/api/messages/summary', '/api/resources/demandas?view=board']) assert.equal((await fetch(baseUrl + route)).status, 401);

    const board = await get('/api/resources/demandas?view=board&type=externa');
    assert.equal(board.records.length, 27);
    assert.equal(board.pagination.totals['Concluída'], 60);
    assert.equal(board.pagination.totals.Aberta, 2);
    assert(board.pagination.filters.assignees.includes('Técnico antigo'));
    assert(!JSON.stringify(board).includes(attachment.data));
    assert(!board.records.some(record => 'descricao' in record || 'interacoes' in record));
    const more = await get('/api/resources/demandas?view=board&type=externa&completedLimit=75');
    assert.equal(more.records.length, 62);
    const old = await get('/api/resources/demandas?view=board&type=externa&query=PERF-000');
    assert.equal(old.records.length, 1);
    assert.equal(old.records[0].id, data.demandas[0].id);
    const assignee = await get('/api/resources/demandas?view=board&assignee=' + encodeURIComponent('Técnico antigo'));
    assert.equal(assignee.records.length, 1);
    const dated = await get('/api/resources/demandas?view=board&createdDate=2026-09-30&timezoneOffset=180');
    assert.equal(dated.records.length, 1);
    const period = await get('/api/resources/demandas?view=board&createdStart=2026-09-30&createdEnd=2026-10-01&timezoneOffset=180');
    assert.equal(period.records.length, 2, 'período inclui as duas datas no fuso do usuário');
    const emptyPeriod = await get('/api/resources/demandas?view=board&createdStart=2026-01-01&createdEnd=2026-01-02');
    assert.equal(emptyPeriod.records.length, 0);
    for (const params of ['createdStart=2026-02-30', 'createdStart=2026-10-02&createdEnd=2026-10-01', 'createdDate=2026-13-01']) {
      assert.equal((await fetch(`${baseUrl}/api/resources/demandas?view=board&${params}`, { headers: { authorization: `Bearer ${adminToken}` } })).status, 422);
    }
    const own = await get('/api/resources/demandas?view=board&completedLimit=75', userToken);
    assert.equal(own.records.length, 31);
    assert(own.records.every(record => record.createdBy === requester.id));
    assert.deepEqual(own.pagination.filters.requesters, [requester.nome]);
    const filtered = await get('/api/resources/demandas?view=board&requester=' + encodeURIComponent(other.nome), userToken);
    assert.equal(filtered.records.length, 0);
    assert.equal((await fetch(baseUrl + '/api/resources/demandas?view=board&completedLimit=-1', { headers: { authorization: `Bearer ${adminToken}` } })).status, 422);

    const details = await get(`/api/resources/demandas/${data.demandas[0].id}`);
    assert.equal(details.records[0].descricao, 'Descrição completa preservada');
    assert.equal(details.records[0].anexoPrint.data, attachment.data);
    assert.equal(details.records[0].interacoes[0].texto, 'Histórico preservado');
    assert.equal((await get('/api/resources/demandas')).records.length, 63, 'contrato anterior continua disponível');
    const summary = await get('/api/messages/summary', userToken);
    assert.equal(summary.unreadCount, 2);
    assert.equal(summary.unreadIds.length, 2);
    assert.equal(summary.latest.id, data.messages[1].id);
    assert(!JSON.stringify(summary).includes('Conteúdo que não deve sair no resumo'));
    const dashboard = await get('/api/dashboard');
    assert.equal(dashboard.openDemands, 3);
    assert(!JSON.stringify(dashboard).includes(attachment.data));
    const ownDashboard = await get('/api/dashboard', userToken);
    assert.equal(ownDashboard.openDemands, 1);
    assert.equal(ownDashboard.inbox, summary.unreadCount);
  } finally {
    if (child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit', resolve)); }
    const target = path.resolve(temporaryRoot);
    assert.equal(path.dirname(target), path.resolve(os.tmpdir()));
    assert(path.basename(target).startsWith('central-ti-performance-'));
    fs.rmSync(target, { recursive: true, force: true });
  }
});
