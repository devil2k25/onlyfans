'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');
require('dotenv').config();

const app = require('./app');
const { initSocket } = require('./socket');

const PORT = parseInt(process.env.PORT, 10) || 5000;
const UPLOADS_DIR = process.env.UPLOADS_DIR || 'uploads';

// Ensure uploads directories exist on startup
const dirs = [
  path.join(process.cwd(), UPLOADS_DIR),
  path.join(process.cwd(), UPLOADS_DIR, 'media'),
  path.join(process.cwd(), UPLOADS_DIR, 'avatars'),
  path.join(process.cwd(), UPLOADS_DIR, 'covers'),
];

dirs.forEach((dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
});

// Create HTTP server and attach Socket.io
const httpServer = http.createServer(app);
initSocket(httpServer);

// Start the server
const server = httpServer.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════╗
║         OnlyFans Backend Server            ║
╠════════════════════════════════════════════╣
║  Status   : Running                        ║
║  Port     : ${String(PORT).padEnd(29)}║
║  Env      : ${(process.env.NODE_ENV || 'development').padEnd(29)}║
║  API Base : http://localhost:${String(PORT).padEnd(16)}/api ║
╚════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\nSIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = server;
