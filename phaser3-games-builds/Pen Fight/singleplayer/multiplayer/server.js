//==================================================
// server.js
//==================================================
// Entry point. Zero npm dependencies on purpose (see ws-lite.js) —
// just run:
//
//   node server.js
//
// It serves the game's static files AND the WebSocket endpoint on
// the same port, so there's nothing else to stand up. Open
// http://localhost:8080/multiplayer.html on two computers on the same
// network (or two tabs, to try it solo) to play.
//==================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWSServer } from './ws-lite.js';
import Room from './Room.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..'); // project root (one level above /server)

const PORT = process.env.PORT ? Number(process.env.PORT) : 8080;

//--------------------------------------------------
// Static file serving
//--------------------------------------------------

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
};

function serveStatic(req, res) {
  let reqPath = decodeURIComponent(req.url.split('?')[0]);

  if (reqPath === '/') reqPath = '/multiplayer.html';

  const filePath = path.join(ROOT, reqPath);

  // Prevent escaping the project root.
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);

    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
    });
    res.end(data);
  });
}

//--------------------------------------------------
// HTTP + WS
//--------------------------------------------------

const httpServer = http.createServer(serveStatic);

const wss = createWSServer(httpServer, { path: '/ws' });

const room = new Room();

wss.on('connection', (conn) => {
  room.join(conn);
});

httpServer.listen(PORT, () => {
  console.log(`Pen Fight server running at http://localhost:${PORT}`);
  console.log(`Friends on your network: http://<your-lan-ip>:${PORT}`);
});
