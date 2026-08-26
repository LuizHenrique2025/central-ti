const crypto = require('node:crypto');

const ENVELOPE_VERSION = 1;

function createEncryptedStore(base64Key) {
  if (!base64Key) {
    return {
      enabled: false,
      serialize: data => JSON.stringify(data, null, 2),
      deserialize(raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.encrypted) throw new Error('A base está criptografada. Configure CENTRAL_TI_DATA_ENCRYPTION_KEY antes de iniciá-la.');
        return parsed;
      }
    };
  }

  const key = Buffer.from(base64Key, 'base64');
  if (key.length !== 32 || key.toString('base64') !== base64Key) {
    throw new Error('CENTRAL_TI_DATA_ENCRYPTION_KEY deve ser uma chave Base64 de exatamente 32 bytes.');
  }

  function encrypt(plaintext) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return { version: ENVELOPE_VERSION, algorithm: 'aes-256-gcm', iv: iv.toString('base64'), tag: tag.toString('base64'), ciphertext: ciphertext.toString('base64') };
  }

  function decrypt(envelope) {
    if (!envelope || envelope.version !== ENVELOPE_VERSION || envelope.algorithm !== 'aes-256-gcm') throw new Error('Formato de base criptografada não suportado.');
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAuthTag(Buffer.from(envelope.tag, 'base64'));
      return Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('Não foi possível abrir a base criptografada. Verifique CENTRAL_TI_DATA_ENCRYPTION_KEY.');
    }
  }

  return {
    enabled: true,
    serialize(data) { return JSON.stringify({ encrypted: encrypt(JSON.stringify(data)) }, null, 2); },
    deserialize(raw) { const parsed = JSON.parse(raw); return parsed?.encrypted ? JSON.parse(decrypt(parsed.encrypted)) : parsed; }
  };
}

module.exports = { createEncryptedStore };
