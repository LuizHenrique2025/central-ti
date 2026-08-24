const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const net = require('node:net');
const { Pool } = require('pg');
const { resourceDefinitions, optionalResourceFields, access, computerChecklist } = require('./domain/resources');
const config = require('./core/config');
const { passwordHash, verifyPassword, normalizeCpf, cpfHash, firstName } = require('./core/security');
const { respond, error, requestBody } = require('./core/http');
const { createStaticFileHandler } = require('./core/static-files');
const { createEmailService } = require('./services/email-service');
const { createSessionService } = require('./services/session-service');
const { createSeedData } = require('./domain/seed-data');
const { PORT, HOST, ROOT, PUBLIC_DIR, DB_DIR, DB_FILE, BACKUP_DIR, DATABASE_URL, POSTGRES_MIGRATIONS_ENABLED, TWO_FACTOR_REQUIRED, SMTP_ENABLED } = config;
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const verificationChallenges = new Map();
const firstAccessChallenges = new Map();
const EXCLUSION_REASON_CATEGORIES = ['Atendimento duplicado', 'Paciente incorreto', 'Procedimento incorreto', 'Convênio incorreto', 'Guia/autorização incorreta', 'Lançamento por engano', 'Cadastro duplicado', 'Exame/procedimento duplicado', 'Outros'];
const emailService = createEmailService(config);
const serveFile = createStaticFileHandler(PUBLIC_DIR);
const pool = DATABASE_URL ? new Pool({ connectionString: DATABASE_URL, ssl: config.DATABASE_SSL ? { rejectUnauthorized: false } : undefined }) : null;

function id() { return crypto.randomUUID(); }
function now() { return new Date().toISOString(); }
function collaboratorPermissions() { return { demandas: { list: true, create: true, update: false, consult: true, delete: false, scope: 'hospital' }, redes: { list: true, create: false, update: false, consult: true, delete: false }, ramais: { list: true, create: false, update: false, consult: true, delete: false } }; }
function hospitalOnly(user) { return user.perfil !== 'admin' && Boolean(user.permissions?.demandas); }
function canViewAllDemands(user) { return user.perfil === 'admin' || user.perfil === 'ti'; }
function demandBelongsToUser(record, user) { return canViewAllDemands(user) || record.createdBy === user.id || record.solicitanteId === user.id; }
function initialData() { return createSeedData({ id, now, passwordHash }); }
function repairTextEncoding(value) {
  if (typeof value !== 'string' || !/[\u00C3\u00C2\u00E2]/.test(value)) return value;
  const windows1252 = new Map([[0x20AC, 0x80], [0x201A, 0x82], [0x0192, 0x83], [0x201E, 0x84], [0x2026, 0x85], [0x2020, 0x86], [0x2021, 0x87], [0x02C6, 0x88], [0x2030, 0x89], [0x0160, 0x8A], [0x2039, 0x8B], [0x0152, 0x8C], [0x017D, 0x8E], [0x2018, 0x91], [0x2019, 0x92], [0x201C, 0x93], [0x201D, 0x94], [0x2022, 0x95], [0x2013, 0x96], [0x2014, 0x97], [0x02DC, 0x98], [0x2122, 0x99], [0x0161, 0x9A], [0x203A, 0x9B], [0x0153, 0x9C], [0x017E, 0x9E], [0x0178, 0x9F]]);
  const bytes = []; for (const char of value) { const point = char.codePointAt(0); const byte = point <= 0xFF ? point : windows1252.get(point); if (byte === undefined) return value; bytes.push(byte); }
  const repaired = Buffer.from(bytes).toString('utf8');
  return repaired !== value && !repaired.includes('\uFFFD') ? repaired : value;
}
function repairStoredText(value) {
  if (typeof value === 'string') return repairTextEncoding(value);
  if (Array.isArray(value)) return value.map(repairStoredText);
  if (value && typeof value === 'object') { for (const [key, item] of Object.entries(value)) value[key] = repairStoredText(item); }
  return value;
}
function repairLegacyExtensions(data) {
  const names = new Map([
    ['204', 'PA Recepção'], ['206', 'PA Ambulatório'], ['207', 'Pronto Atendimento'], ['208', 'Farmácia Satélite'], ['209', 'Recepção Eletivas'], ['210', 'Sala de Triagem'], ['211', 'Consultório 01'], ['212', 'Consultório 02'], ['213', 'Consultório 03'], ['214', 'Consultório 04'], ['216', 'Raio X'], ['217', 'Exames Complementares'], ['218', 'Tomografia'], ['325', 'Centro Cirúrgico 1'], ['326', 'Centro Cirúrgico 2'], ['327', 'Enfermaria 1º Piso'], ['219', 'Recepção 1º Piso'], ['200', 'Call Center Isa'], ['201', 'Call Center Fernanda'], ['202', 'Call Center Geovanna'], ['300', 'Itapema Saúde 1'], ['301', 'Itapema Saúde 2'], ['302', 'Itapema Saúde 3'], ['222', 'Gerência Aline'], ['224', 'RH Milena'], ['229', 'Patricia'], ['232', 'Observação'], ['237', 'Laboratório'], ['240', 'CAF'], ['500', 'Faturamento Camyla'], ['501', 'Faturamento Isabella'], ['502', 'Faturamento Gislaine'], ['503', 'Sup Faturamento Susi'], ['406', 'T.I. Suporte Henrique'], ['408', 'T.I. Suporte MAX']
  ]);
  for (const extension of data.ramais || []) { if (names.has(String(extension.ramal))) extension.setor = names.get(String(extension.ramal)); if (extension.responsavel === 'Nï¿½o informado' || /N.½o informado/.test(extension.responsavel || '')) extension.responsavel = 'Não informado'; }
}
function repairLegacyDemandPriorities(data) {
  for (const demand of data.demandas || []) if (demand.prioridade === 'M?dia' || demand.prioridade === 'M�dia') demand.prioridade = 'Média';
}
function normalizeFileDb(data) {
  repairStoredText(data);
  repairLegacyExtensions(data);
  repairLegacyDemandPriorities(data);
  for (const key of [...Object.keys(resourceDefinitions), 'users', 'messages', 'auditLogs', 'announcements']) data[key] ||= [];
  for (const user of data.users) { if (user.mustChangePassword === undefined) user.mustChangePassword = verifyPassword('123456', user); if (user.active === undefined) user.active = true; user.activationStatus ||= user.active === false ? 'desativado' : 'ativo'; }
  data.demandStatuses ||= ['Aberta', 'Em andamento', 'Concluída'];
  for (const demand of data.demandas) if (!data.demandStatuses.includes(demand.status)) data.demandStatuses.push(demand.status);
  for (const [index, demand] of data.demandas.entries()) { demand.tipo ||= 'interna'; demand.ticket ||= `TI-${String(index + 1).padStart(4, '0')}`; demand.interacoes ||= []; }
  data.computerGroups ||= ['Geral', 'Faturamento', 'Eletivas', 'Laboratório'];
  for (const resource of ['computadores', 'equipamentos']) for (const record of data[resource]) {
    if (!record.avaliacao) record.avaliacao = /manuten/i.test(record.status || record.condicao || '') ? 'Precisa de manutenção' : 'Bom';
  }
  for (const record of data.equipamentos) { record.patrimonio ||= 'Não informado'; record.categoriaEquipamento ||= 'Periférico'; record.ip ||= '0.0.0.0'; record.localizacao ||= record.responsavel || 'Não informado'; record.numeroSerie ||= ''; record.dataRetirada ||= ''; record.dataDevolucao ||= ''; }
  for (const record of data.patrimonio) record.produto ||= record.descricao || 'Item patrimonial';
  for (const record of data.computadores) {
    record.ip ||= 'Não informado';
    record.grupo ||= 'Geral';
    record.dataSolicitacao ||= '';
    record.dataRetirada ||= '';
    record.dataDevolucao ||= '';
    if (!data.computerGroups.includes(record.grupo)) data.computerGroups.push(record.grupo);
  }
  if (!data.equipmentUnifiedAt) {
    const computerIds = new Set(data.computadores.map(record => record.id));
    for (const computer of data.computadores) {
      if (data.equipamentos.some(item => item.id === computer.id)) continue;
      data.equipamentos.push({ ...computer, equipamento: 'Computador', categoriaEquipamento: 'Computador', numeroSerie: computer.numeroSerie || '', condicao: computer.status === 'Ativo' ? 'Em uso' : computer.status || 'Em uso', localizacao: computer.localizacao || 'Não informado', dataRetirada: computer.dataRetirada || '', dataDevolucao: computer.dataDevolucao || '' });
    }
    for (const patrimony of data.patrimonio || []) if (patrimony.origem === 'computadores' && computerIds.has(patrimony.origemId)) patrimony.origem = 'equipamentos';
    data.computadores = [];
    data.equipmentUnifiedAt = now();
  }
  return data;
}
function readFileDb() { if (!fs.existsSync(DB_FILE)) { fs.mkdirSync(DB_DIR, { recursive: true }); const data = initialData(); writeFileDb(data); return data; } const raw = fs.readFileSync(DB_FILE, 'utf8').replace(/^\uFEFF/, ''); return normalizeFileDb(JSON.parse(raw)); }
function createFileBackup(force = false) {
  if (DATABASE_URL || !fs.existsSync(DB_FILE)) return null;
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const today = new Date().toISOString().slice(0, 10); const suffix = force ? `${today}-${new Date().toISOString().slice(11, 19).replaceAll(':', '-')}` : today;
  const backupPath = path.join(BACKUP_DIR, `central-ti-${suffix}.json`);
  if (!fs.existsSync(backupPath)) fs.copyFileSync(DB_FILE, backupPath);
  const oldBackups = fs.readdirSync(BACKUP_DIR).filter(name => /^central-ti-.*\.json$/.test(name)).map(name => ({ name, time: fs.statSync(path.join(BACKUP_DIR, name)).mtimeMs })).sort((a, b) => b.time - a.time).slice(30);
  for (const backup of oldBackups) fs.unlinkSync(path.join(BACKUP_DIR, backup.name));
  return backupPath;
}
function writeFileDb(data) { fs.mkdirSync(DB_DIR, { recursive: true }); fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2)); createFileBackup(); }
function publicUser(user) { return { id: user.id, nome: user.nome, email: user.email || '', login: user.login || '', setor: user.setor || '', cpfLast4: user.cpfLast4 || '', perfil: user.perfil, active: user.active !== false, activationStatus: user.activationStatus || 'ativo', permissions: user.permissions || null, mustChangePassword: Boolean(user.mustChangePassword), createdAt: user.createdAt }; }
function pgDate(value) { return value instanceof Date ? value.toISOString() : value || null; }
function normalizePgDates(row) { if (!row) return row; const value = { ...row }; for (const key of ['createdAt', 'updatedAt', 'readAt', 'senderDeletedAt', 'recipientDeletedAt', 'dataNascimento']) if (key in value) value[key] = pgDate(value[key]); return value; }
function pgRecord(row) { return { id: row.id, ...row.data, createdAt: pgDate(row.created_at), updatedAt: pgDate(row.updated_at), createdBy: row.created_by, updatedBy: row.updated_by }; }

const fileStore = {
  async users() { return readFileDb().users; },
  async findUserByEmail(email) { return readFileDb().users.find(user => user.email === email); },
  async findUserByLogin(login) { const clean = String(login || '').trim().toLowerCase(); return readFileDb().users.find(user => user.email?.toLowerCase() === clean || user.login?.toLowerCase() === clean); },
  async findUser(idValue) { return readFileDb().users.find(user => user.id === idValue); },
  async createUser(user) { const db = readFileDb(); db.users.push(user); writeFileDb(db); return user; },
  async renameUser(userId, nome) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; target.nome = nome; target.updatedAt = now(); writeFileDb(db); return target; },
  async setUserActive(userId, active) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; target.active = active; target.updatedAt = now(); writeFileDb(db); return target; },
  async setUserPermissions(userId, permissions) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; target.permissions = permissions; target.updatedAt = now(); writeFileDb(db); return target; },
  async updateUser(userId, fields) { const db = readFileDb(); const target = db.users.find(user => user.id === userId); if (!target) return null; Object.assign(target, fields, { updatedAt: now() }); writeFileDb(db); return target; },
  async updatePassword(userId, password) { const db = readFileDb(); const user = db.users.find(x => x.id === userId); if (!user) return null; Object.assign(user, passwordHash(password), { mustChangePassword: false, updatedAt: now() }); writeFileDb(db); return user; },
  async records(resource) { return readFileDb()[resource]; },
  async record(resource, recordId) { return readFileDb()[resource].find(record => record.id === recordId); },
  async createRecord(resource, record) { const db = readFileDb(); db[resource].push(record); writeFileDb(db); return record; },
  async updateRecord(resource, recordId, fields, userId) { const db = readFileDb(); const record = db[resource].find(item => item.id === recordId); if (!record) return null; Object.assign(record, fields, { updatedAt: now(), updatedBy: userId }); writeFileDb(db); return record; },
  async deleteRecord(resource, recordId) { const db = readFileDb(); const index = db[resource].findIndex(item => item.id === recordId); if (index < 0) return null; const [removed] = db[resource].splice(index, 1); writeFileDb(db); return removed; },
  async messagesFor(userId) { return readFileDb().messages.filter(message => message.recipientId === userId || message.senderId === userId); },
  async createMessage(message) { const db = readFileDb(); db.messages.push(message); writeFileDb(db); return message; },
  async markMessageRead(messageId, userId) { const db = readFileDb(); const message = db.messages.find(x => x.id === messageId && x.recipientId === userId); if (!message) return null; message.readAt = now(); writeFileDb(db); return message; },
  async deleteMessageFor(messageId, userId) { const db = readFileDb(); const message = db.messages.find(x => x.id === messageId && (x.recipientId === userId || x.senderId === userId)); if (!message) return null; if (message.recipientId === userId) message.recipientDeletedAt = now(); if (message.senderId === userId) message.senderDeletedAt = now(); writeFileDb(db); return message; },
  async announcements() { return readFileDb().announcements.sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  async createAnnouncement(announcement) { const db = readFileDb(); db.announcements.push(announcement); writeFileDb(db); return announcement; },
  async deleteAnnouncement(announcementId) { const db = readFileDb(); const index = db.announcements.findIndex(item => item.id === announcementId); if (index < 0) return null; const [removed] = db.announcements.splice(index, 1); writeFileDb(db); return removed; },
  async audit(entry) { const db = readFileDb(); db.auditLogs.push(entry); writeFileDb(db); },
  async audits(resource, recordId) { return readFileDb().auditLogs.filter(log => (!resource || log.resource === resource) && (!recordId || log.recordId === recordId)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); }
  ,async backupNow() { return createFileBackup(true); }
  ,async demandStatuses() { return readFileDb().demandStatuses; }
  ,async setDemandStatuses(statuses) { const db = readFileDb(); db.demandStatuses = statuses; writeFileDb(db); return statuses; }
  ,async computerGroups() { return readFileDb().computerGroups; }
  ,async setComputerGroups(groups) { const db = readFileDb(); db.computerGroups = groups; writeFileDb(db); return groups; }
};
const pgStore = {
  async users() { return (await pool.query('SELECT id,nome,email,login,setor,cpf_hash AS "cpfHash",cpf_last4 AS "cpfLast4",data_nascimento AS "dataNascimento",perfil,active,activation_status AS "activationStatus",permissions,salt,hash,must_change_password AS "mustChangePassword",created_at AS "createdAt",updated_at AS "updatedAt" FROM users ORDER BY nome')).rows.map(normalizePgDates); },
  async findUserByEmail(email) { return normalizePgDates((await pool.query('SELECT id,nome,email,login,setor,cpf_hash AS "cpfHash",cpf_last4 AS "cpfLast4",data_nascimento AS "dataNascimento",perfil,active,activation_status AS "activationStatus",permissions,salt,hash,must_change_password AS "mustChangePassword",created_at AS "createdAt",updated_at AS "updatedAt" FROM users WHERE lower(email) = lower($1)', [email])).rows[0]); },
  async findUserByLogin(login) { return normalizePgDates((await pool.query('SELECT id,nome,email,login,setor,cpf_hash AS "cpfHash",cpf_last4 AS "cpfLast4",data_nascimento AS "dataNascimento",perfil,active,activation_status AS "activationStatus",permissions,salt,hash,must_change_password AS "mustChangePassword",created_at AS "createdAt",updated_at AS "updatedAt" FROM users WHERE lower(email) = lower($1) OR lower(login) = lower($1)', [login])).rows[0]); },
  async findUser(idValue) { return normalizePgDates((await pool.query('SELECT id,nome,email,login,setor,cpf_hash AS "cpfHash",cpf_last4 AS "cpfLast4",data_nascimento AS "dataNascimento",perfil,active,activation_status AS "activationStatus",permissions,salt,hash,must_change_password AS "mustChangePassword",created_at AS "createdAt",updated_at AS "updatedAt" FROM users WHERE id = $1', [idValue])).rows[0]); },
  async createUser(user) { await pool.query('INSERT INTO users (id,nome,email,login,setor,cpf_hash,cpf_last4,data_nascimento,perfil,active,activation_status,permissions,salt,hash,must_change_password,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)', [user.id, user.nome, user.email || null, user.login || null, user.setor || '', user.cpfHash || null, user.cpfLast4 || '', user.dataNascimento || null, user.perfil, user.active !== false, user.activationStatus || 'ativo', JSON.stringify(user.permissions || {}), user.salt, user.hash, Boolean(user.mustChangePassword), user.createdAt, user.updatedAt || user.createdAt]); return user; },
  async updateUser(userId, fields) { const columns = { nome: 'nome', email: 'email', login: 'login', setor: 'setor', cpfHash: 'cpf_hash', cpfLast4: 'cpf_last4', dataNascimento: 'data_nascimento', perfil: 'perfil', active: 'active', activationStatus: 'activation_status', permissions: 'permissions', salt: 'salt', hash: 'hash', mustChangePassword: 'must_change_password' }; const entries = Object.entries(fields).filter(([key]) => key in columns); if (!entries.length) return this.findUser(userId); const values = entries.map(([key, value]) => key === 'permissions' ? JSON.stringify(value || {}) : value ?? null); const assignments = entries.map(([key], index) => `${columns[key]}=$${index + 2}`).join(', '); const result = await pool.query(`UPDATE users SET ${assignments}, updated_at=NOW() WHERE id=$1 RETURNING id,nome,email,login,setor,cpf_hash AS "cpfHash",cpf_last4 AS "cpfLast4",data_nascimento AS "dataNascimento",perfil,active,activation_status AS "activationStatus",permissions,salt,hash,must_change_password AS "mustChangePassword",created_at AS "createdAt",updated_at AS "updatedAt"`, [userId, ...values]); return normalizePgDates(result.rows[0]); },
  async renameUser(userId, nome) { return this.updateUser(userId, { nome }); },
  async setUserActive(userId, active) { return this.updateUser(userId, { active }); },
  async setUserPermissions(userId, permissions) { return this.updateUser(userId, { permissions }); },
  async updatePassword(userId, password) { const values = passwordHash(password); return this.updateUser(userId, { ...values, mustChangePassword: false }); },
  async records(resource) { return (await pool.query('SELECT id,data,created_at,updated_at,created_by,updated_by FROM records WHERE resource=$1 ORDER BY updated_at DESC', [resource])).rows.map(pgRecord); },
  async record(resource, recordId) { const row = (await pool.query('SELECT id,data,created_at,updated_at,created_by,updated_by FROM records WHERE resource=$1 AND id=$2', [resource, recordId])).rows[0]; return row && pgRecord(row); },
  async createRecord(resource, record) { await pool.query('INSERT INTO records (id,resource,data,created_at,updated_at,created_by,updated_by) VALUES ($1,$2,$3,$4,$5,$6,$7)', [record.id, resource, record, record.createdAt, record.updatedAt, record.createdBy, record.updatedBy]); return record; },
  async updateRecord(resource, recordId, fields, userId) { const previous = await this.record(resource, recordId); if (!previous) return null; const updated = { ...previous, ...fields, updatedAt: now(), updatedBy: userId }; await pool.query('UPDATE records SET data=$3,updated_at=$4,updated_by=$5 WHERE resource=$1 AND id=$2', [resource, recordId, updated, updated.updatedAt, userId]); return updated; },
  async deleteRecord(resource, recordId) { const previous = await this.record(resource, recordId); if (!previous) return null; await pool.query('DELETE FROM records WHERE resource=$1 AND id=$2', [resource, recordId]); return previous; },
  async messagesFor(userId) { return (await pool.query('SELECT id,sender_id AS "senderId",recipient_id AS "recipientId",subject,body,created_at AS "createdAt",read_at AS "readAt",sender_deleted_at AS "senderDeletedAt",recipient_deleted_at AS "recipientDeletedAt" FROM messages WHERE recipient_id=$1 OR sender_id=$1 ORDER BY created_at DESC', [userId])).rows.map(normalizePgDates); },
  async createMessage(message) { await pool.query('INSERT INTO messages (id,sender_id,recipient_id,subject,body,created_at,read_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [message.id, message.senderId, message.recipientId, message.subject, message.body, message.createdAt, message.readAt]); return message; },
  async markMessageRead(messageId, userId) { return (await pool.query('UPDATE messages SET read_at=NOW() WHERE id=$1 AND recipient_id=$2 RETURNING id', [messageId, userId])).rows[0]; },
  async deleteMessageFor(messageId, userId) { return (await pool.query('UPDATE messages SET recipient_deleted_at=CASE WHEN recipient_id=$2 THEN NOW() ELSE recipient_deleted_at END, sender_deleted_at=CASE WHEN sender_id=$2 THEN NOW() ELSE sender_deleted_at END WHERE id=$1 AND (recipient_id=$2 OR sender_id=$2) RETURNING id', [messageId, userId])).rows[0]; },
  async announcements() { return (await pool.query('SELECT id,title,body,author_id AS "authorId",author_name AS "authorName",created_at AS "createdAt" FROM announcements ORDER BY created_at DESC')).rows.map(normalizePgDates); },
  async createAnnouncement(announcement) { await pool.query('INSERT INTO announcements (id,title,body,author_id,author_name,created_at) VALUES ($1,$2,$3,$4,$5,$6)', [announcement.id, announcement.title, announcement.body, announcement.authorId, announcement.authorName, announcement.createdAt]); return announcement; },
  async deleteAnnouncement(announcementId) { const result = await pool.query('DELETE FROM announcements WHERE id=$1 RETURNING id,title,body,author_id AS "authorId",author_name AS "authorName",created_at AS "createdAt"', [announcementId]); return normalizePgDates(result.rows[0]); },
  async audit(entry) { await pool.query('INSERT INTO audit_logs (id,user_id,action,resource,record_id,details,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)', [entry.id, entry.userId, entry.action, entry.resource, entry.recordId, entry.details, entry.createdAt]); },
  async audits(resource, recordId) { const query = `SELECT a.id,a.action,a.resource,a.record_id AS "recordId",a.details,a.created_at AS "createdAt",u.nome AS "userName" FROM audit_logs a LEFT JOIN users u ON u.id=a.user_id WHERE ($1::text IS NULL OR a.resource=$1) AND ($2::uuid IS NULL OR a.record_id=$2) ORDER BY a.created_at DESC LIMIT 100`; return (await pool.query(query, [resource || null, recordId || null])).rows.map(normalizePgDates); }
  ,async backupNow() { return null; }
  ,async demandStatuses() { const row = (await pool.query("SELECT value FROM app_settings WHERE key='demand_statuses'")).rows[0]; return row?.value || ['Aberta', 'Em andamento', 'Concluída']; }
  ,async setDemandStatuses(statuses) { await pool.query("INSERT INTO app_settings (key,value) VALUES ('demand_statuses',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(statuses)]); return statuses; }
  ,async computerGroups() { const row = (await pool.query("SELECT value FROM app_settings WHERE key='computer_groups'")).rows[0]; return row?.value || ['Geral', 'Faturamento', 'Eletivas', 'Laboratório']; }
  ,async setComputerGroups(groups) { await pool.query("INSERT INTO app_settings (key,value) VALUES ('computer_groups',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value", [JSON.stringify(groups)]); return groups; }
};
let store = fileStore;
const sessionService = createSessionService({ getStore: () => store, sessionTtlMs: SESSION_TTL_MS, error });
const { sessions, tooManyAttempts, recordAttempt, getAuth, createSingleSession, requireAuth } = sessionService;

async function migratePostgres() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (id UUID PRIMARY KEY, nome TEXT NOT NULL, email TEXT UNIQUE, login TEXT UNIQUE, setor TEXT NOT NULL DEFAULT '', cpf_hash TEXT UNIQUE, cpf_last4 TEXT NOT NULL DEFAULT '', data_nascimento DATE, perfil TEXT NOT NULL, active BOOLEAN NOT NULL DEFAULT true, activation_status TEXT NOT NULL DEFAULT 'ativo', permissions JSONB NOT NULL DEFAULT '{}'::jsonb, salt TEXT NOT NULL, hash TEXT NOT NULL, must_change_password BOOLEAN NOT NULL DEFAULT false, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS records (id UUID PRIMARY KEY, resource TEXT NOT NULL, data JSONB NOT NULL, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL, created_by UUID, updated_by UUID);
    CREATE INDEX IF NOT EXISTS records_resource_updated_idx ON records(resource, updated_at DESC);
    CREATE TABLE IF NOT EXISTS messages (id UUID PRIMARY KEY, sender_id UUID NOT NULL, recipient_id UUID NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL, read_at TIMESTAMPTZ, sender_deleted_at TIMESTAMPTZ, recipient_deleted_at TIMESTAMPTZ);
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS sender_deleted_at TIMESTAMPTZ;
    ALTER TABLE messages ADD COLUMN IF NOT EXISTS recipient_deleted_at TIMESTAMPTZ;
    CREATE TABLE IF NOT EXISTS audit_logs (id UUID PRIMARY KEY, user_id UUID, action TEXT NOT NULL, resource TEXT, record_id UUID, details JSONB, created_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS announcements (id UUID PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, author_id UUID, author_name TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL);
    CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value JSONB NOT NULL);
    CREATE INDEX IF NOT EXISTS audit_resource_record_idx ON audit_logs(resource, record_id, created_at DESC);`);
  await pool.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false; ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB NOT NULL DEFAULT '{}'::jsonb; ALTER TABLE users ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true; ALTER TABLE users ADD COLUMN IF NOT EXISTS login TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS setor TEXT NOT NULL DEFAULT ''; ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf_hash TEXT; ALTER TABLE users ADD COLUMN IF NOT EXISTS cpf_last4 TEXT NOT NULL DEFAULT ''; ALTER TABLE users ADD COLUMN IF NOT EXISTS data_nascimento DATE; ALTER TABLE users ADD COLUMN IF NOT EXISTS activation_status TEXT NOT NULL DEFAULT 'ativo'; ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(); CREATE UNIQUE INDEX IF NOT EXISTS users_login_unique_idx ON users(login) WHERE login IS NOT NULL; CREATE UNIQUE INDEX IF NOT EXISTS users_cpf_hash_unique_idx ON users(cpf_hash) WHERE cpf_hash IS NOT NULL");
  const count = Number((await pool.query('SELECT COUNT(*)::int AS count FROM users')).rows[0].count);
  if (!count) {
    const data = fs.existsSync(DB_FILE) ? readFileDb() : initialData();
    for (const user of data.users) await pgStore.createUser(user);
    for (const resource of Object.keys(resourceDefinitions)) for (const record of data[resource] || []) await pgStore.createRecord(resource, { ...record, updatedAt: record.updatedAt || record.createdAt, createdBy: record.createdBy || null, updatedBy: record.updatedBy || null });
    for (const message of data.messages || []) await pgStore.createMessage(message);
    for (const announcement of data.announcements || []) await pgStore.createAnnouncement(announcement);
    for (const log of data.auditLogs || []) await pgStore.audit(log);
    await pgStore.setDemandStatuses(data.demandStatuses || ['Aberta', 'Em andamento', 'Concluída']);
    await pgStore.setComputerGroups(data.computerGroups || ['Geral', 'Faturamento', 'Eletivas', 'Laboratório']);
    console.log('Dados iniciais migrados para PostgreSQL.');
  }
  const localGroups = fs.existsSync(DB_FILE) ? readFileDb().computerGroups : ['Geral', 'Faturamento', 'Eletivas', 'Laboratório'];
  await pool.query("INSERT INTO app_settings (key,value) VALUES ('computer_groups',$1) ON CONFLICT (key) DO NOTHING", [JSON.stringify(localGroups)]);
}
async function verifyPostgresSchema() {
  await pool.query('SELECT id,nome,email,login,setor,cpf_hash,cpf_last4,data_nascimento,perfil,active,activation_status,permissions,salt,hash,must_change_password,created_at,updated_at FROM users LIMIT 0');
  await pool.query('SELECT id,resource,data,created_at,updated_at,created_by,updated_by FROM records LIMIT 0');
  await pool.query('SELECT id,sender_id,recipient_id,subject,body,created_at,read_at,sender_deleted_at,recipient_deleted_at FROM messages LIMIT 0');
  await pool.query('SELECT id,user_id,action,resource,record_id,details,created_at FROM audit_logs LIMIT 0');
  await pool.query('SELECT id,title,body,author_id,author_name,created_at FROM announcements LIMIT 0');
  await pool.query('SELECT key,value FROM app_settings LIMIT 0');
}
async function initializePostgres() {
  if (POSTGRES_MIGRATIONS_ENABLED) await migratePostgres();
  else await verifyPostgresSchema();
  store = pgStore;
}
function normalizePermissions(rawPermissions) { const permissions = {}; for (const resource of Object.keys(resourceDefinitions)) { const requested = rawPermissions?.[resource]; if (!requested || typeof requested !== 'object') continue; const legacyRead = requested.read !== false; permissions[resource] = { list: requested.list ?? legacyRead, consult: requested.consult ?? legacyRead, create: requested.create ?? requested.write ?? false, update: requested.update ?? requested.write ?? false, delete: Boolean(requested.delete) }; } return permissions; }
function canAccess(user, resource, mode = 'list') { if (user.perfil === 'admin') return true; const permission = user.permissions?.[resource]; if (permission) { const legacyRead = permission.read !== false; const map = { list: permission.list ?? legacyRead, consult: permission.consult ?? legacyRead, create: permission.create ?? permission.write ?? false, update: permission.update ?? permission.write ?? false, delete: Boolean(permission.delete) }; return Boolean(map[mode]); } if (user.permissions && Object.keys(user.permissions).length) return false; if ((mode === 'list' || mode === 'consult') && user.perfil === 'consulta') return true; return access[user.perfil]?.includes(resource) || false; }
function sanitize(values, keys) {
  const item = {};
  for (const key of keys) {
    const value = typeof values[key] === 'string' || typeof values[key] === 'number' ? repairTextEncoding(String(values[key]).trim()) : '';
    if (!value || value.length > 250) return null;
    item[key] = value;
  }
  const resource = Object.entries(resourceDefinitions).find(([, fields]) => fields === keys)?.[0];
  for (const key of optionalResourceFields[resource] || []) {
    const value = repairTextEncoding(String(values[key] || '').trim());
    const limit = key === 'descricao' ? 3000 : 250;
    if (value.length > limit) return null;
    item[key] = value;
  }
  if (values.observacoes !== undefined) {
    const observacoes = repairTextEncoding(String(values.observacoes || '').trim());
    if (observacoes.length > 5000) return null;
    item.observacoes = observacoes;
  }
  if (resource === 'demandas') {
    const note = repairTextEncoding(String(values.novaObservacao || '').trim());
    if (note.length > 3000) return null;
    item.novaObservacao = note;
    if (values.tipo === 'externa') {
      for (const key of ['empresa', 'contato', 'email', 'descricao']) {
        const value = repairTextEncoding(String(values[key] || '').trim());
        if (!value || value.length > (key === 'descricao' ? 3000 : 250)) return null;
        item[key] = value;
      }
      if (!/^\S+@\S+\.\S+$/.test(item.email)) return null;
      item.tipo = 'externa';
    } else item.tipo = 'interna';
  }
  return item;
}
const sanitizeOriginal = sanitize;
sanitize = function (values, keys) {
  if (keys === resourceDefinitions.demandas && values?.tipo === 'externa') values = { ...values, empresa: 'Hospital Dia Revitalite', contato: values.contato || 'Não informado', email: values.email || 'hospital@revitalite.local', descricao: values.descricao || values.novaObservacao || 'Não informado' };
  return sanitizeOriginal(values, keys);
};
function sanitizeDemand(values) {
  if (values?.tipo === 'externa') values = { ...values, empresa: 'Hospital Dia Revitalite', contato: values.contato || 'Não informado', email: values.email || 'hospital@revitalite.local', descricao: values.descricao || values.novaObservacao || 'Não informado' };
  const demand = sanitize(values, resourceDefinitions.demandas); if (!demand) return null;
  if (!demand.categoria || (demand.categoria === 'Outros' ? !demand.outroDetalhe : !demand.assunto)) return null;
  const detailFields = sanitizeDemandDetailFields(values, demand.assunto);
  if (!detailFields) return null;
  Object.assign(demand, detailFields);
  if (isExclusionDemand(demand)) {
    const exclusion = sanitizeExclusionRequest(values);
    if (!exclusion) return null;
    Object.assign(demand, exclusion);
  }
  demand.tipo = values.tipo === 'externa' ? 'externa' : 'interna';
  if (demand.tipo === 'externa') {
    for (const key of ['empresa', 'contato', 'email', 'descricao']) { const value = repairTextEncoding(String(values[key] || '').trim()); if (!value || value.length > (key === 'descricao' ? 3000 : 250)) return null; demand[key] = value; }
    if (!/^\S+@\S+\.\S+$/.test(demand.email)) return null;
  }
  return demand;
}
function isExclusionDemand(demand) {
  const subject = String(typeof demand === 'object' ? demand?.assunto : demand || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  return subject.includes('exclusao');
}
function demandDetailRequirement(subject) {
  const normalized = String(subject || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (normalized.includes('atualizar taxa') || normalized.includes('atualizar valor de procedimento')) return ['codigoProcedimento', 'convenio', 'valorProcedimento'];
  if (normalized.includes('incluir procedimento')) return ['valorProcedimento', 'tuss'];
  if (normalized.includes('atualizar tabela')) return ['convenio', 'tabela'];
  return [];
}
function sanitizeDemandDetailFields(values, subject) {
  const required = demandDetailRequirement(subject);
  const result = {};
  for (const key of ['codigoProcedimento', 'convenio', 'valorProcedimento', 'tuss', 'tabela']) {
    const value = repairTextEncoding(String(values[key] || '').trim());
    if (value.length > 250 || (required.includes(key) && !value)) return null;
    result[key] = required.includes(key) ? value : '';
  }
  return result;
}
function exclusionValue(record, field) {
  if (field === 'user') return record.usuarioSolicitante || record.solicitante || 'Não informado';
  if (field === 'sector') return record.setorSolicitante || 'Não informado';
  if (field === 'type') return record.assunto || 'Não informado';
  if (field === 'reason') return record.categoriaMotivoExclusao || 'Não categorizado';
  if (field === 'status') return record.status || 'Não informado';
  return '';
}
function exclusionStatus(record) {
  const value = String(record.status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (/recus|cancel/.test(value)) return 'declined';
  return isCompletedDemandStatus(record.status) ? 'completed' : 'pending';
}
function countExclusions(records, field) {
  return [...records.reduce((map, record) => map.set(exclusionValue(record, field), (map.get(exclusionValue(record, field)) || 0) + 1), new Map()).entries()].map(([label, total]) => ({ label, total })).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
}
function buildExclusionReport(demands, filters = {}) {
  const all = demands.filter(isExclusionDemand);
  const filtered = all.filter(record => ['user', 'sector', 'type', 'reason', 'status'].every(field => !filters[field] || exclusionValue(record, field) === filters[field]));
  const months = [...filtered.reduce((map, record) => {
    const key = String(record.createdAt || '').slice(0, 7) || 'Sem data';
    const current = map.get(key) || { month: key, total: 0, completed: 0 };
    current.total += 1;
    if (exclusionStatus(record) === 'completed') current.completed += 1;
    map.set(key, current);
    return map;
  }, new Map()).values()].sort((a, b) => a.month.localeCompare(b.month));
  const recurring = [...filtered.reduce((map, record) => {
    const label = `${exclusionValue(record, 'user')} · ${exclusionValue(record, 'reason')}`;
    map.set(label, (map.get(label) || 0) + 1);
    return map;
  }, new Map()).entries()].map(([label, total]) => ({ label, total })).filter(item => item.total > 1).sort((a, b) => b.total - a.total || a.label.localeCompare(b.label, 'pt-BR'));
  return {
    total: filtered.length,
    completed: filtered.filter(record => exclusionStatus(record) === 'completed').length,
    pending: filtered.filter(record => exclusionStatus(record) === 'pending').length,
    declined: filtered.filter(record => exclusionStatus(record) === 'declined').length,
    users: countExclusions(filtered, 'user'), sectors: countExclusions(filtered, 'sector'), types: countExclusions(filtered, 'type'), reasons: countExclusions(filtered, 'reason'), statuses: countExclusions(filtered, 'status'), months, recurring,
    filters: Object.fromEntries(['user', 'sector', 'type', 'reason', 'status'].map(field => [field, countExclusions(all, field).map(item => item.label)])),
    records: filtered.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
  };
}
function sanitizeExclusionRequest(values) {
  const category = repairTextEncoding(String(values.categoriaMotivoExclusao || '').trim());
  if (!EXCLUSION_REASON_CATEGORIES.includes(category)) return null;
  const fields = [['numeroAtendimento', 100], ['nomePaciente', 250], ['motivoExclusao', 1000]];
  const result = {};
  for (const [key, limit] of fields) {
    const value = repairTextEncoding(String(values[key] || '').trim());
    if (!value || value.length > limit) return null;
    result[key] = value;
  }
  result.categoriaMotivoExclusao = category;
  return result;
}
function markExclusionMetadata(record, user) {
  if (!isExclusionDemand(record)) return;
  record.usuarioSolicitante ||= user.nome;
  record.setorSolicitante ||= user.setor || 'Não informado';
  record.solicitanteId ||= user.id;
  if (isCompletedDemandStatus(record.status) && !record.exclusaoConcluidaEm) {
    record.exclusaoConcluidaPor = user.nome;
    record.exclusaoConcluidaEm = now();
  }
}
function sanitizeChecklist(value) { if (!Array.isArray(value)) return []; return [...new Set(value.filter(item => computerChecklist.includes(item)))]; }
function sanitizeHospitalDemand(values, user) {
  const text = (value, limit = 250) => repairTextEncoding(String(value || '').trim());
  const demand = { titulo: text(values.titulo), solicitante: user.nome, prioridade: text(values.prioridade), status: 'Aberta', categoria: text(values.categoria), assunto: text(values.assunto), outroDetalhe: text(values.outroDetalhe), tipo: 'externa', descricao: text(values.descricao || values.novaObservacao || 'Não informado', 3000), tecnicoResponsavel: '', prazoSla: '', novaObservacao: text(values.novaObservacao, 3000) };
  if (!demand.titulo || !demand.prioridade || !demand.categoria || (demand.categoria === 'Outros' ? !demand.outroDetalhe : !demand.assunto) || !demand.descricao || Object.values(demand).some(value => String(value).length > 3000)) return null;
  const detailFields = sanitizeDemandDetailFields(values, demand.assunto);
  if (!detailFields) return null;
  Object.assign(demand, detailFields);
  if (isExclusionDemand(demand)) {
    const exclusion = sanitizeExclusionRequest(values);
    if (!exclusion) return null;
    Object.assign(demand, exclusion);
  }
  return demand;
}
function sanitizeOptionalDate(value) { if (value === undefined || value === null || value === '') return ''; const date = String(value).trim(); return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null; }
function normalizeProgramValue(value) { const digits = String(value || '').replace(/\D/g, ''); const cents = Number(digits); return Number.isSafeInteger(cents) && cents > 0 && cents <= 100000000000 ? cents : null; }
function formatProgramValue(cents) { return (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }); }
function automaticSla(priority) { const hours = { 'Crítica': 4, Alta: 24, 'Média': 48, Baixa: 120 }[priority] || 48; return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString(); }
function validateRecordCharacters(resource, payload) {
  for (const value of Object.values(payload)) if (typeof value === 'string' && /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F<>\uFFFD]/.test(value)) return 'Há caracteres inválidos no cadastro. Revise acentos, símbolos e texto copiado.';
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
function isAsset(resource) { return resource === 'computadores' || resource === 'equipamentos'; }
function assetSituation(resource, record) {
  const current = String(resource === 'computadores' ? record.status : record.condicao).toLowerCase();
  if (current.includes('dispon')) return 'Disponível';
  if (current.includes('manuten')) return 'Em manutenção';
  if (current.includes('indispon')) return 'Indisponível';
  return 'Em uso';
}
function assetDescription(resource, record) { return resource === 'computadores' ? `Computador · ${record.patrimonio}` : `${record.equipamento} · ${record.categoriaEquipamento || 'Equipamento'}`; }
async function nextPatrimonyCode() {
  const highest = (await store.records('patrimonio')).reduce((max, item) => {
    const match = String(item.codigo || '').match(/^PAT-(\d+)$/i);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return `PAT-${String(highest + 1).padStart(4, '0')}`;
}
async function ensurePatrimonyCodeAvailable(resource, record, recordId = null) {
  if (!isAsset(resource)) return null;
  if (!record.patrimonio || record.patrimonio === 'Não informado') return 'Informe um código patrimonial válido.';
  const existing = (await store.records('patrimonio')).find(item => item.codigo.toLowerCase() === record.patrimonio.toLowerCase() && !(item.origem === resource && item.origemId === recordId));
  return existing ? `O patrimônio ${record.patrimonio} já está vinculado a outro item.` : null;
}
async function ensureSerialNumberAvailable(resource, record, recordId = null) {
  if (!isAsset(resource) || !record.numeroSerie) return null;
  const serial = record.numeroSerie.toLowerCase();
  const resources = ['computadores', 'equipamentos'];
  for (const kind of resources) for (const item of await store.records(kind)) if (item.numeroSerie && item.numeroSerie.toLowerCase() === serial && !(kind === resource && item.id === recordId) && !/devolvido|baixado/i.test(item.status || item.condicao || '')) return `O número de série ${record.numeroSerie} já está vinculado a um item em uso.`;
  return null;
}
async function syncAssetPatrimony(resource, asset, userId) {
  if (!isAsset(resource)) return;
  const fields = { codigo: asset.patrimonio, descricao: assetDescription(resource, asset), localizacao: asset.localizacao || asset.responsavel, situacao: assetSituation(resource, asset), origem: resource, origemId: asset.id };
  const existing = (await store.records('patrimonio')).find(item => item.origem === resource && item.origemId === asset.id);
  if (existing) await store.updateRecord('patrimonio', existing.id, fields, userId);
  else await store.createRecord('patrimonio', { id: id(), ...fields, createdAt: now(), updatedAt: now(), createdBy: userId, updatedBy: userId });
}
async function retireAssetPatrimony(resource, asset, userId) {
  if (!isAsset(resource)) return;
  const existing = (await store.records('patrimonio')).find(item => item.origem === resource && item.origemId === asset.id);
  if (existing) await store.updateRecord('patrimonio', existing.id, { situacao: 'Baixado' }, userId);
}
async function notifyAdmins(senderId, subject, body) {
  const admins = (await store.users()).filter(person => person.perfil === 'admin' && person.id !== senderId);
  for (const admin of admins) await store.createMessage({ id: id(), senderId, recipientId: admin.id, subject, body, createdAt: now(), readAt: null, systemAlert: true });
}
async function notifyTicketComment(demand, sender, text) {
  const people = await store.users();
  const requester = people.find(person => person.id === demand.solicitanteId)
    || people.find(person => person.nome?.trim().toLowerCase() === demand.solicitante?.trim().toLowerCase());
  const staffMember = sender.perfil === 'admin' || sender.perfil === 'ti';
  const recipients = staffMember
    ? (requester && requester.id !== sender.id ? [requester] : [])
    : people.filter(person => ['admin', 'ti'].includes(person.perfil) && person.active !== false && person.id !== sender.id);
  const preview = text.length > 220 ? `${text.slice(0, 217)}...` : text;
  for (const recipient of recipients) {
    await store.createMessage({
      id: id(), senderId: sender.id, recipientId: recipient.id,
      subject: `Nova resposta · ${demand.ticket || 'Chamado'}`,
      body: `${sender.nome} respondeu ao chamado “${demand.titulo}”:\n\n${preview}`,
      createdAt: now(), readAt: null, systemAlert: true
    });
  }
}
async function alertAssetCondition(resource, record, userId) {
  if (!isAsset(resource) || record.avaliacao === 'Bom') return;
  const assetName = resource === 'computadores' ? `Computador ${record.patrimonio}` : `${record.equipamento} (${record.patrimonio})`;
  await notifyAdmins(userId, `Alerta técnico: ${assetName}`, `${assetName} está marcado como “${record.avaliacao}”. Responsável: ${record.responsavel}. Verifique o cadastro na Central TI.`);
}
function isCompletedDemandStatus(status) { const normalized = String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return /conclu|finaliz|resolvid|encerr/.test(normalized); }
function isOpenDemandStatus(status) { const normalized = String(status || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(); return /abert|novo|pendente|aguard|solicit/.test(normalized); }
function inProgressDemandStatus(statuses, fallback) { return statuses.find(status => /andamento|atendi|execuc|tratamento/i.test(String(status).normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) || fallback; }
async function notifyTicketLifecycle(previous, record, actorId) {
  if (!record.solicitante) return;
  const people = await store.users();
  const requester = people.find(person => person.id === record.solicitanteId) || people.find(person => person.nome.trim().toLowerCase() === record.solicitante.trim().toLowerCase());
  if (!requester || requester.id === actorId) return {};
  const notifications = previous?.lifecycleNotifications || record.lifecycleNotifications || {};
  const wasAssigned = !previous?.tecnicoResponsavel && record.tecnicoResponsavel;
  const wasStarted = previous && isOpenDemandStatus(previous.status) && !isOpenDemandStatus(record.status) && !isCompletedDemandStatus(record.status);
  const wasFinished = previous && !isCompletedDemandStatus(previous.status) && isCompletedDemandStatus(record.status);
  const changed = {};
  if ((wasAssigned || wasStarted) && !notifications.inicioEnviado) { await store.createMessage({ id: id(), senderId: actorId, recipientId: requester.id, subject: `Atendimento iniciado · ${record.ticket || 'Demanda'}`, body: `Olá, ${requester.nome}. Sua demanda “${record.titulo}” foi assumida por ${record.tecnicoResponsavel || 'a equipe de T.I.'}. O atendimento foi iniciado.`, createdAt: now(), readAt: null, systemAlert: true }); changed.inicioEnviado = now(); }
  if (wasFinished && !notifications.conclusaoEnviada) { await store.createMessage({ id: id(), senderId: actorId, recipientId: requester.id, subject: `Atendimento concluído · ${record.ticket || 'Demanda'}`, body: `Olá, ${requester.nome}. Sua demanda “${record.titulo}” foi concluída. Caso precise de algo mais, abra uma nova demanda.`, createdAt: now(), readAt: null, systemAlert: true }); changed.conclusaoEnviada = now(); }
  return changed;
}
async function log(userId, action, resource = null, recordId = null, details = {}) { await store.audit({ id: id(), userId, action, resource, recordId, details, createdAt: now() }); }
function localAddresses() { return Object.values(os.networkInterfaces()).flat().filter(item => item && item.family === 'IPv4' && !item.internal).map(item => `http://${item.address}:${PORT}`); }
function microSipStatus() {
  const candidates = [
    process.env.MICROSIP_PATH,
    path.join(process.env.ProgramFiles || 'C:\\Program Files', 'MicroSIP', 'microsip.exe'),
    path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)', 'MicroSIP', 'microsip.exe'),
    process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'MicroSIP', 'microsip.exe') : ''
  ].filter(Boolean);
  const available = candidates.some(candidate => fs.existsSync(candidate));
  return { available, message: available ? 'MicroSIP disponível para ligação.' : 'MicroSIP não está instalado. Use o telefone fixo para realizar a ligação.' };
}
function csv(records, keys) { const quote = value => `"${String(value ?? '').replaceAll('"', '""')}"`; return `\uFEFF${keys.join(';')}\n${records.map(row => keys.map(key => quote(row[key])).join(';')).join('\n')}`; }
async function api(req, res, url) {
  const { pathname } = url;
  if (req.method === 'GET' && pathname === '/api/health') return respond(res, 200, { ok: true, database: DATABASE_URL ? 'postgresql' : 'arquivo-local', networkUrls: localAddresses() });
  if (req.method === 'POST' && pathname === '/api/auth/login') {
    if (tooManyAttempts(req)) return error(res, 429, 'Muitas tentativas. Tente novamente em 15 minutos.');
    const { email = '', password = '' } = await requestBody(req); const user = await (store.findUserByLogin ? store.findUserByLogin(String(email).trim().toLowerCase()) : store.findUserByEmail(String(email).trim().toLowerCase()));
    if (!user || !user.hash || !user.salt || !verifyPassword(password, user)) { recordAttempt(req, false); return error(res, 401, 'E-mail ou senha inválidos.'); }
    if (user.active === false) return error(res, 403, 'Este usuário está desativado. Procure um administrador.');
    recordAttempt(req, true);
    if (TWO_FACTOR_REQUIRED) {
      if (!emailService.enabled) return error(res, 503, 'A validação por e-mail está ativa, mas o envio SMTP não foi configurado.');
      const verificationToken = crypto.randomBytes(32).toString('hex'); const code = String(crypto.randomInt(100000, 1000000)); verificationChallenges.set(verificationToken, { userId: user.id, codeHash: crypto.createHash('sha256').update(code).digest('hex'), expiresAt: Date.now() + 10 * 60 * 1000, attempts: 0 });
      try { await emailService.sendVerificationCode(user, code); } catch (exception) { verificationChallenges.delete(verificationToken); console.error('Erro ao enviar código de verificação:', exception.message); return error(res, 503, 'Não foi possível enviar o código para o e-mail cadastrado.'); }
      return respond(res, 200, { requiresVerification: true, verificationToken, email: user.email.replace(/^(.{1,2}).*(@.*)$/, '$1***$2'), expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString() });
    }
    const token = createSingleSession(user.id); await log(user.id, 'login'); return respond(res, 200, { token, user: publicUser(user), expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  }
  if (req.method === 'POST' && pathname === '/api/first-access/identify') { const { nome, cpf } = await requestBody(req); const cleanCpf = normalizeCpf(cpf); const user = cleanCpf && (await store.users()).find(item => item.cpfHash === cpfHash(cleanCpf) && firstName(item.nome) === firstName(nome)); if (!user || user.activationStatus !== 'pre-cadastro') return error(res, 401, 'Não localizamos um pré-cadastro com esses dados.'); const token = crypto.randomBytes(32).toString('hex'); firstAccessChallenges.set(token, { userId: user.id, expiresAt: Date.now() + 15 * 60 * 1000 }); return respond(res, 200, { token, nome: user.nome, setor: user.setor || '' }); }
  if (req.method === 'POST' && pathname === '/api/first-access/complete') { const { token, dataNascimento, email, login, senha } = await requestBody(req); const challenge = firstAccessChallenges.get(token); if (!challenge || challenge.expiresAt < Date.now()) return error(res, 401, 'Sua validação expirou. Faça o primeiro acesso novamente.'); const user = await store.findUser(challenge.userId); const cleanEmail = String(email || '').trim().toLowerCase(), cleanLogin = String(login || '').trim().toLowerCase(); if (!user || user.activationStatus !== 'pre-cadastro' || !/^\d{4}-\d{2}-\d{2}$/.test(String(dataNascimento || '')) || !/^\S+@\S+\.\S+$/.test(cleanEmail) || !/^[a-z0-9._-]{3,50}$/.test(cleanLogin) || typeof senha !== 'string' || senha.length < 8 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/\d/.test(senha) || !/[^A-Za-z0-9]/.test(senha)) return error(res, 422, 'Revise os dados. A senha precisa ter 8+ caracteres, maiúscula, minúscula, número e símbolo.'); const duplicate = (await store.users()).find(item => item.id !== user.id && (item.email?.toLowerCase() === cleanEmail || item.login?.toLowerCase() === cleanLogin)); if (duplicate) return error(res, 409, 'Este e-mail ou login já está em uso.'); const credentials = passwordHash(senha); const updated = await store.updateUser(user.id, { dataNascimento, email: cleanEmail, login: cleanLogin, ...credentials, active: false, activationStatus: 'aguardando aprovação', mustChangePassword: false, permissions: collaboratorPermissions() }); firstAccessChallenges.delete(token); await log(updated.id, 'concluiu primeiro acesso', 'users', updated.id, { setor: updated.setor }); return respond(res, 200, { ok: true }); }
  if (req.method === 'POST' && pathname === '/api/auth/verify-email') {
    const { verificationToken, code } = await requestBody(req); const challenge = verificationChallenges.get(verificationToken); if (!challenge || challenge.expiresAt < Date.now() || challenge.attempts >= 5) { if (verificationToken) verificationChallenges.delete(verificationToken); return error(res, 401, 'O código expirou. Entre novamente para solicitar outro.'); }
    const receivedHash = crypto.createHash('sha256').update(String(code || '')).digest('hex'); if (!crypto.timingSafeEqual(Buffer.from(receivedHash, 'hex'), Buffer.from(challenge.codeHash, 'hex'))) { challenge.attempts += 1; return error(res, 401, 'Código inválido.'); }
    verificationChallenges.delete(verificationToken); const verifiedUser = await store.findUser(challenge.userId); if (!verifiedUser) return error(res, 401, 'Usuário não encontrado.'); const token = createSingleSession(verifiedUser.id); await log(verifiedUser.id, 'login com validação de e-mail'); return respond(res, 200, { token, user: publicUser(verifiedUser), expiresAt: new Date(Date.now() + SESSION_TTL_MS).toISOString() });
  }
  if (req.method === 'POST' && pathname === '/api/auth/logout') { const token = req.headers.authorization?.replace(/^Bearer\s+/i, ''); if (token) sessions.delete(token); return respond(res, 200, { ok: true }); }
  const user = await requireAuth(req, res); if (!user) return;
  if (req.method === 'GET' && pathname === '/api/me') return respond(res, 200, { user: publicUser(user), networkUrls: localAddresses(), database: DATABASE_URL ? 'PostgreSQL' : 'Arquivo local (configure PostgreSQL para operação multiusuário)' });
  if (req.method === 'GET' && pathname === '/api/integrations/microsip/status') return respond(res, 200, microSipStatus());
  if (req.method === 'POST' && pathname === '/api/auth/change-password') { const { currentPassword, newPassword } = await requestBody(req); if (!verifyPassword(currentPassword || '', user)) return error(res, 401, 'Sua senha atual está incorreta.'); if (typeof newPassword !== 'string' || newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[A-Z]/.test(newPassword) || !/\d/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) return error(res, 422, 'Use ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo.'); await store.updatePassword(user.id, newPassword); await log(user.id, 'alterou a própria senha'); return respond(res, 200, { ok: true }); }
  if (user.mustChangePassword) return error(res, 403, 'Altere sua senha antes de acessar o sistema.');
  if (req.method === 'GET' && pathname === '/api/users') return respond(res, 200, { users: (await store.users()).map(publicUser) });
  if (req.method === 'POST' && pathname === '/api/users') {
    if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem criar usuários.'); const body = await requestBody(req); const nome = String(body.nome || '').trim(); const email = String(body.email || '').trim().toLowerCase(); const perfil = String(body.perfil || 'consulta'); const senha = String(body.senha || '');
    const rawPermissions = body.permissions && typeof body.permissions === 'object' ? body.permissions : {}; const permissions = normalizePermissions(rawPermissions);
    if (!nome || nome.length > 120 || !/^\S+@\S+\.\S+$/.test(email) || !['admin', 'ti', 'consulta'].includes(perfil) || senha.length < 8 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/\d/.test(senha) || !/[^A-Za-z0-9]/.test(senha)) return error(res, 422, 'Revise os dados: senha com 8+ caracteres, maiúscula, minúscula, número e símbolo.'); if (await store.findUserByEmail(email)) return error(res, 409, 'Já existe um usuário com este e-mail.');
    const { salt, hash } = passwordHash(senha); const created = { id: id(), nome, email, perfil, active: true, permissions, salt, hash, mustChangePassword: true, createdAt: now() }; await store.createUser(created); await log(user.id, 'criou usuário', 'users', created.id, { nome, email, perfil, permissions }); return respond(res, 201, { user: publicUser(created) });
  }
  if (req.method === 'POST' && pathname === '/api/users/pre-cadastro') { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem criar pré-cadastros.'); const body = await requestBody(req); const nome = repairTextEncoding(String(body.nome || '').trim()), cpf = normalizeCpf(body.cpf), setor = repairTextEncoding(String(body.setor || '').trim()); if (!nome || nome.length > 120 || !cpf || !setor || setor.length > 120) return error(res, 422, 'Informe nome, CPF e setor corretamente.'); if ((await store.users()).some(item => item.cpfHash === cpfHash(cpf))) return error(res, 409, 'Já existe um cadastro para este CPF.'); const placeholderCredentials = passwordHash(crypto.randomBytes(32).toString('hex')); const created = { id: id(), nome, setor, cpfHash: cpfHash(cpf), cpfLast4: cpf.slice(-4), perfil: 'consulta', active: false, activationStatus: 'pre-cadastro', permissions: collaboratorPermissions(), ...placeholderCredentials, mustChangePassword: false, createdAt: now() }; await store.createUser(created); await log(user.id, 'criou pré-cadastro', 'users', created.id, { nome, setor, cpfLast4: created.cpfLast4 }); return respond(res, 201, { user: publicUser(created) }); }
  const approveMatch = pathname.match(/^\/api\/users\/([\w-]+)\/approve$/); if (req.method === 'PUT' && approveMatch) { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem ativar cadastros.'); const target = await store.findUser(approveMatch[1]); if (!target || target.activationStatus !== 'aguardando aprovação') return error(res, 422, 'Este cadastro não está aguardando aprovação.'); const updated = await store.updateUser(target.id, { active: true, activationStatus: 'ativo' }); await log(user.id, 'ativou cadastro', 'users', updated.id, { nome: updated.nome }); return respond(res, 200, { user: publicUser(updated) }); }
  const renameMatch = pathname.match(/^\/api\/users\/([\w-]+)\/name$/); if (req.method === 'PUT' && renameMatch) { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem alterar usuários.'); const { nome } = await requestBody(req); const clean = repairTextEncoding(String(nome || '').trim()); if (!clean || clean.length > 120) return error(res, 422, 'Informe um nome válido.'); const updated = await store.renameUser(renameMatch[1], clean); if (!updated) return error(res, 404, 'Usuário não encontrado.'); await log(user.id, 'alterou nome de usuário', 'users', updated.id, { nome: updated.nome }); return respond(res, 200, { user: publicUser(updated) }); }
  const permissionsMatch = pathname.match(/^\/api\/users\/([\w-]+)\/permissions$/); if (req.method === 'PUT' && permissionsMatch) { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem alterar permissões.'); if (permissionsMatch[1] === user.id) return error(res, 422, 'As permissões do seu próprio administrador não podem ser restringidas.'); const body = await requestBody(req); const updated = await store.setUserPermissions(permissionsMatch[1], normalizePermissions(body.permissions)); if (!updated) return error(res, 404, 'Usuário não encontrado.'); await log(user.id, 'alterou permissões', 'users', updated.id, { nome: updated.nome, permissions: updated.permissions }); return respond(res, 200, { user: publicUser(updated) }); }
  const activationMatch = pathname.match(/^\/api\/users\/([\w-]+)\/active$/); if (req.method === 'PUT' && activationMatch) { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem alterar usuários.'); const { active } = await requestBody(req); if (typeof active !== 'boolean') return error(res, 422, 'Informe o estado do usuário.'); if (activationMatch[1] === user.id && !active) return error(res, 422, 'Você não pode desativar seu próprio usuário.'); const updated = await store.setUserActive(activationMatch[1], active); if (!updated) return error(res, 404, 'Usuário não encontrado.'); if (!active) for (const [token, session] of sessions) if (session.userId === updated.id) sessions.delete(token); await log(user.id, active ? 'ativou usuário' : 'desativou usuário', 'users', updated.id, { nome: updated.nome }); return respond(res, 200, { user: publicUser(updated) }); }
  const passwordMatch = pathname.match(/^\/api\/users\/([\w-]+)\/password$/); if (req.method === 'PUT' && passwordMatch) { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem redefinir senhas.'); const { password } = await requestBody(req); if (typeof password !== 'string' || password.length < 8 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password) || !/[^A-Za-z0-9]/.test(password)) return error(res, 422, 'Use ao menos 8 caracteres, com maiúscula, minúscula, número e símbolo.'); const updated = await store.updatePassword(passwordMatch[1], password); if (!updated) return error(res, 404, 'Usuário não encontrado.'); await log(user.id, 'redefiniu senha', 'users', updated.id, { nome: updated.nome }); return respond(res, 200, { ok: true }); }
  if (req.method === 'POST' && pathname === '/api/backups') { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem gerar backup.'); const backupPath = await store.backupNow(); await log(user.id, 'gerou backup', 'backup', null, { mode: DATABASE_URL ? 'postgresql' : 'arquivo-local' }); return respond(res, 200, { ok: true, backup: backupPath ? path.basename(backupPath) : null, message: backupPath ? 'Backup criado com sucesso.' : 'No PostgreSQL, configure backup do servidor do banco.' }); }
  const historyMatch = pathname.match(/^\/api\/resources\/([a-z]+)\/([\w-]+)\/history$/); if (req.method === 'GET' && historyMatch) { const [, resource, recordId] = historyMatch; if (!resourceDefinitions[resource] || !canAccess(user, resource)) return error(res, 403, 'Você não tem permissão para este histórico.'); if (resource === 'demandas') { const demand = await store.record(resource, recordId); if (!demand || !demandBelongsToUser(demand, user)) return error(res, 404, 'Demanda não encontrada.'); } return respond(res, 200, { logs: await store.audits(resource, recordId) }); }
  if (req.method === 'GET' && pathname === '/api/locations/computadores') { if (!canAccess(user, 'equipamentos')) return error(res, 403, 'Você não tem permissão para equipamentos.'); const records = await store.records('equipamentos'); const groups = [...new Set(records.map(record => record.categoriaEquipamento || 'Equipamento'))]; return respond(res, 200, { groups: groups.map(group => ({ group, total: records.filter(record => (record.categoriaEquipamento || 'Equipamento') === group).length })), records: records.map(record => ({ ...record, grupo: record.categoriaEquipamento || 'Equipamento', status: record.condicao })) }); }
  if (req.method === 'GET' && pathname === '/api/demand-statuses') { if (!canAccess(user, 'demandas')) return error(res, 403, 'Você não tem permissão para demandas.'); return respond(res, 200, { statuses: await store.demandStatuses() }); }
  if (req.method === 'GET' && pathname === '/api/computer-groups') { if (!canAccess(user, 'computadores')) return error(res, 403, 'Você não tem permissão para computadores.'); return respond(res, 200, { groups: await store.computerGroups() }); }
  if (req.method === 'PUT' && pathname === '/api/computer-groups') {
    if (!canAccess(user, 'computadores', 'update')) return error(res, 403, 'Você não tem permissão para alterar os grupos.');
    const { groups } = await requestBody(req); const clean = Array.isArray(groups) ? [...new Set(groups.map(group => repairTextEncoding(String(group).trim())).filter(group => group.length >= 2 && group.length <= 50 && /^[\p{L}\p{N}][\p{L}\p{N} .&()/_-]{1,49}$/u.test(group)))] : [];
    if (!clean.length || clean.length > 30) return error(res, 422, 'Informe de 1 a 30 grupos, com 2 a 50 caracteres cada.');
    const inUse = (await store.records('computadores')).map(record => record.grupo).filter(group => group && !clean.includes(group));
    if (inUse.length) return error(res, 422, `Não é possível remover grupos em uso: ${[...new Set(inUse)].join(', ')}.`);
    await store.setComputerGroups(clean); await log(user.id, 'alterou grupos de computadores', 'computadores', null, { groups: clean }); return respond(res, 200, { groups: clean });
  }
  if (req.method === 'PUT' && pathname === '/api/demand-statuses') {
    if (!canAccess(user, 'demandas', 'update')) return error(res, 403, 'Você não tem permissão para alterar os status.'); const { statuses } = await requestBody(req); const clean = Array.isArray(statuses) ? [...new Set(statuses.map(status => repairTextEncoding(String(status).trim())).filter(status => status.length >= 2 && status.length <= 50))] : [];
    if (!clean.length || clean.length > 12) return error(res, 422, 'Informe de 1 a 12 status, com 2 a 50 caracteres cada.'); const inUse = (await store.records('demandas')).map(record => record.status).filter(status => status && !clean.includes(status)); if (inUse.length) return error(res, 422, `Não é possível remover status em uso: ${[...new Set(inUse)].join(', ')}.`); await store.setDemandStatuses(clean); await log(user.id, 'alterou status de demandas', 'demandas', null, { statuses: clean }); return respond(res, 200, { statuses: clean });
  }
  if (req.method === 'GET' && pathname === '/api/dashboard') {
    const counts = {}; for (const resource of Object.keys(resourceDefinitions)) if (canAccess(user, resource)) { const records = await store.records(resource); counts[resource] = resource === 'demandas' ? records.filter(record => demandBelongsToUser(record, user)).length : records.length; }
    const demands = canAccess(user, 'demandas') ? (await store.records('demandas')).filter(record => demandBelongsToUser(record, user) && record.status !== 'Concluída') : []; const maintenance = (await Promise.all(['computadores', 'equipamentos', 'ramais', 'redes'].filter(resource => canAccess(user, resource)).map(resource => store.records(resource)))).flat().filter(item => /manutenção/i.test(item.status || item.condicao || item.funcionamento || '')).length; const inbox = (await store.messagesFor(user.id)).filter(message => message.recipientId === user.id && !message.readAt).length;
    const notifications = (await Promise.all(['computadores', 'equipamentos', 'ramais'].filter(resource => canAccess(user, resource)).map(async resource => (await store.records(resource)).map(record => ({ resource, record }))))).flat().map(({ resource, record }) => {
      if (resource === 'ramais') { const avaliacao = record.funcionamento || 'Bom funcionamento'; if (avaliacao === 'Bom funcionamento') return null; return { id: record.id, resource, avaliacao, titulo: `Ramal ${record.ramal}`, detalhe: `${record.setor} · ${record.responsavel}` }; }
      const automatic = !record.avaliacao && /manutenção/i.test(record.status || record.condicao || '') ? 'Precisa de manutenção' : null;
      const avaliacao = record.avaliacao || automatic || 'Bom';
      if (avaliacao === 'Bom') return null;
      return { id: record.id, resource, avaliacao, titulo: resource === 'computadores' ? `Computador ${record.patrimonio}` : record.equipamento, detalhe: resource === 'computadores' ? `${record.responsavel} · ${record.localizacao}` : `${record.categoriaEquipamento || 'Equipamento'} · ${record.responsavel}` };
    }).filter(Boolean).sort((a, b) => ({ 'Troca necessária': 0, 'Precisa de manutenção': 1, Ruim: 2 }[a.avaliacao] ?? 3) - ({ 'Troca necessária': 0, 'Precisa de manutenção': 1, Ruim: 2 }[b.avaliacao] ?? 3));
    if (canAccess(user, 'programas')) { const limit = new Date(); limit.setDate(limit.getDate() + 30); const today = new Date().toISOString().slice(0, 10), until = limit.toISOString().slice(0, 10); for (const program of await store.records('programas')) if (program.status !== 'Cancelado' && program.dataRenovacao >= today && program.dataRenovacao <= until) notifications.push({ id: program.id, resource: 'programas', avaliacao: 'Renovação próxima', titulo: program.programa, detalhe: `${program.fornecedor} · renovar até ${program.dataRenovacao.split('-').reverse().join('/')}` }); }
    return respond(res, 200, { activeCount: Object.values(counts).reduce((a, b) => a + b, 0), openDemands: demands.length, maintenance, inbox, notifications, announcements: await store.announcements(), demands: demands.slice(0, 4), syncedAt: now() });
  }
  if (req.method === 'POST' && pathname === '/api/announcements') { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem publicar comunicados.'); const { title, body } = await requestBody(req); const cleanTitle = repairTextEncoding(String(title || '').trim()), cleanBody = repairTextEncoding(String(body || '').trim()); if (!cleanTitle || cleanTitle.length > 120 || !cleanBody || cleanBody.length > 2000) return error(res, 422, 'Informe título e comunicado com até 2.000 caracteres.'); const announcement = { id: id(), title: cleanTitle, body: cleanBody, authorId: user.id, authorName: user.nome, createdAt: now() }; await store.createAnnouncement(announcement); await log(user.id, 'publicou comunicado', 'announcements', announcement.id, { title: cleanTitle }); return respond(res, 201, { announcement }); }
  const announcementMatch = pathname.match(/^\/api\/announcements\/([\w-]+)$/); if (req.method === 'DELETE' && announcementMatch) { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem remover comunicados.'); const removed = await store.deleteAnnouncement(announcementMatch[1]); if (!removed) return error(res, 404, 'Comunicado não encontrado.'); await log(user.id, 'removeu comunicado', 'announcements', removed.id, { title: removed.title }); return respond(res, 200, { ok: true }); }
  if (req.method === 'GET' && pathname === '/api/messages') { const people = new Map((await store.users()).map(person => [person.id, person])); const messages = (await store.messagesFor(user.id)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map(message => ({ ...message, sender: publicUser(people.get(message.senderId)), recipient: publicUser(people.get(message.recipientId)) })); return respond(res, 200, { messages }); }
  if (req.method === 'POST' && pathname === '/api/messages') { const { recipientId, subject, body } = await requestBody(req); if (!await store.findUser(recipientId) || !String(subject || '').trim() || String(subject).length > 160 || !String(body || '').trim() || String(body).length > 5000) return error(res, 422, 'Informe destinatário, assunto e mensagem.'); const message = { id: id(), senderId: user.id, recipientId, subject: String(subject).trim(), body: String(body).trim(), createdAt: now(), readAt: null }; await store.createMessage(message); await log(user.id, 'enviou mensagem', 'messages', message.id, { recipientId, subject: message.subject }); return respond(res, 201, { message }); }
  const readMatch = pathname.match(/^\/api\/messages\/([\w-]+)\/read$/); if (req.method === 'PUT' && readMatch) { const updated = await store.markMessageRead(readMatch[1], user.id); if (!updated) return error(res, 404, 'Mensagem não encontrada.'); return respond(res, 200, { ok: true }); }
  const deleteMessageMatch = pathname.match(/^\/api\/messages\/([\w-]+)$/); if (req.method === 'DELETE' && deleteMessageMatch) { const deleted = await store.deleteMessageFor(deleteMessageMatch[1], user.id); if (!deleted) return error(res, 404, 'Mensagem não encontrada.'); await log(user.id, 'moveu mensagem para apagadas', 'messages', deleteMessageMatch[1]); return respond(res, 200, { ok: true }); }
  if (req.method === 'GET' && pathname === '/api/audit') { if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem consultar a auditoria.'); return respond(res, 200, { logs: await store.audits(url.searchParams.get('resource'), url.searchParams.get('recordId')) }); }
  if (req.method === 'GET' && pathname === '/api/reports') {
    if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem acessar relatórios e dados de auditoria.');
    const start = url.searchParams.get('start'); const end = url.searchParams.get('end'); const inPeriod = record => (!start || String(record.createdAt || '') >= `${start}T00:00:00`) && (!end || String(record.createdAt || '') <= `${end}T23:59:59.999`);
    const visible = Object.keys(resourceDefinitions).filter(resource => canAccess(user, resource)); const data = Object.fromEntries(await Promise.all(visible.map(async resource => { let records = (await store.records(resource)).filter(inPeriod); if (resource === 'demandas') records = records.filter(record => demandBelongsToUser(record, user)); return [resource, records]; })));
    const modules = visible.map(resource => ({ resource, total: data[resource].length }));
    const alerts = ['computadores', 'equipamentos'].filter(resource => data[resource]).flatMap(resource => data[resource].filter(record => record.avaliacao && record.avaliacao !== 'Bom').map(record => ({ resource, item: resource === 'computadores' ? record.patrimonio : record.equipamento, responsavel: record.responsavel, avaliacao: record.avaliacao }))).concat((data.ramais || []).filter(record => record.funcionamento && record.funcionamento !== 'Bom funcionamento').map(record => ({ resource: 'ramais', item: `Ramal ${record.ramal}`, responsavel: record.responsavel, avaliacao: record.funcionamento })));
    const demands = data.demandas || []; const demandStatus = ['Aberta', 'Em andamento', 'Concluída'].map(status => ({ status, total: demands.filter(record => record.status === status).length })); const lowStock = [];
    const activePrograms = canAccess(user, 'programas') ? (await store.records('programas')).filter(record => record.status !== 'Cancelado' && Number.isSafeInteger(Number(record.valor)) && Number(record.valor) > 0) : [];
    const programCosts = activePrograms.reduce((costs, record) => { const value = Number(record.valor); if (record.periodicidade === 'Mensal') costs.monthly += value; else costs.annual += value; return costs; }, { monthly: 0, annual: 0 });
    programCosts.monthlyEquivalent = Math.round(programCosts.monthly + programCosts.annual / 12);
    programCosts.annualEquivalent = programCosts.monthly * 12 + programCosts.annual;
    const exclusionFilters = Object.fromEntries(['user', 'sector', 'type', 'reason', 'status'].map(field => [field, url.searchParams.get(`exclusion${field[0].toUpperCase()}${field.slice(1)}`) || '']));
    const exclusions = buildExclusionReport(demands, exclusionFilters);
    const audit = user.perfil === 'admin' ? (await store.audits()).filter(inPeriod).slice(0, 100) : [];
    return respond(res, 200, { generatedAt: now(), period: { start, end }, modules, total: modules.reduce((sum, item) => sum + item.total, 0), alerts, demandStatus, lowStock, programCosts, activePrograms: activePrograms.length, exclusions, audit });
  }
  if (req.method === 'GET' && pathname === '/api/reports/export') {
    if (user.perfil !== 'admin') return error(res, 403, 'Apenas administradores podem exportar relatórios.');
    const start = url.searchParams.get('start'); const end = url.searchParams.get('end'); const inPeriod = record => (!start || String(record.createdAt || '') >= `${start}T00:00:00`) && (!end || String(record.createdAt || '') <= `${end}T23:59:59.999`); const rows = [['Relatório Central TI'], ['Período', start || 'Início', end || 'Hoje'], [], ['Módulo', 'Total']];
    for (const resource of Object.keys(resourceDefinitions).filter(resource => canAccess(user, resource))) { let records = (await store.records(resource)).filter(inPeriod); if (resource === 'demandas') records = records.filter(record => demandBelongsToUser(record, user)); rows.push([resource, records.length]); }
    if (canAccess(user, 'programas')) { const programs = (await store.records('programas')).filter(record => record.status !== 'Cancelado' && Number.isSafeInteger(Number(record.valor)) && Number(record.valor) > 0); const costs = programs.reduce((total, record) => { if (record.periodicidade === 'Mensal') total.monthly += Number(record.valor); else total.annual += Number(record.valor); return total; }, { monthly: 0, annual: 0 }); rows.push([], ['Custos recorrentes de programas', 'Valor'], ['Custo mensal equivalente', formatProgramValue(Math.round(costs.monthly + costs.annual / 12))], ['Custo anual estimado', formatProgramValue(costs.monthly * 12 + costs.annual)]); }
    const exclusionFilters = Object.fromEntries(['user', 'sector', 'type', 'reason', 'status'].map(field => [field, url.searchParams.get(`exclusion${field[0].toUpperCase()}${field.slice(1)}`) || '']));
    const demands = (await store.records('demandas')).filter(record => demandBelongsToUser(record, user) && inPeriod(record));
    const exclusions = buildExclusionReport(demands, exclusionFilters);
    rows.push([], ['Solicitações de exclusão'], ['Ticket', 'Atendimento', 'Paciente', 'Usuário solicitante', 'Setor', 'Tipo', 'Categoria do motivo', 'Motivo', 'Solicitada em', 'Status', 'Concluída por', 'Concluída em']);
    for (const record of exclusions.records) rows.push([record.ticket || '', record.numeroAtendimento || '', record.nomePaciente || '', exclusionValue(record, 'user'), exclusionValue(record, 'sector'), exclusionValue(record, 'type'), exclusionValue(record, 'reason'), record.motivoExclusao || '', record.createdAt || '', record.status || '', record.exclusaoConcluidaPor || '', record.exclusaoConcluidaEm || '']);
    rows.push([], ['Alertas técnicos', 'Avaliação']); for (const resource of ['computadores', 'equipamentos'].filter(resource => canAccess(user, resource))) for (const record of (await store.records(resource)).filter(inPeriod).filter(record => record.avaliacao && record.avaliacao !== 'Bom')) rows.push([resource === 'computadores' ? record.patrimonio : record.equipamento, record.avaliacao]);
    const content = `\uFEFF${rows.map(row => row.map(value => `"${String(value ?? '').replaceAll('"', '""')}"`).join(';')).join('\n')}`; res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': 'attachment; filename="relatorio-central-ti.csv"', 'cache-control': 'no-store' }); return res.end(content);
  }
  const exportMatch = pathname.match(/^\/api\/resources\/([a-z]+)\/export$/); if (req.method === 'GET' && exportMatch) { const resource = exportMatch[1]; if (!resourceDefinitions[resource]) return error(res, 404, 'Recurso não encontrado.'); if (!canAccess(user, resource)) return error(res, 403, 'Você não tem permissão para esta área.'); const keys = resource === 'computadores' ? [...resourceDefinitions[resource], ...optionalResourceFields.computadores, 'dataSolicitacao', 'dataRetirada', 'dataDevolucao', 'checklist', 'observacoes'] : resource === 'materiais' ? [...resourceDefinitions[resource], 'observacoes'] : resourceDefinitions[resource]; let records = await store.records(resource); if (resource === 'demandas') records = records.filter(record => demandBelongsToUser(record, user)); const content = csv(records, keys); res.writeHead(200, { 'content-type': 'text/csv; charset=utf-8', 'content-disposition': `attachment; filename="central-ti-${resource}.csv"`, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' }); return res.end(content); }
  const demandCommentMatch = pathname.match(/^\/api\/resources\/demandas\/([\w-]+)\/comments$/);
  if (req.method === 'POST' && demandCommentMatch) {
    if (!canAccess(user, 'demandas')) return error(res, 403, 'Você não tem permissão para acessar chamados.');
    const demand = await store.record('demandas', demandCommentMatch[1]);
    if (!demand || !demandBelongsToUser(demand, user)) return error(res, 404, 'Chamado não encontrado.');
    const { text = '' } = await requestBody(req);
    const cleanText = repairTextEncoding(String(text).trim());
    if (!cleanText || cleanText.length > 3000) return error(res, 422, 'Escreva uma resposta com até 3.000 caracteres.');
    const interaction = { id: id(), texto: cleanText, autorId: user.id, criadoEm: now() };
    await store.updateRecord('demandas', demand.id, { interacoes: [...(demand.interacoes || []), interaction] }, user.id);
    await notifyTicketComment(demand, user, cleanText);
    await log(user.id, 'respondeu ao chamado', 'demandas', demand.id, { interactionId: interaction.id });
    return respond(res, 201, { interaction: { ...interaction, autorNome: user.nome } });
  }
  const assignDemandMatch = pathname.match(/^\/api\/resources\/demandas\/([\w-]+)\/assign-self$/);
  if (req.method === 'PUT' && assignDemandMatch) {
    if (!canAccess(user, 'demandas', 'update') || !['admin', 'ti'].includes(user.perfil)) return error(res, 403, 'Somente a equipe de T.I. pode assumir chamados.');
    const demand = await store.record('demandas', assignDemandMatch[1]);
    if (!demand || !demandBelongsToUser(demand, user)) return error(res, 404, 'Chamado não encontrado.');
    const statuses = await store.demandStatuses();
    const status = isCompletedDemandStatus(demand.status) ? demand.status : inProgressDemandStatus(statuses, demand.status);
    const updated = await store.updateRecord('demandas', demand.id, { tecnicoResponsavel: user.nome, status }, user.id);
    const lifecycleNotifications = await notifyTicketLifecycle(demand, updated, user.id);
    if (Object.keys(lifecycleNotifications).length) {
      updated.lifecycleNotifications = { ...(demand.lifecycleNotifications || {}), ...lifecycleNotifications };
      await store.updateRecord('demandas', demand.id, { lifecycleNotifications: updated.lifecycleNotifications }, user.id);
    }
    await log(user.id, 'assumiu o chamado', 'demandas', demand.id, { status });
    return respond(res, 200, { record: updated });
  }
  const match = pathname.match(/^\/api\/resources\/([a-z]+)(?:\/([\w-]+))?$/); if (match) {
    const [, resource, recordId] = match; if (!resourceDefinitions[resource]) return error(res, 404, 'Recurso não encontrado.'); const mode = req.method === 'GET' ? (recordId ? 'consult' : 'list') : req.method === 'POST' ? 'create' : req.method === 'PUT' ? 'update' : 'delete'; if (!canAccess(user, resource, mode)) return error(res, 403, 'Você não tem permissão para esta área.');
    if (req.method === 'GET') { let records = await store.records(resource); if (recordId) records = records.filter(record => record.id === recordId); if (resource === 'demandas') records = records.filter(record => demandBelongsToUser(record, user)); if (resource === 'demandas') { const people = new Map((await store.users()).map(person => [person.id, person.nome])); for (const record of records) record.interacoes = (record.interacoes || []).map(item => ({ ...item, autorNome: people.get(item.autorId) || 'Usuário removido' })); } if (recordId && !records.length) return error(res, 404, 'Registro não encontrado.'); return respond(res, 200, { records }); }
    if (req.method === 'POST' && !recordId) {
      const body = await requestBody(req); if (resource === 'patrimonio') body.codigo = await nextPatrimonyCode(); if (resource === 'demandas' && hospitalOnly(user) && body.tipo !== 'externa') return error(res, 403, 'Este usuário pode abrir somente demandas hospitalares.'); if (resource === 'demandas' && hospitalOnly(user)) { body.solicitante = user.nome; body.status = 'Aberta'; body.tecnicoResponsavel = ''; body.prazoSla = ''; } const payload = resource === 'demandas' ? (hospitalOnly(user) ? sanitizeHospitalDemand(body, user) : sanitizeDemand(body)) : sanitize(body, resourceDefinitions[resource]);
      if (!payload) return error(res, 422, resource === 'demandas' ? 'Revise os campos obrigatórios do ticket.' : 'Preencha todos os campos corretamente.');
      if (resource === 'programas') { payload.valor = normalizeProgramValue(body.valor); if (payload.valor === null) return error(res, 422, 'Informe um valor válido para o programa.'); }
      if (resource === 'demandas') payload.prazoSla = automaticSla(payload.prioridade);
      if (resource === 'demandas' && hospitalOnly(user)) payload.empresa = 'Hospital Dia Revitalite';
      if (resource === 'computadores') { payload.checklist = sanitizeChecklist(body.checklist); payload.dataSolicitacao = sanitizeOptionalDate(body.dataSolicitacao); if (payload.dataSolicitacao === null) return error(res, 422, 'Informe datas válidas.'); }
      if (resource === 'equipamentos') { payload.dataRetirada = sanitizeOptionalDate(body.dataRetirada); payload.dataDevolucao = sanitizeOptionalDate(body.dataDevolucao); if ([payload.dataRetirada, payload.dataDevolucao].includes(null)) return error(res, 422, 'Informe datas válidas.'); }
      const characterError = validateRecordCharacters(resource, payload); if (characterError) return error(res, 422, characterError);
      const codeError = await ensurePatrimonyCodeAvailable(resource, payload); if (codeError) return error(res, 422, codeError); const serialError = await ensureSerialNumberAvailable(resource, payload); if (serialError) return error(res, 422, serialError);
      const note = payload.novaObservacao; delete payload.novaObservacao;
      const record = { id: id(), ...payload, createdAt: now(), updatedAt: now(), createdBy: user.id, updatedBy: user.id };
      if (resource === 'demandas') markExclusionMetadata(record, user);
      if (resource === 'demandas') { record.ticket = `TI-${String((await store.records('demandas')).length + 1).padStart(4, '0')}`; record.interacoes = note ? [{ id: id(), texto: note, autorId: user.id, criadoEm: now() }] : []; if (hospitalOnly(user)) record.solicitanteId = user.id; }
      await store.createRecord(resource, record); await syncAssetPatrimony(resource, record, user.id); await alertAssetCondition(resource, record, user.id); await log(user.id, 'criou registro', resource, record.id, { values: payload }); return respond(res, 201, { record });
    }
    if (req.method === 'PUT' && recordId) {
      const body = await requestBody(req); const previous = await store.record(resource, recordId); if (!previous) return error(res, 404, 'Registro não encontrado.'); if (resource === 'demandas' && !demandBelongsToUser(previous, user)) return error(res, 404, 'Demanda não encontrada.'); if (resource === 'demandas' && !previous.tecnicoResponsavel && String(body.status || '') !== String(previous.status || '') && !String(body.tecnicoResponsavel || '').trim()) return error(res, 422, 'Abra os detalhes e assuma o chamado antes de alterar o status.'); if (resource === 'demandas' && !previous.tecnicoResponsavel && body.tecnicoResponsavel && String(body.status || '') === String(previous.status || '')) body.status = inProgressDemandStatus(await store.demandStatuses(), previous.status); const payload = resource === 'demandas' ? sanitizeDemand(body) : sanitize(body, resourceDefinitions[resource]);
      if (!payload) return error(res, 422, resource === 'demandas' ? 'Revise os campos obrigatórios do ticket.' : 'Preencha todos os campos corretamente.');
      if (resource === 'programas') { payload.valor = normalizeProgramValue(body.valor); if (payload.valor === null) return error(res, 422, 'Informe um valor válido para o programa.'); }
      if (resource === 'demandas') payload.prazoSla = automaticSla(payload.prioridade);
      if (resource === 'computadores') { payload.checklist = sanitizeChecklist(body.checklist); payload.dataSolicitacao = sanitizeOptionalDate(body.dataSolicitacao); if (payload.dataSolicitacao === null) return error(res, 422, 'Informe datas válidas.'); }
      if (resource === 'equipamentos') { payload.dataRetirada = sanitizeOptionalDate(body.dataRetirada); payload.dataDevolucao = sanitizeOptionalDate(body.dataDevolucao); if ([payload.dataRetirada, payload.dataDevolucao].includes(null)) return error(res, 422, 'Informe datas válidas.'); }
      const characterError = validateRecordCharacters(resource, payload); if (characterError) return error(res, 422, characterError);
      const codeError = await ensurePatrimonyCodeAvailable(resource, payload, recordId); if (codeError) return error(res, 422, codeError); const serialError = await ensureSerialNumberAvailable(resource, payload, recordId); if (serialError) return error(res, 422, serialError);
      const note = payload.novaObservacao; delete payload.novaObservacao;
      if (resource === 'demandas' && isExclusionDemand(payload)) {
        const merged = { ...previous, ...payload };
        markExclusionMetadata(merged, user);
        Object.assign(payload, ...['usuarioSolicitante', 'setorSolicitante', 'solicitanteId', 'exclusaoConcluidaPor', 'exclusaoConcluidaEm'].filter(key => merged[key] !== undefined).map(key => ({ [key]: merged[key] })));
      }
      const record = await store.updateRecord(resource, recordId, payload, user.id); if (!record) return error(res, 404, 'Registro não encontrado.');
      if (resource === 'demandas' && note) { record.interacoes = [...(previous.interacoes || []), { id: id(), texto: note, autorId: user.id, criadoEm: now() }]; await store.updateRecord(resource, recordId, { interacoes: record.interacoes }, user.id); }
      await syncAssetPatrimony(resource, record, user.id); await alertAssetCondition(resource, record, user.id); if (resource === 'demandas') { const lifecycleNotifications = await notifyTicketLifecycle(previous, record, user.id); if (Object.keys(lifecycleNotifications).length) { record.lifecycleNotifications = { ...(previous.lifecycleNotifications || {}), ...lifecycleNotifications }; await store.updateRecord(resource, recordId, { lifecycleNotifications: record.lifecycleNotifications }, user.id); } } await log(user.id, 'editou registro', resource, record.id, { before: previous, after: payload }); return respond(res, 200, { record });
    }
    if (req.method === 'DELETE' && recordId) { if (resource === 'demandas') { const demand = await store.record(resource, recordId); if (!demand || !demandBelongsToUser(demand, user)) return error(res, 404, 'Demanda não encontrada.'); } const removed = await store.deleteRecord(resource, recordId); if (!removed) return error(res, 404, 'Registro não encontrado.'); await retireAssetPatrimony(resource, removed, user.id); await log(user.id, 'excluiu registro', resource, recordId, { values: removed }); return respond(res, 200, { ok: true }); }
  }
  return error(res, 404, 'Rota não encontrada.');
}
const server = http.createServer(async (req, res) => { const url = new URL(req.url, `http://${req.headers.host}`); try { if (url.pathname.startsWith('/api/')) await api(req, res, url); else serveFile(req, res, url); } catch (exception) { console.error(exception); error(res, 500, 'Não foi possível concluir esta operação.'); } });
async function start() { if (pool) await initializePostgres(); server.listen(PORT, HOST, () => { console.log(`Central TI disponível em http://localhost:${PORT}`); for (const address of localAddresses()) console.log(`Acesso pela rede: ${address}`); console.log(`Banco de dados: ${DATABASE_URL ? 'PostgreSQL' : 'arquivo local (configure DATABASE_URL para PostgreSQL)'}`); }); }
start().catch(error => { const migrationHint = DATABASE_URL && !POSTGRES_MIGRATIONS_ENABLED ? ' O banco não foi alterado. Se ele ainda não tiver a estrutura esperada, execute a migração de forma planejada com CENTRAL_TI_RUN_MIGRATIONS=true.' : ''; console.error(`Não foi possível iniciar a Central TI: ${error.message || error}.${migrationHint}`); process.exit(1); });
