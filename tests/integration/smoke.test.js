const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { after, before, test } = require('node:test');
const { createEncryptedStore } = require('../../server/core/encrypted-store');

let child;
let baseUrl;
let temporaryRoot;

async function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function waitForServer(url, timeoutMs = 10000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${url}/api/health`);
      if (response.ok) return;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw new Error('O servidor de teste não iniciou no tempo esperado.');
}

before(async () => {
  const port = await freePort();
  temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'central-ti-test-'));
  baseUrl = `http://127.0.0.1:${port}`;
  child = spawn(process.execPath, ['server/server.js'], {
    cwd: path.resolve(__dirname, '..', '..'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(port),
      CENTRAL_TI_DATA_DIR: path.join(temporaryRoot, 'storage'),
      BACKUP_DIR: path.join(temporaryRoot, 'backups'),
      CENTRAL_TI_DATA_ENCRYPTION_KEY: 'q1qY1Z7Yo0DZ5Nxcjr9m9P4hZ4KaGPIqdveMyoeujh0=',
      CENTRAL_TI_ATTACHMENT_MAX_COUNT: '1',
      CENTRAL_TI_ATTACHMENT_MAX_STORAGE_BYTES: '5000000',
      DATABASE_URL: '',
      EMAIL_2FA_REQUIRED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  await waitForServer(baseUrl);
});

after(async () => {
  if (child && child.exitCode === null) {
    child.kill();
    await new Promise(resolve => child.once('exit', resolve));
  }
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('entrega a interface e informa saúde do serviço', async () => {
  const page = await fetch(`${baseUrl}/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Central TI/);
  assert.equal(page.headers.get('x-frame-options'), 'DENY');
  assert.match(page.headers.get('content-security-policy'), /default-src 'self'/);

  const [script, stylesheet] = await Promise.all([
    fetch(`${baseUrl}/assets/js/app.js`),
    fetch(`${baseUrl}/assets/css/styles.css`)
  ]);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('content-type'), /text\/css/);

  const configScript = await fetch(`${baseUrl}/assets/js/core/config.js`);
  assert.equal(configScript.status, 200);
  assert.match(await configScript.text(), /const modules/);

  const health = await fetch(`${baseUrl}/api/health`);
  assert.equal(health.status, 200);
  assert.deepEqual((await health.json()).ok, true);
  assert.equal((await fetch(`${baseUrl}/api/me`)).status, 401);

  const invalidContentType = await fetch(`${baseUrl}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'text/plain' }, body: 'email=admin' });
  assert.equal(invalidContentType.status, 415);
});

test('rejeita senha inválida e aceita a conta demonstrativa inicial', async () => {
  const invalid = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@centralti.local', password: 'incorreta' })
  });
  assert.equal(invalid.status, 401);

  const valid = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'admin@centralti.local', password: '123456' })
  });
  assert.equal(valid.status, 200);
  const session = await valid.json();
  assert.ok(session.token);

  const me = await fetch(`${baseUrl}/api/me`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).user.perfil, 'admin');

  const microSip = await fetch(`${baseUrl}/api/integrations/microsip/status`, { headers: { authorization: `Bearer ${session.token}` } });
  assert.equal(microSip.status, 200);
  const microSipStatus = await microSip.json();
  assert.equal(typeof microSipStatus.available, 'boolean');
  assert.match(microSipStatus.message, /MicroSIP/);
});

test('não abre uma base criptografada sem a chave correspondente', () => {
  const key = 'q1qY1Z7Yo0DZ5Nxcjr9m9P4hZ4KaGPIqdveMyoeujh0=';
  const encrypted = createEncryptedStore(key).serialize({ users: [] });
  assert.throws(() => createEncryptedStore().deserialize(encrypted), /CENTRAL_TI_DATA_ENCRYPTION_KEY/);
});

test('usuários comuns visualizam somente as próprias demandas', async () => {
  const login = async (email, password) => {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    assert.equal(response.status, 200);
    return (await response.json()).token;
  };
  const request = (url, token, options = {}) => fetch(`${baseUrl}${url}`, {
    ...options,
    headers: { authorization: `Bearer ${token}`, ...(options.body ? { 'content-type': 'application/json' } : {}) }
  });

  const adminToken = await login('admin@centralti.local', '123456');
  const changedAdmin = await request('/api/auth/change-password', adminToken, {
    method: 'POST',
    body: JSON.stringify({ currentPassword: '123456', newPassword: 'Abcdef1!' })
  });
  assert.equal(changedAdmin.status, 200);

  const materials = await request('/api/resources/materiais', adminToken);
  assert.equal(materials.status, 404);

  const report = await request('/api/reports', adminToken);
  assert.equal(report.status, 200);
  assert.equal((await report.json()).modules.some(module => module.resource === 'materiais'), false);

  const incompleteDeletion = await request('/api/resources/demandas', adminToken, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Excluir atendimento', solicitante: 'Administrador', tipo: 'interna', categoria: 'Software', assunto: 'RealClinic — Exclusão de atendimento', prioridade: 'Alta', status: 'Aberta' })
  });
  assert.equal(incompleteDeletion.status, 422);

  const deletion = await request('/api/resources/demandas', adminToken, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Excluir atendimento duplicado', solicitante: 'Administrador', tipo: 'interna', categoria: 'Software', assunto: 'RealClinic — Exclusão de atendimento', prioridade: 'Alta', status: 'Concluída', numeroAtendimento: 'ATD-2026-001', nomePaciente: 'Paciente de teste', categoriaMotivoExclusao: 'Atendimento duplicado', motivoExclusao: 'Atendimento registrado em duplicidade.' })
  });
  assert.equal(deletion.status, 201);
  const deletionRecord = (await deletion.json()).record;
  assert.equal(deletionRecord.numeroAtendimento, 'ATD-2026-001');
  assert.equal(deletionRecord.nomePaciente, 'Paciente de teste');
  assert.equal(deletionRecord.categoriaMotivoExclusao, 'Atendimento duplicado');
  assert.equal(deletionRecord.motivoExclusao, 'Atendimento registrado em duplicidade.');
  assert.equal(deletionRecord.exclusaoConcluidaPor, 'Administrador');
  assert.ok(deletionRecord.exclusaoConcluidaEm);

  const incompleteRateUpdate = await request('/api/resources/demandas', adminToken, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Atualizar taxa', solicitante: 'Administrador', tipo: 'interna', categoria: 'Software', assunto: 'RealClinic — Atualizar taxa', prioridade: 'Média', status: 'Aberta' })
  });
  assert.equal(incompleteRateUpdate.status, 422);

  const rateUpdate = await request('/api/resources/demandas', adminToken, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Atualizar taxa do procedimento', solicitante: 'Administrador', tipo: 'interna', categoria: 'Software', assunto: 'RealClinic — Atualizar taxa', prioridade: 'Média', status: 'Aberta', codigoProcedimento: '10101012', convenio: 'Convênio teste', valorProcedimento: 'R$ 150,00' })
  });
  assert.equal(rateUpdate.status, 201);
  const rateUpdateRecord = (await rateUpdate.json()).record;
  assert.equal(rateUpdateRecord.codigoProcedimento, '10101012');
  assert.equal(rateUpdateRecord.convenio, 'Convênio teste');
  assert.equal(rateUpdateRecord.valorProcedimento, 'R$ 150,00');

  const deletionCheck = await request(`/api/resources/demandas/${rateUpdateRecord.id}`, adminToken, { method: 'DELETE' });
  assert.equal(deletionCheck.status, 200);

  const procedureInclusion = await request('/api/resources/demandas', adminToken, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Incluir procedimento', solicitante: 'Administrador', tipo: 'interna', categoria: 'Software', assunto: 'RealClinic — Incluir procedimento', prioridade: 'Média', status: 'Aberta', valorProcedimento: 'R$ 80,00', tuss: '10101012' })
  });
  assert.equal(procedureInclusion.status, 201);

  const tableUpdate = await request('/api/resources/demandas', adminToken, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Atualizar tabela', solicitante: 'Administrador', tipo: 'interna', categoria: 'Software', assunto: 'RealClinic — Atualizar tabela', prioridade: 'Média', status: 'Aberta', convenio: 'Convênio teste', tabela: 'Tabela particular 2026' })
  });
  assert.equal(tableUpdate.status, 201);

  const exclusionsReport = await request('/api/reports?exclusionReason=Atendimento%20duplicado', adminToken);
  assert.equal(exclusionsReport.status, 200);
  const exclusionsData = await exclusionsReport.json();
  assert.equal(exclusionsData.exclusions.total, 1);
  assert.equal(exclusionsData.exclusions.completed, 1);
  assert.equal(exclusionsData.exclusions.records[0].numeroAtendimento, 'ATD-2026-001');

  const permissions = { demandas: { list: true, consult: true, create: true, update: false, delete: false } };
  for (const suffix of ['a', 'b']) {
    const created = await request('/api/users', adminToken, {
      method: 'POST',
      body: JSON.stringify({ nome: `Usuário ${suffix.toUpperCase()}`, email: `usuario-${suffix}@centralti.local`, perfil: 'consulta', senha: 'Inicial2026@', permissions })
    });
    assert.equal(created.status, 201);
  }

  let tokenA = await login('usuario-a@centralti.local', 'Inicial2026@');
  const tokenB = await login('usuario-b@centralti.local', 'Inicial2026@');
  for (const token of [tokenA, tokenB]) {
    const changed = await request('/api/auth/change-password', token, {
      method: 'POST',
      body: JSON.stringify({ currentPassword: 'Inicial2026@', newPassword: 'Pessoal2026@' })
    });
    assert.equal(changed.status, 200);
  }

  const managedUsers = await request('/api/users', adminToken);
  const userA = (await managedUsers.json()).users.find(user => user.email === 'usuario-a@centralti.local');
  const reset = await request(`/api/users/${userA.id}/password`, adminToken, { method: 'PUT', body: JSON.stringify({ password: 'Temporaria2026!' }) });
  assert.equal(reset.status, 200);
  assert.equal((await request('/api/me', tokenA)).status, 401);

  tokenA = await login('usuario-a@centralti.local', 'Temporaria2026!');
  assert.equal((await request('/api/dashboard', tokenA)).status, 403);
  const setPersonalPassword = await request('/api/auth/change-password', tokenA, { method: 'POST', body: JSON.stringify({ currentPassword: 'Temporaria2026!', newPassword: 'Pessoal2026@' }) });
  assert.equal(setPersonalPassword.status, 200);

  const forbiddenReset = await request(`/api/users/${userA.id}/password`, tokenB, { method: 'PUT', body: JSON.stringify({ password: 'NaoPode2026!' }) });
  assert.equal(forbiddenReset.status, 403);

  const createdDemand = await request('/api/resources/demandas', tokenA, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Demanda confidencial do usuário A', tipo: 'externa', categoria: 'Acesso', assunto: 'Login', prioridade: 'Alta', descricao: 'Apenas o solicitante e a equipe de T.I. podem visualizar.' })
  });
  assert.equal(createdDemand.status, 201);
  const demand = (await createdDemand.json()).record;

  const commentA = await request(`/api/resources/demandas/${demand.id}/comments`, tokenA, {
    method: 'POST',
    body: JSON.stringify({ text: 'Preciso de ajuda para recuperar meu acesso.' })
  });
  assert.equal(commentA.status, 201);
  const forbiddenComment = await request(`/api/resources/demandas/${demand.id}/comments`, tokenB, {
    method: 'POST',
    body: JSON.stringify({ text: 'Não deveria acessar este chamado.' })
  });
  assert.equal(forbiddenComment.status, 404);

  const forbiddenUsers = await request('/api/users', tokenA);
  assert.equal(forbiddenUsers.status, 403);

  const adminMessages = await request('/api/messages', adminToken);
  assert.equal((await adminMessages.json()).messages.some(message => message.subject.includes(demand.ticket)), true);

  const prematureStatus = await request(`/api/resources/demandas/${demand.id}`, adminToken, {
    method: 'PUT',
    body: JSON.stringify({ ...demand, status: 'Em andamento' })
  });
  assert.equal(prematureStatus.status, 422);

  const assigned = await request(`/api/resources/demandas/${demand.id}/assign-self`, adminToken, {
    method: 'PUT',
    body: '{}'
  });
  assert.equal(assigned.status, 200);
  const assignedRecord = (await assigned.json()).record;
  assert.equal(assignedRecord.tecnicoResponsavel, 'Administrador');
  assert.equal(assignedRecord.status, 'Em andamento');

  const adminComment = await request(`/api/resources/demandas/${demand.id}/comments`, adminToken, {
    method: 'POST',
    body: JSON.stringify({ text: 'Recebemos sua solicitação e iniciaremos a análise.' })
  });
  assert.equal(adminComment.status, 201);
  const requesterMessages = await request('/api/messages', tokenA);
  assert.equal((await requesterMessages.json()).messages.some(message => message.subject.includes(demand.ticket)), true);

  const firstMessage = await request('/api/messages', adminToken, {
    method: 'POST',
    body: JSON.stringify({ recipientId: userA.id, subject: 'Conversa de teste', body: 'Mensagem inicial da conversa.' })
  });
  assert.equal(firstMessage.status, 201);
  const firstMessageData = (await firstMessage.json()).message;
  assert.equal(firstMessageData.threadId, firstMessageData.id);
  assert.equal(firstMessageData.replyToId, null);

  const threadReply = await request('/api/messages', adminToken, {
    method: 'POST',
    body: JSON.stringify({ replyToId: firstMessageData.id, body: 'Resposta vinculada à mesma conversa.' })
  });
  assert.equal(threadReply.status, 201);
  const threadReplyData = (await threadReply.json()).message;
  assert.equal(threadReplyData.threadId, firstMessageData.threadId);
  assert.equal(threadReplyData.replyToId, firstMessageData.id);
  const threadedMessages = await request('/api/messages', adminToken);
  const thread = (await threadedMessages.json()).messages.filter(message => message.threadId === firstMessageData.threadId);
  assert.equal(thread.length, 2);

  const screenshot = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');
  const messageWithAttachment = await request('/api/messages', adminToken, {
    method: 'POST',
    body: JSON.stringify({ recipientId: userA.id, subject: 'Print de teste', body: 'Confira o print.', attachment: { mime: 'image/png', data: screenshot } })
  });
  assert.equal(messageWithAttachment.status, 201);
  const attachmentMessage = (await messageWithAttachment.json()).message;
  const messagesWithMetadata = await request('/api/messages', tokenA);
  const listedAttachment = (await messagesWithMetadata.json()).messages.find(message => message.id === attachmentMessage.id);
  assert.equal(listedAttachment.hasAttachment, true);
  assert.equal('attachmentData' in listedAttachment, false);
  const attachmentDownload = await request(`/api/messages/${attachmentMessage.id}/attachment`, tokenA);
  assert.equal(attachmentDownload.status, 200);
  assert.deepEqual(Buffer.from(await attachmentDownload.arrayBuffer()), Buffer.from(screenshot, 'base64'));
  const forbiddenAttachment = await request(`/api/messages/${attachmentMessage.id}/attachment`, tokenB);
  assert.equal(forbiddenAttachment.status, 404);
  const quotaExceeded = await request('/api/messages', adminToken, {
    method: 'POST',
    body: JSON.stringify({ recipientId: userA.id, subject: 'Outro print', body: 'Este envio deve respeitar a cota.', attachment: { mime: 'image/png', data: screenshot } })
  });
  assert.equal(quotaExceeded.status, 429);
  const invalidAttachment = await request('/api/messages', tokenB, {
    method: 'POST',
    body: JSON.stringify({ recipientId: userA.id, subject: 'Print inválido', body: 'Este envio deve ser recusado.', attachment: { mime: 'image/png', data: Buffer.from('não é um PNG').toString('base64') } })
  });
  assert.equal(invalidAttachment.status, 422);

  const demandWithAttachment = await request('/api/resources/demandas', tokenA, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Demanda com print', tipo: 'externa', categoria: 'Software', assunto: 'RealClinic — Login / Acesso', prioridade: 'Alta', descricao: 'Print anexado para análise.', anexoPrint: { mime: 'image/png', data: screenshot } })
  });
  assert.equal(demandWithAttachment.status, 201);
  const attachmentDemand = (await demandWithAttachment.json()).record;
  const demandListWithAttachment = await request('/api/resources/demandas', tokenA);
  const listedDemandAttachment = (await demandListWithAttachment.json()).records.find(record => record.id === attachmentDemand.id);
  assert.equal(listedDemandAttachment.anexoPrint.hasAttachment, true);
  assert.equal('data' in listedDemandAttachment.anexoPrint, false);
  const demandDetailsWithAttachment = await request(`/api/resources/demandas/${attachmentDemand.id}`, tokenA);
  assert.equal(demandDetailsWithAttachment.status, 200);
  assert.equal((await demandDetailsWithAttachment.json()).records[0].anexoPrint.data, screenshot);
  const forbiddenDemandAttachment = await request(`/api/resources/demandas/${attachmentDemand.id}`, tokenB);
  assert.equal(forbiddenDemandAttachment.status, 404);
  const attachmentAudit = await request(`/api/audit?resource=demandas&recordId=${attachmentDemand.id}`, adminToken);
  assert.equal(attachmentAudit.status, 200);
  assert.equal(JSON.stringify(await attachmentAudit.json()).includes(screenshot), false);

  const [listA, listB, listAdmin] = await Promise.all([
    request('/api/resources/demandas', tokenA),
    request('/api/resources/demandas', tokenB),
    request('/api/resources/demandas', adminToken)
  ]);
  const recordsA = (await listA.json()).records;
  const recordsB = (await listB.json()).records;
  const recordsAdmin = (await listAdmin.json()).records;
  assert.equal(recordsA.some(record => record.titulo === 'Demanda confidencial do usuário A'), true);
  assert.equal(recordsA.find(record => record.id === demand.id).interacoes.length, 2);
  assert.equal(recordsB.some(record => record.titulo === 'Demanda confidencial do usuário A'), false);
  assert.equal(recordsAdmin.some(record => record.titulo === 'Demanda confidencial do usuário A'), true);

  const persisted = fs.readFileSync(path.join(temporaryRoot, 'storage', 'central-ti.json'), 'utf8');
  assert.match(persisted, /"encrypted"/);
  assert.equal(persisted.includes('admin@centralti.local'), false);
});
