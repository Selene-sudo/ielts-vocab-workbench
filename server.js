const http = require('http');
const fs = require('fs');
const path = require('path');
const root = __dirname;
const port = process.env.PORT || 8765;
const host = process.env.HOST || '127.0.0.1';
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' };
http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const fp = path.join(root, url);
  if (!fp.startsWith(root)) { res.statusCode = 403; return res.end(); }
  fs.readFile(fp, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not Found'); }
    res.setHeader('Content-Type', mime[path.extname(fp)] || 'application/octet-stream');
    res.end(data);
  });
}).listen(port, host, () => console.log('Listening on http://' + host + ':' + port));
