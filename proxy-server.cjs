// DeepSeek CORS Proxy — 绕过浏览器 CORS 限制
// 启动: node proxy-server.cjs
// 使用: http://localhost:13002/api/deepseek
const http = require('http');

const PORT = 13002;
const TARGET = 'https://api.deepseek.com/v1/chat/completions';

const server = http.createServer(async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }
  if (req.url !== '/api/deepseek' || req.method !== 'POST') {
    res.writeHead(405); res.end('POST /api/deepseek only');
    return;
  }

  let body = '';
  req.on('data', c => body += c);
  req.on('end', async () => {
    try {
      const resp = await fetch(TARGET, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': req.headers.authorization || '',
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      const data = await resp.json();
      res.writeHead(resp.status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(data));
    } catch (e) {
      res.writeHead(502);
      res.end(JSON.stringify({ error: e.message }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`DeepSeek CORS Proxy running on http://localhost:${PORT}/api/deepseek`);
});
