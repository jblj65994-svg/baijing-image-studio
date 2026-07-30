import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const apiKeyPath = path.join(root, 'removebg.key');
const removeBgKey = process.env.REMOVEBG_API_KEY || (fs.existsSync(apiKeyPath) ? fs.readFileSync(apiKeyPath, 'utf8').trim() : '');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};
const port = Number(process.env.PORT || 4173);

http.createServer((request, response) => {
  if (request.method === 'OPTIONS' && request.url === '/api/remove-bg') {
    response.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    response.end();
    return;
  }
  if (request.method === 'POST' && request.url === '/api/remove-bg') {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(chunk));
    request.on('end', async () => {
      if (!removeBgKey) {
        response.writeHead(500, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'});
        response.end(JSON.stringify({error: '缺少 remove.bg API Key'}));
        return;
      }
      try {
        const input = Buffer.concat(chunks);
        const form = new FormData();
        form.append('image_file', new Blob([input], {type: request.headers['content-type'] || 'image/jpeg'}), 'product-image');
        form.append('size', 'auto');
        const upstream = await fetch('https://api.remove.bg/v1.0/removebg', {
          method: 'POST',
          headers: {'X-Api-Key': removeBgKey},
          body: form
        });
        const output = Buffer.from(await upstream.arrayBuffer());
        response.writeHead(upstream.status, {
          'Content-Type': upstream.ok ? 'image/png' : 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'Access-Control-Allow-Origin': '*'
        });
        response.end(output);
      } catch (error) {
        response.writeHead(502, {'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*'});
        response.end(JSON.stringify({error: '无法连接 remove.bg：' + error.message}));
      }
    });
    return;
  }
  const requestPath = decodeURIComponent(request.url.split('?')[0]);
  const relativePath = (requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, ''));
  if (relativePath === 'removebg.key') {
    response.writeHead(404);
    response.end('Not found');
    return;
  }
  const target = path.resolve(root, relativePath);
  if (!target.startsWith(root)) {
    response.writeHead(403);
    response.end('Forbidden');
    return;
  }
  fs.readFile(target, (error, file) => {
    if (error) {
      response.writeHead(404);
      response.end('Not found');
      return;
    }
    response.writeHead(200, {
      'Content-Type': types[path.extname(target).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store',
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
    });
    response.end(file);
  });
}).listen(port, '127.0.0.1', () => {
  console.log('白境工作台已启动：http://127.0.0.1:4173');
});
