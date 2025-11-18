/**
 * Warden's Dilemma - Server Entry Point
 *
 * Initializes Colyseus server with Express for REST API.
 *
 * Architecture:
 * - Colyseus: Real-time game state synchronization
 * - Express: REST API for experiment management
 * - PostgreSQL: Persistent storage via Prisma
 * - Redis: Session cache (future)
 */

import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Services
import { initializeDatabase, disconnectDatabase, checkDatabaseHealth } from './services/database.service';
import { logger } from './services/logger.service';

// Rooms
import { LobbyRoom } from './rooms/LobbyRoom';
import { GameRoom } from './rooms/GameRoom';

// API routes
import experimentsApi from './api/experiments.api';

// Load environment variables
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;
const isDevelopment = process.env.NODE_ENV === 'development';

// ============================================================================
// Middleware
// ============================================================================

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
}));

app.use(express.json());

// Request logging (development only)
if (isDevelopment) {
  app.use((req, res, next) => {
    logger.debug(`${req.method} ${req.path}`, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });
    next();
  });
}

// ============================================================================
// Health Check
// ============================================================================

app.get('/health', async (req, res) => {
  const dbHealthy = await checkDatabaseHealth();

  const health = {
    status: dbHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    database: dbHealthy ? 'connected' : 'disconnected',
    uptime: process.uptime(),
  };

  res.status(dbHealthy ? 200 : 503).json(health);
});

// ============================================================================
// REST API Routes
// ============================================================================

app.use('/api', experimentsApi);

// API documentation endpoint
app.get('/api', (req, res) => {
  res.json({
    name: 'Warden\'s Dilemma API',
    version: '0.1.0',
    endpoints: {
      experiments: {
        create: 'POST /api/experiments',
        list: 'GET /api/experiments',
        get: 'GET /api/experiments/:id',
        results: 'GET /api/experiments/:id/results',
        chats: 'GET /api/experiments/:id/chats',
        delete: 'DELETE /api/experiments/:id',
      },
      health: 'GET /health',
    },
    websocket: {
      endpoint: `ws://localhost:${port}`,
      rooms: ['lobby', 'game'],
    },
  });
});

// ============================================================================
// Create HTTP & Colyseus Server
// ============================================================================

const server = createServer(app);

const gameServer = new Server({
  server,
  express: app,
});

// ============================================================================
// Register Colyseus Rooms
// ============================================================================

gameServer.define('lobby', LobbyRoom);
gameServer.define('game', GameRoom);

logger.info('Colyseus rooms registered', {
  rooms: ['lobby', 'game'],
});

// ============================================================================
// Colyseus Monitor (Development Only)
// ============================================================================

if (process.env.MONITOR_ENABLED === 'true') {
  try {
    const { monitor } = require('@colyseus/monitor');
    app.use('/colyseus', monitor());
    logger.info('Colyseus Monitor enabled at /colyseus');
  } catch (error) {
    logger.warn('Colyseus Monitor not available (install @colyseus/monitor)');
  }
}

// ============================================================================
// Start Server
// ============================================================================

async function startServer() {
  try {
    // Initialize database
    await initializeDatabase();

    // Start listening
    gameServer.listen(port);

    logger.info('🎮 Warden\'s Dilemma Server started', {
      port,
      environment: process.env.NODE_ENV || 'development',
      clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
      websocket: `ws://localhost:${port}`,
      database: 'connected',
    });

    console.log('\n' + '='.repeat(60));
    console.log('  🎮  Warden\'s Dilemma Server');
    console.log('='.repeat(60));
    console.log(`  Environment:  ${process.env.NODE_ENV || 'development'}`);
    console.log(`  HTTP Server:  http://localhost:${port}`);
    console.log(`  WebSocket:    ws://localhost:${port}`);
    console.log(`  Client URL:   ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
    console.log(`  API Docs:     http://localhost:${port}/api`);
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

  // Disconnect from database
  await disconnectDatabase();

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
