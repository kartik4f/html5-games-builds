//==================================================
// server.mjs
//==================================================
// Entry point. No package.json, no npm, nothing to install — just:
//
//   node server.mjs
//
// It serves the game's static files AND the WebSocket endpoint on
// the same port, so there's nothing else to stand up. Open
// http://localhost:8080 on two computers on the same network (or two
// tabs, to try it solo) to play.
//==================================================

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createWSServer } from './ws-lite.mjs';
import RoomManager from './RoomManager.mjs';

//--------------------------------------------------
// Last-resort safety net
//--------------------------------------------------
// GameRoom.mjs already catches errors around each room's own
// join()/handleMessage()/_tick() (the day-to-day sources of bugs), but
// this is the final backstop: without it, Node's default behavior for
// *any* uncaught exception or unhandled promise rejection anywhere in
// the process is to crash immediately — taking every room and every
// connected player down at once, with nothing shown to anyone, until
// something manually restarts it. Logging and continuing here trades
// "the whole server vanishes" for "one bug is now visible in the logs
// and everyone else keeps playing".
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception (server kept running):', err);
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled promise rejection (server kept running):', err);
});

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

  if (reqPath === '/') reqPath = '/index.html';

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

const roomManager = new RoomManager();

wss.on('connection', (conn) => {
  roomManager.handleConnection(conn);
});

httpServer.listen(PORT, () => {
  console.log(`Pen Fight server running at http://localhost:${PORT}`);
  console.log(`Friends on your network: http://<your-lan-ip>:${PORT}`);
});
