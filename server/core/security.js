const crypto = require('node:crypto');

const SCRYPT_V2_PREFIX = 'scrypt-v2$';
const SCRYPT_V2_OPTIONS = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function passwordHash(password, salt = `${SCRYPT_V2_PREFIX}${crypto.randomBytes(16).toString('hex')}`) {
  const isV2 = salt.startsWith(SCRYPT_V2_PREFIX);
  const actualSalt = isV2 ? salt.slice(SCRYPT_V2_PREFIX.length) : salt;
  return { salt, hash: crypto.scryptSync(String(password), actualSalt, 64, isV2 ? SCRYPT_V2_OPTIONS : undefined).toString('hex') };
}

function verifyPassword(password, user) {
  if (!user?.salt || !user?.hash || !/^[a-f0-9]{128}$/i.test(user.hash)) return false;
  const candidate = passwordHash(String(password), user.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.hash, 'hex'));
}

function validPassword(password) {
  return typeof password === 'string' && password.length >= 12 && password.length <= 256
    && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function normalizeCpf(value) {
  const cpf = String(value || '').replace(/\D/g, '');
  return /^\d{11}$/.test(cpf) ? cpf : null;
}

function cpfHash(cpf) {
  return crypto.createHash('sha256').update(cpf).digest('hex');
}

function firstName(value) {
  return String(value || '').trim().split(/\s+/)[0].toLocaleLowerCase('pt-BR');
}

module.exports = { passwordHash, verifyPassword, validPassword, normalizeCpf, cpfHash, firstName };
