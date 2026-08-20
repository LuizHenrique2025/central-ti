const crypto = require('node:crypto');

function createSessionService({ getStore, sessionTtlMs, error }) {
  const sessions = new Map();
  const loginAttempts = new Map();

  function clientIp(req) {
    return req.socket.remoteAddress || 'unknown';
  }

  function tooManyAttempts(req) {
    const attempt = loginAttempts.get(clientIp(req));
    return Boolean(attempt && attempt.count >= 8 && Date.now() - attempt.last < 15 * 60 * 1000);
  }

  function recordAttempt(req, success) {
    const ip = clientIp(req);
    if (success) return loginAttempts.delete(ip);
    const current = loginAttempts.get(ip) || { count: 0, last: 0 };
    loginAttempts.set(ip, { count: current.count + 1, last: Date.now() });
  }

  async function getAuth(req) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    const session = token && sessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (token) sessions.delete(token);
      return null;
    }
    return getStore().findUser(session.userId);
  }

  function createSingleSession(userId) {
    for (const [token, session] of sessions) if (session.userId === userId) sessions.delete(token);
    const token = crypto.randomBytes(32).toString('hex');
    sessions.set(token, { userId, expiresAt: Date.now() + sessionTtlMs });
    return token;
  }

  async function requireAuth(req, res) {
    const user = await getAuth(req);
    if (!user) {
      error(res, 401, 'Sua sessão expirou. Entre novamente.');
      return null;
    }
    return user;
  }

  function logout(req) {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (token) sessions.delete(token);
  }

  return { sessions, tooManyAttempts, recordAttempt, getAuth, createSingleSession, requireAuth, logout };
}

module.exports = { createSessionService };
