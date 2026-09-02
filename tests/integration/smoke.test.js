const assert = require('node:assert/strict');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { after, before, test } = require('node:test');
const { createEncryptedStore } = require('../../server/core/encrypted-store');

let child;
let baseUrl;
let temporaryRoot;
const bootstrapEmail = `admin-${crypto.randomUUID()}@centralti.test`;
const bootstrapPassword = `Fase1!${crypto.randomBytes(18).toString('hex')}`;
const bootstrapName = 'Administrador de teste';

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
      CENTRAL_TI_ATTACHMENT_MAX_COUNT: '2',
      CENTRAL_TI_ATTACHMENT_MAX_STORAGE_BYTES: '5000000',
      DATABASE_URL: '',
      EMAIL_2FA_REQUIRED: 'false',
      CENTRAL_TI_BOOTSTRAP_ADMIN_NAME: bootstrapName,
      CENTRAL_TI_BOOTSTRAP_ADMIN_EMAIL: bootstrapEmail,
      CENTRAL_TI_BOOTSTRAP_ADMIN_PASSWORD: bootstrapPassword
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

  const [script, stylesheet, safeRender] = await Promise.all([
    fetch(`${baseUrl}/assets/js/app.js`),
    fetch(`${baseUrl}/assets/css/styles.css`),
    fetch(`${baseUrl}/assets/js/core/safe-render.js`)
  ]);
  assert.equal(script.status, 200);
  assert.match(script.headers.get('content-type'), /javascript/);
  assert.equal(stylesheet.status, 200);
  assert.match(stylesheet.headers.get('content-type'), /text\/css/);
  assert.equal(safeRender.status, 200);
  assert.match(await safeRender.text(), /function escapeAttribute/);

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

test('não cria base nova sem bootstrap administrativo explícito', () => {
  const { createSeedData } = require('../../server/domain/seed-data');
  assert.throws(() => createSeedData({ id: crypto.randomUUID, now: () => new Date().toISOString(), passwordHash: () => ({}) }), /CENTRAL_TI_BOOTSTRAP_ADMIN/);
});

test('modo de produção rejeita HTTP direto e aceita somente o proxy HTTPS confiável', async () => {
  const port = await freePort();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'central-ti-https-test-'));
  const childProcess = spawn(process.execPath, ['server/server.js'], {
    cwd: path.resolve(__dirname, '..', '..'),
    env: {
      ...process.env,
      NODE_ENV: 'production', HOST: '127.0.0.1', PORT: String(port),
      CENTRAL_TI_DATA_DIR: path.join(root, 'storage'), BACKUP_DIR: path.join(root, 'backups'),
      CENTRAL_TI_BOOTSTRAP_ADMIN_NAME: 'Administrador HTTPS',
      CENTRAL_TI_BOOTSTRAP_ADMIN_EMAIL: `https-${crypto.randomUUID()}@centralti.test`,
      CENTRAL_TI_BOOTSTRAP_ADMIN_PASSWORD: `Https!${crypto.randomBytes(18).toString('hex')}`,
      CENTRAL_TI_TRUST_PROXY: 'true', CENTRAL_TI_REQUIRE_HTTPS: 'false', DATABASE_URL: '', EMAIL_2FA_REQUIRED: 'false'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const url = `http://127.0.0.1:${port}`;
  try {
    const deadline = Date.now() + 10000;
    while (Date.now() < deadline) {
      try { if ((await fetch(`${url}/api/health`, { headers: { 'x-forwarded-proto': 'https' } })).ok) break; } catch {}
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    const direct = await fetch(`${url}/api/health`);
    assert.equal(direct.status, 426);
    const proxied = await fetch(`${url}/api/health`, { headers: { 'x-forwarded-proto': 'https' } });
    assert.equal(proxied.status, 200);
    assert.equal(proxied.headers.get('strict-transport-security'), 'max-age=15552000');
  } finally {
    if (childProcess.exitCode === null) {
      childProcess.kill();
      await new Promise(resolve => childProcess.once('exit', resolve));
    }
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('produção falha com proxy não confiável ou host exposto, mesmo com HTTPS desabilitado no ambiente', () => {
  const cwd = path.resolve(__dirname, '..', '..');
  const inspectConfig = environment => spawnSync(process.execPath, ['-e', "require('./server/core/config')"], {
    cwd,
    env: { ...process.env, NODE_ENV: 'production', CENTRAL_TI_REQUIRE_HTTPS: 'false', ...environment },
    encoding: 'utf8'
  });

  const untrustedProxy = inspectConfig({ HOST: '127.0.0.1', CENTRAL_TI_TRUST_PROXY: 'false' });
  assert.notEqual(untrustedProxy.status, 0);
  assert.match(untrustedProxy.stderr, /CENTRAL_TI_TRUST_PROXY=true/);

  const exposedHost = inspectConfig({ HOST: '0.0.0.0', CENTRAL_TI_TRUST_PROXY: 'true' });
  assert.notEqual(exposedHost.status, 0);
  assert.match(exposedHost.stderr, /HOST deve ser um endereço local/);
});

test('payloads XSS armazenados permanecem valores de atributo, não handlers executáveis', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
  const { escapeAttribute } = require('../../public/assets/js/core/safe-render');
  const payloads = [
    "grupo');globalThis.executed=true;//",
    '" autofocus onfocus="globalThis.executed=true',
    '<img src=x onerror="globalThis.executed=true">&'
  ];

  for (const payload of payloads) {
    const encoded = escapeAttribute(payload);
    const rendered = `<button data-action="search" data-search-term="${encoded}">grupo</button>`;
    assert.doesNotMatch(encoded, /[<>\"]/);
    assert.match(rendered, /^<button data-action="search" data-search-term="/);
    assert.match(encoded, /&(amp|lt|gt|#39|quot);/);
    assert.equal(rendered.includes('onclick='), false);
  }

  assert.doesNotMatch(source, /onclick="setSearch\('\$\{esc\(item\.group\)\}'\)"/);
  assert.doesNotMatch(source, /ondrop="dropDemand\(event,'\$\{esc\(status\)\}'\)"/);
  assert.match(source, /window\.CentralTiSafeRender\?\.escapeAttribute \|\|/);
  assert.match(source, /const esc = escapeAttribute;/);
  assert.match(source, /data-search-term="\$\{esc\(item\.group\)\}"/);
  assert.match(source, /data-drop-status="\$\{esc\(status\)\}"/);
});

test('rascunho de nova demanda mantém a descrição editável', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
  assert.match(source, /const existingDemand = Boolean\(record\?\.id\);/);
  assert.match(source, /key === 'descricao' && existingDemand \? 'readonly aria-readonly="true"' : ''/);
  assert.doesNotMatch(source, /key === 'descricao' && record \? 'readonly aria-readonly="true"' : ''/);
});

test('quadro de demandas oferece filtro por responsável e minhas demandas', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
  assert.match(source, /function matchesDemandAssignee\(record\)/);
  assert.match(source, /Minhas demandas/);
  assert.match(source, /Todos os responsáveis/);
  assert.match(source, /data-action="demand-assignee-filter"/);
  assert.match(source, /setDemandAssignee\(event\.target\.value\)/);
});

test('catálogo de demandas cobre os motivos recorrentes revisados em produção', () => {
  const configSource = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/core/config.js'), 'utf8');
  const appSource = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
  for (const reason of ['RealClinic — Cadastro / correção de paciente', 'RealClinic — Agenda / reagendamento', 'RealClinic — Erro geral / integração', 'Ligação com falha', 'Novo ramal', 'Wi-Fi sem conexão', 'Internet instável / sem acesso', 'Configuração de rede']) assert.match(configSource, new RegExp(reason));
  assert.match(configSource, /'Rede e Internet'/);
  assert.match(appSource, /function canonicalDemandCategory\(category\)/);
  assert.match(appSource, /canonicalDemandCategory\(card\.categoria\)/);
});

test('relatório de demandas inclui o modelo institucional de impressão', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
  assert.match(source, /print-document-header/);
  assert.match(source, /Relatório de Demandas/);
  assert.match(source, /print-document-footer/);
  assert.match(source, /function printDemandReport\(\)/);
  assert.match(source, /window\.open\('', '_blank'\)/);
  assert.match(source, /@page\{size:A4 landscape/);
});

test('cadastro de ramal permite informar uma nova categoria ou setor', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
  assert.match(source, /source === 'RAMAL_SECTOR'/);
  assert.match(source, /list="ramal-sector-options"/);
  assert.match(source, /placeholder="Selecione ou digite o setor"/);
});

test('cadastro de ramal não exige responsável', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../../public/assets/js/app.js'), 'utf8');
  assert.match(source, /optionalRamalResponsible = state\.modal\?\.resource === 'ramais'/);
  assert.match(source, /optionalRamalResponsible \? '' : 'required'/);
  assert.match(source, /Não informado/);
});

test('rejeita senha inválida e aceita o administrador criado por bootstrap seguro', async () => {
  const invalid = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: bootstrapEmail, password: 'incorreta' })
  });
  assert.equal(invalid.status, 401);

  const valid = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: bootstrapEmail, password: bootstrapPassword })
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

  const adminToken = await login(bootstrapEmail, bootstrapPassword);
  const changedAdmin = await request('/api/auth/change-password', adminToken, {
    method: 'POST',
    body: JSON.stringify({ currentPassword: bootstrapPassword, newPassword: 'Abcdef1!' })
  });
  assert.equal(changedAdmin.status, 200);

  const materials = await request('/api/resources/materiais', adminToken);
  assert.equal(materials.status, 404);

  const network = await request('/api/resources/redes', adminToken, {
    method: 'POST',
    body: JSON.stringify({ nome: 'Wi-Fi Teste; Norte', senha: 'Senha,Teste:2026', localizacao: 'Recepção', status: 'Ativa' })
  });
  assert.equal(network.status, 201);
  const networkRecord = (await network.json()).record;
  const networkQr = await request(`/api/resources/redes/${networkRecord.id}/qrcode`, adminToken);
  assert.equal(networkQr.status, 200);
  assert.match(networkQr.headers.get('content-type'), /image\/svg\+xml/);
  assert.equal(networkQr.headers.get('cache-control'), 'private, no-store');
  const networkQrSvg = await networkQr.text();
  assert.match(networkQrSvg, /<svg/);
  assert.equal(networkQrSvg.includes(networkRecord.nome), false);
  assert.equal(networkQrSvg.includes(networkRecord.senha), false);

  const extension = await request('/api/resources/ramais', adminToken, {
    method: 'POST',
    body: JSON.stringify({ ramal: '999', setor: 'Central de Relacionamento', responsavel: bootstrapName, status: 'Ativo', funcionamento: 'Bom funcionamento' })
  });
  assert.equal(extension.status, 201);
  const listedExtensions = await request('/api/resources/ramais', adminToken);
  assert.equal((await listedExtensions.json()).records.some(record => record.ramal === '999' && record.setor === 'Central de Relacionamento'), true);
  const unassignedExtension = await request('/api/resources/ramais', adminToken, {
    method: 'POST',
    body: JSON.stringify({ ramal: '998', setor: 'Central de Relacionamento', status: 'Ativo', funcionamento: 'Bom funcionamento' })
  });
  assert.equal(unassignedExtension.status, 201);
  assert.equal((await unassignedExtension.json()).record.responsavel, 'Não informado');

  const report = await request('/api/reports', adminToken);
  assert.equal(report.status, 200);
  assert.equal((await report.json()).modules.some(module => module.resource === 'materiais'), false);

  const configuredStatuses = await request('/api/demand-statuses', adminToken);
  const statusList = (await configuredStatuses.json()).statuses;
  const savedStatuses = await request('/api/demand-statuses', adminToken, {
    method: 'PUT',
    body: JSON.stringify({ statuses: [...new Set([...statusList, 'Concluida', 'Tdsa Concluídas'])] })
  });
  assert.equal(savedStatuses.status, 200);
  for (const status of ['Concluida', 'Tdsa Concluídas']) {
    const demand = await request('/api/resources/demandas', adminToken, {
      method: 'POST',
      body: JSON.stringify({ titulo: `Demanda ${status}`, solicitante: 'Administrador', tipo: 'interna', categoria: 'Software', assunto: 'Teste de métrica', prioridade: 'Média', status })
    });
    assert.equal(demand.status, 201);
  }
  const customStatusReport = await request('/api/reports', adminToken);
  const customStatusTotals = (await customStatusReport.json()).demandStatus;
  assert.equal(customStatusTotals.find(item => item.status === 'Concluida').total, 1);
  assert.equal(customStatusTotals.find(item => item.status === 'Tdsa Concluídas').total, 1);
  const analytics = await request('/api/reports?demandReason=Teste%20de%20m%C3%A9trica', adminToken);
  assert.equal(analytics.status, 200);
  const analyticsData = await analytics.json();
  assert.equal(analyticsData.demandReport.metrics.total, 2);
  assert.equal(analyticsData.demandReport.metrics.completed, 2);
  assert.equal(analyticsData.demandReport.reasons[0].label, 'Teste de métrica');
  assert.equal(analyticsData.demandReport.mainReasons[0].percentOfRequester, 100);
  assert.equal(analyticsData.demandReport.professionals[0].professional, 'Não atribuída');
  const analyticsExport = await request('/api/reports/export?demandReason=Teste%20de%20m%C3%A9trica', adminToken);
  assert.equal(analyticsExport.status, 200);
  assert.match(await analyticsExport.text(), /Principal motivo por solicitante/);
  const dashboard = await request('/api/dashboard', adminToken);
  const dashboardData = await dashboard.json();
  const expectedAssets = await Promise.all(['computadores', 'equipamentos', 'patrimonio'].map(async resource => {
    const response = await request(`/api/resources/${resource}`, adminToken);
    return (await response.json()).records.length;
  }));
  assert.equal(dashboardData.activeCount, expectedAssets.reduce((total, count) => total + count, 0));
  const allDemands = await request('/api/resources/demandas', adminToken);
  const expectedOpenDemands = (await allDemands.json()).records.filter(record => !/conclu|finaliz|resolvid|encerr/i.test(String(record.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''))).length;
  assert.equal(dashboardData.openDemands, expectedOpenDemands);

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
  assert.equal(deletionRecord.exclusaoConcluidaPor, bootstrapName);
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
  const forbiddenNetworkQr = await request(`/api/resources/redes/${networkRecord.id}/qrcode`, tokenA);
  assert.equal(forbiddenNetworkQr.status, 403);

  const createdDemand = await request('/api/resources/demandas', tokenA, {
    method: 'POST',
    body: JSON.stringify({ titulo: 'Demanda confidencial do usuário A', tipo: 'externa', categoria: 'Acesso', assunto: 'Login', prioridade: 'Alta', descricao: 'Apenas o solicitante e a equipe de T.I. podem visualizar.' })
  });
  assert.equal(createdDemand.status, 201);
  const demand = (await createdDemand.json()).record;
  const screenshot = Buffer.from('89504e470d0a1a0a', 'hex').toString('base64');

  const commentA = await request(`/api/resources/demandas/${demand.id}/comments`, tokenA, {
    method: 'POST',
    body: JSON.stringify({ text: 'Preciso de ajuda para recuperar meu acesso.', anexoPrint: { mime: 'image/png', data: screenshot } })
  });
  assert.equal(commentA.status, 201);
  assert.equal((await commentA.json()).interaction.anexoPrint.data, screenshot);
  const demandDetailsWithComment = await request(`/api/resources/demandas/${demand.id}`, tokenA);
  const commentWithAttachment = (await demandDetailsWithComment.json()).records[0].interacoes[0];
  assert.equal(commentWithAttachment.anexoPrint.data, screenshot);
  const invalidCommentAttachment = await request(`/api/resources/demandas/${demand.id}/comments`, tokenA, {
    method: 'POST',
    body: JSON.stringify({ anexoPrint: { mime: 'image/png', data: Buffer.from('não é um PNG').toString('base64') } })
  });
  assert.equal(invalidCommentAttachment.status, 422);
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
  assert.equal(assignedRecord.tecnicoResponsavel, bootstrapName);
  assert.equal(assignedRecord.status, 'Em andamento');
  const invalidStatus = await request(`/api/resources/demandas/${demand.id}/status`, adminToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Status inexistente' })
  });
  assert.equal(invalidStatus.status, 422);
  const completedDemand = await request(`/api/resources/demandas/${demand.id}/status`, adminToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Concluída' })
  });
  assert.equal(completedDemand.status, 200);
  assert.equal((await completedDemand.json()).record.status, 'Concluída');

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
  const secondAttachment = await request('/api/messages', adminToken, {
    method: 'POST',
    body: JSON.stringify({ recipientId: userA.id, subject: 'Outro print', body: 'Este envio deve respeitar a cota.', attachment: { mime: 'image/png', data: screenshot } })
  });
  assert.equal(secondAttachment.status, 201);
  const quotaExceeded = await request('/api/messages', adminToken, {
    method: 'POST',
    body: JSON.stringify({ recipientId: userA.id, subject: 'Terceiro print', body: 'Este envio deve respeitar a cota.', attachment: { mime: 'image/png', data: screenshot } })
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
  const assignedAttachmentDemand = await request(`/api/resources/demandas/${attachmentDemand.id}/assign-self`, adminToken, {
    method: 'PUT',
    body: '{}'
  });
  assert.equal(assignedAttachmentDemand.status, 200);
  const completedAttachmentDemand = await request(`/api/resources/demandas/${attachmentDemand.id}/status`, adminToken, {
    method: 'PUT',
    body: JSON.stringify({ status: 'Concluída' })
  });
  assert.equal(completedAttachmentDemand.status, 200);
  assert.equal((await completedAttachmentDemand.json()).record.status, 'Concluída');
  const commentAttachmentQuotaExceeded = await request(`/api/resources/demandas/${demand.id}/comments`, tokenA, {
    method: 'POST',
    body: JSON.stringify({ text: 'Este terceiro print deve respeitar a cota.', anexoPrint: { mime: 'image/png', data: screenshot } })
  });
  assert.equal(commentAttachmentQuotaExceeded.status, 429);
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
  const listedCommentAttachment = recordsA.find(record => record.id === demand.id).interacoes[0].anexoPrint;
  assert.equal(listedCommentAttachment.hasAttachment, true);
  assert.equal('data' in listedCommentAttachment, false);
  assert.equal(recordsB.some(record => record.titulo === 'Demanda confidencial do usuário A'), false);
  assert.equal(recordsAdmin.some(record => record.titulo === 'Demanda confidencial do usuário A'), true);

  const persisted = fs.readFileSync(path.join(temporaryRoot, 'storage', 'central-ti.json'), 'utf8');
  assert.match(persisted, /"encrypted"/);
  assert.equal(persisted.includes(bootstrapEmail), false);
});
