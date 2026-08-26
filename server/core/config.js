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

module.exports = {
  ROOT,
  PORT: Number(process.env.PORT || 3000),
  HOST: process.env.HOST || '0.0.0.0',
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
  MAIL_FROM: process.env.MAIL_FROM
};
