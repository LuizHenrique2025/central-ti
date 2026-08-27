const SECURITY_HEADERS = {
  'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'x-frame-options': 'DENY', 'referrer-policy': 'no-referrer',
  'permissions-policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()', 'cross-origin-opener-policy': 'same-origin', 'cross-origin-resource-policy': 'same-origin'
};

function respond(res, status, data, headers = {}) {
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    ...SECURITY_HEADERS,
    ...headers
  });
  res.end(JSON.stringify(data));
}

function error(res, status, message) {
  respond(res, status, { error: message });
}

function requestError(message, statusCode) {
  const exception = new Error(message);
  exception.statusCode = statusCode;
  return exception;
}

function requestBody(req, maxBytes = 1_000_000) {
  return new Promise((resolve, reject) => {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (contentType && !contentType.startsWith('application/json')) return reject(requestError('Content-Type deve ser application/json.', 415));
    const chunks = [];
    let length = 0;
    req.on('data', chunk => {
      length += chunk.length;
      if (length > maxBytes) {
        reject(requestError('Payload muito grande.', 413));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try { const body = Buffer.concat(chunks).toString('utf8'); resolve(body ? JSON.parse(body) : {}); }
      catch { reject(requestError('JSON inválido.', 400)); }
    });
    req.on('error', reject);
  });
}

module.exports = { SECURITY_HEADERS, respond, error, requestBody };
