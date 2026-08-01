/**
 * 极简静态文件服务器 — 用于托管 vite build 产物
 * 没有 HMR、没有 WebSocket、没有花哨 — 就是 serve 文件
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, 'dist');
const PORT = parseInt(process.argv[2] || '5181');

// MIME 类型映射
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.json': 'application/json; charset=utf-8',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const server = http.createServer((req, res) => {
  let urlPath = req.url || '/';
  
  // 去掉查询参数
  if (urlPath.includes('?')) urlPath = urlPath.split('?')[0];
  
  // 默认到 index.html
  let filePath = path.join(ROOT, urlPath === '/' ? 'index.html' : urlPath);
  
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME[ext] || 'application/octet-stream';

  // 如果文件不存在且不是 .html，尝试加 .html（SPA 路由）
  if (!fs.existsSync(filePath) && ext !== '.html') {
    const htmlPath = filePath + '.html';
    if (fs.existsSync(htmlPath)) {
      filePath = htmlPath;
    }
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      // SPA fallback — 所有未匹配路由都返回 index.html
      if (err.code === 'ENOENT') {
        const indexPath = path.join(ROOT, 'index.html');
        fs.readFile(indexPath, (err2, data2) => {
          if (err2) {
            res.writeHead(500);
            res.end('Internal Server Error');
            return;
          }
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(data2);
        });
        return;
      }
      res.writeHead(500);
      res.end('Internal Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`🦐 静态服务器运行在 http://localhost:${PORT}`);
  console.log(`   根目录: ${ROOT}`);
});

// 捕获未处理的异常防止崩溃
process.on('uncaughtException', (err) => {
  console.error('未捕获异常:', err.message);
});
process.on('unhandledRejection', (reason) => {
  console.error('未处理的 Promise 拒绝:', reason);
});
