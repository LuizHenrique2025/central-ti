const crypto = require('node:crypto');

function passwordHash(password, salt = crypto.randomBytes(16).toString('hex')) {
  return { salt, hash: crypto.scryptSync(password, salt, 64).toString('hex') };
}

function verifyPassword(password, user) {
  const candidate = passwordHash(String(password), user.salt).hash;
  return crypto.timingSafeEqual(Buffer.from(candidate, 'hex'), Buffer.from(user.hash, 'hex'));
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

module.exports = { passwordHash, verifyPassword, normalizeCpf, cpfHash, firstName };
