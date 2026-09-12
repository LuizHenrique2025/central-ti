const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');

function loadEnvFile() {
  for (const envFile of [path.join(ROOT, '.env'), path.join(ROOT, 'server', '.env')]) {
    if (!fs.existsSync(envFile)) continue;
    for (const line of fs.readFileSync(envFile, 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (match && process.env[match[1]] === undefined) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnvFile();

const dataDirectory = process.env.CENTRAL_TI_DATA_DIR
  ? path.resolve(process.env.CENTRAL_TI_DATA_DIR)
  : path.join(ROOT, 'storage');
const NODE_ENV = process.env.NODE_ENV || 'development';
const PRODUCTION = NODE_ENV === 'production';
const HOST = process.env.HOST || '0.0.0.0';
const TRUST_PROXY = process.env.CENTRAL_TI_TRUST_PROXY === 'true';
const REQUIRE_HTTPS = PRODUCTION || process.env.CENTRAL_TI_REQUIRE_HTTPS === 'true';
const bootstrapFields = ['CENTRAL_TI_BOOTSTRAP_ADMIN_NAME', 'CENTRAL_TI_BOOTSTRAP_ADMIN_EMAIL', 'CENTRAL_TI_BOOTSTRAP_ADMIN_PASSWORD'];
const bootstrapProvided = bootstrapFields.some(field => Boolean(process.env[field]));

function loopbackHost(host) {
  const normalized = String(host || '').trim().toLowerCase();
  return normalized === 'localhost' || normalized === '::1' || normalized === '[::1]' || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

if (bootstrapProvided && bootstrapFields.some(field => !process.env[field])) {
  throw new Error('Configure CENTRAL_TI_BOOTSTRAP_ADMIN_NAME, CENTRAL_TI_BOOTSTRAP_ADMIN_EMAIL e CENTRAL_TI_BOOTSTRAP_ADMIN_PASSWORD juntos.');
}

if (PRODUCTION && !TRUST_PROXY) {
  throw new Error('Em produção, configure CENTRAL_TI_TRUST_PROXY=true e publique a Central TI somente atrás de um reverse proxy HTTPS confiável.');
}

if (PRODUCTION && !loopbackHost(HOST)) {
  throw new Error('HOST deve ser um endereço local (127.0.0.1, ::1 ou localhost). Publique a Central TI por um reverse proxy HTTPS; não exponha a porta do Node diretamente.');
}

if (!process.env.DATABASE_URL && !process.env.CENTRAL_TI_DATA_ENCRYPTION_KEY) {
  throw new Error('Configure CENTRAL_TI_DATA_ENCRYPTION_KEY ao usar o armazenamento local.');
}

module.exports = {
  ROOT,
  NODE_ENV,
  PRODUCTION,
  PORT: Number(process.env.PORT || 3000),
  HOST,
  REQUIRE_HTTPS,
  TRUST_PROXY,
  PUBLIC_DIR: path.join(ROOT, 'public'),
  DB_DIR: dataDirectory,
  DB_FILE: path.join(dataDirectory, 'central-ti.json'),
  BACKUP_DIR: process.env.BACKUP_DIR ? path.resolve(process.env.BACKUP_DIR) : path.join(ROOT, 'backups'),
  DATABASE_URL: process.env.DATABASE_URL,
  DATABASE_SSL: process.env.DATABASE_SSL === 'true',
  DATA_ENCRYPTION_KEY: process.env.CENTRAL_TI_DATA_ENCRYPTION_KEY,
  POSTGRES_MIGRATIONS_ENABLED: process.env.CENTRAL_TI_RUN_MIGRATIONS === 'true',
  TWO_FACTOR_REQUIRED: process.env.EMAIL_2FA_REQUIRED === 'true',
  SMTP_ENABLED: Boolean(process.env.SMTP_USER && process.env.SMTP_PASS),
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: Number(process.env.SMTP_PORT || 465),
  SMTP_SECURE: process.env.SMTP_SECURE !== 'false',
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  MAIL_FROM: process.env.MAIL_FROM,
  BOOTSTRAP_ADMIN: bootstrapProvided ? {
    name: process.env.CENTRAL_TI_BOOTSTRAP_ADMIN_NAME.trim(),
    email: process.env.CENTRAL_TI_BOOTSTRAP_ADMIN_EMAIL.trim().toLowerCase(),
    password: process.env.CENTRAL_TI_BOOTSTRAP_ADMIN_PASSWORD
  } : null,
  ATTACHMENT_MAX_COUNT: Number(process.env.CENTRAL_TI_ATTACHMENT_MAX_COUNT || 100),
  ATTACHMENT_MAX_STORAGE_BYTES: Number(process.env.CENTRAL_TI_ATTACHMENT_MAX_STORAGE_BYTES || 250_000_000)
};
