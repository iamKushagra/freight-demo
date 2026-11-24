import http from 'node:http';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

function apiProxy(port) {
  const retryable = new Set(['ECONNREFUSED', 'ECONNRESET']);
  return {
    name: 'api-proxy-retry',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = req.url || '';
        if (!path.startsWith('/api')) return next();

        const forward = (body, attempt) => {
          const headers = { ...req.headers, host: `127.0.0.1:${port}` };
          delete headers['transfer-encoding'];
          headers['content-length'] = String(body.length);
          const proxyReq = http.request(
            {
              hostname: '127.0.0.1',
              port,
              path,
              method: req.method,
              headers,
            },
            (proxyRes) => {
              res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
              proxyRes.pipe(res);
            },
          );
          proxyReq.on('error', (err) => {
            if (retryable.has(err.code) && attempt < 25) {
              setTimeout(() => forward(body, attempt + 1), 200);
              return;
            }
            if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
            res.end('API unavailable');
          });
          proxyReq.end(body);
        };

        if (req.method === 'GET' || req.method === 'HEAD') {
          forward(Buffer.alloc(0), 0);
          return;
        }

        const chunks = [];
        req.on('data', (chunk) => chunks.push(chunk));
        req.on('end', () => forward(Buffer.concat(chunks), 0));
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '..', '');
  const apiPort = Number(env.PORT) || 3001;
  return {
    plugins: [react(), apiProxy(apiPort)],
    envDir: '..',
    server: {
      port: 5173,
      strictPort: true,
      fs: { allow: ['..'] },
    },
  };
});
