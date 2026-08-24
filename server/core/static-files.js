const fs = require('node:fs');
const path = require('node:path');

const PUBLIC_FILES = new Set([
  '/index.html',
  '/assets/js/core/config.js',
  '/assets/js/app.js',
  '/assets/js/core/bootstrap.js',
  '/assets/css/styles.css'
]);

function createStaticFileHandler(publicDirectory) {
  return function serveFile(req, res, url) {
    const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
    if (!PUBLIC_FILES.has(requestPath)) {
      res.writeHead(404);
      return res.end('Página não encontrada');
    }

    const filePath = path.join(publicDirectory, requestPath.slice(1));
    const types = {
      '.html': 'text/html; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.css': 'text/css; charset=utf-8'
    };
    res.writeHead(200, {
      'content-type': types[path.extname(filePath)] || 'application/octet-stream',
      'cache-control': 'no-cache',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY'
    });
    fs.createReadStream(filePath).pipe(res);
  };
}

module.exports = { createStaticFileHandler };
