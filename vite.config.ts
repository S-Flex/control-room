import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';
import fs from 'fs';

function dataServerPlugin() {
  const root = __dirname;
  return {
    name: 'data-server',
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        const url = (req.url || '').split('?')[0];

        // Serve static data and model files
        if (url.startsWith('/data/') || url.startsWith('/models/')) {
          const filePath = path.join(root, url);
          if (req.method === 'PUT') {
            let body = '';
            req.on('data', (chunk: string) => body += chunk);
            req.on('end', () => {
              try {
                JSON.parse(body);
                fs.writeFileSync(filePath, body, 'utf8');
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end('{"ok":true}');
                console.log(`Saved ${url}`);
              } catch (e: any) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(`{"error":"${e.message}"}`);
              }
            });
            return;
          }

          // GET
          try {
            const data = fs.readFileSync(filePath);
            const ext = path.extname(filePath);
            const mime: Record<string, string> = {
              '.json': 'application/json',
              '.glb': 'model/gltf-binary',
              '.gltf': 'model/gltf+json',
            };
            res.writeHead(200, {
              'Content-Type': mime[ext] || 'application/octet-stream',
              'Cache-Control': 'no-cache',
            });
            res.end(data);
          } catch {
            res.writeHead(404);
            res.end('Not found');
          }
          return;
        }

        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [tailwindcss(), react(), dataServerPlugin()],
  root: '.',
  resolve: {
    alias: {
      'xfw-three': path.resolve(__dirname, 'packages/xfw-three'),
      'xfw-get-block': path.resolve(__dirname, 'packages/xfw-get-block')
    },
  },
  server: {
    port: 5173,
  },
  build: {
    outDir: 'dist',
  },
});
