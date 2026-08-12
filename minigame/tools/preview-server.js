/**
 * 本地预览服务器（无需 Cocos / 无需微信开发者工具）
 * 用法: node tools/preview-server.js
 * 浏览器打开 http://127.0.0.1:7456/
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const port = Number(process.env.PORT) || 7456;

// 先打浏览器包
try {
  execSync('node tools/build-browser-bundle.js', { cwd: root, stdio: 'inherit' });
} catch (e) {
  console.error('bundle failed', e);
  process.exit(1);
}

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.css': 'text/css; charset=utf-8',
};

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';
  // 安全：限制在 root 内
  const filePath = path.normalize(path.join(root, urlPath));
  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found: ' + urlPath);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log('');
  console.log('  合成大暹罗 · 原生预览');
  console.log('  http://127.0.0.1:' + port + '/');
  console.log('  微信开发者工具：导入目录 ' + root);
  console.log('');
});
