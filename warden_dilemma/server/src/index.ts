/**
 * Warden's Dilemma - Server Entry Point
 *
 * Uses Colyseus with Upstash Redis for persistence.
 *
 * Architecture:
 * - Colyseus: Real-time game state + HTTP routes + Redis driver
 * - Upstash Redis: Serverless persistence (no database needed!)
 * - Static file serving: Frontend from client/dist
 */

// Load env variables (before other imports use them)
import { loadEnv } from './bootstrap/env';
loadEnv();

// ============================================================================
// Now import everything else (env vars are available)
// ============================================================================
import { Server } from 'colyseus';
import { createServer } from 'http';

// Services
import { initializeRedis } from './services/redis.service';
import { logger } from './services/logger.service';

// API routes
import { registerRooms } from './bootstrap/rooms';
import { configureRedis } from './bootstrap/redis';
import { registerHealth } from './http/health';
import { registerApi } from './http/api';
import { registerStatic } from './http/static';
import { registerMonitor } from './http/monitor';
import { createApp } from './http/app';
import { registerDebug } from './http/debug';

const port = Number(process.env.PORT) || 3000;
// (isDevelopment & clientExists come from createApp())

// ============================================================================
// Create Colyseus Server (with optional Redis driver)
// ============================================================================

// Redis (driver/presence)
const { driver, presence } = configureRedis();

const { app, isDevelopment, clientExists } = createApp();
const httpServer = createServer(app);
const gameServer = new Server({
  server: httpServer,
  driver,      // undefined = in-memory driver (default)
  presence,    // undefined = local presence (default)
});

// ============================================================================
// Middleware
// ============================================================================

// HTTP setup
registerHealth(app);
registerApi(app, port);
registerMonitor(app);
registerStatic(app, isDevelopment);
registerDebug(app);

// ============================================================================
// Register Colyseus Rooms
// ============================================================================

registerRooms(gameServer);

// API and docs
// (already registered above)

// ============================================================================
// Start Server
// ============================================================================

async function startServer() {
  try {
    // Initialize Upstash Redis REST API (for experiment storage)
    await initializeRedis();

    // RedisDriver/RedisPresence will manage their own connections from REDIS_URL

    // Start listening
    gameServer.listen(port);

    logger.info('🎮 Warden\'s Dilemma Server started', {
      port,
      environment: process.env.NODE_ENV || 'development',
      servingFrontend: clientExists,
      websocket: `ws://localhost:${port}`,
      persistence: driver ? 'redis' : 'in_memory',
    });

    console.log('\n' + '='.repeat(60));
    console.log('  🎮  Warden\'s Dilemma Server');
    console.log('='.repeat(60));
    console.log(`  Environment:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`  Server:       http://localhost:${port}`);
    console.log(`  WebSocket:    ws://localhost:${port}`);

    if (clientExists) {
      console.log(`  Frontend:     http://localhost:${port}`);
      console.log(`  API:          http://localhost:${port}/api`);
    } else if (isDevelopment) {
      console.log(`  Frontend:     http://localhost:5173 (Vite dev server)`);
      console.log(`  API:          http://localhost:${port}/api`);
    }

    if (process.env.MONITOR_ENABLED === 'true') {
      console.log(`  Monitor:      http://localhost:${port}/colyseus`);
    }
    console.log('='.repeat(60) + '\n');
  } catch (error) {
    logger.error('Failed to start server', error as Error);
    process.exit(1);
  }
}

// ============================================================================
// Graceful Shutdown
// ============================================================================

async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, shutting down gracefully...`);

  // Stop accepting new connections
  gameServer.gracefullyShutdown(false);

  logger.info('Server shut down complete');
  process.exit(0);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', reason as Error, { promise });
  process.exit(1);
});

// ============================================================================
// Start
// ============================================================================

startServer();
