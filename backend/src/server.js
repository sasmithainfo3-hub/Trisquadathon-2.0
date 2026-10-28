import http from 'http';
import { app } from './app.js';
import { config } from './config/env.js';
import { connectDb, disconnectDb } from './config/db.js';
import { initSocket } from './config/socket.js';
import { startQueueWorker, stopQueueWorker } from './services/queueWorker.js';
import { ensureDemoData } from './utils/autoSeed.js';

const server = http.createServer(app);

// Initialize Socket.io
initSocket(server);

async function startServer() {
  try {
    await connectDb();
  } catch (err) {
    console.warn('[SafePath Database] Startup warning:', err.message);
  }

  try {
    if (mongoose.connection.readyState === 1) {
      await ensureDemoData();
      startQueueWorker(5000);
    } else {
      console.warn('[SafePath Database] Running in degraded mode until database connects.');
    }
  } catch (seedErr) {
    console.warn('[SafePath Database] Demo data seed notice:', seedErr.message);
  }

  server.listen(config.port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 SafePath Backend Server running on port ${config.port}`);
    console.log(`🌐 REST API base: http://localhost:${config.port}/api/v1`);
    console.log(`📡 WebSocket ready on origin: ${config.clientUrl}`);
    console.log(`⚡ Environment: ${config.nodeEnv}`);
    console.log(`======================================================\n`);
  });
}

async function shutdown() {
  console.log('\n[SafePath] Shutting down gracefully...');
  stopQueueWorker();
  server.close(async () => {
    await disconnectDb();
    console.log('[SafePath] Server closed. Exit 0.');
    process.exit(0);
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

startServer();
