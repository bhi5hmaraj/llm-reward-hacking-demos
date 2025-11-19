/**
 * Warden's Dilemma - Server Entry Point
 *
 * Uses Colyseus's built-in HTTP routing for cleaner integration.
 *
 * Architecture:
 * - Colyseus: Real-time game state + HTTP routes
 * - PostgreSQL: Persistent storage via Prisma
 * - Static file serving: Frontend from client/dist
 */

import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

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

const port = Number(process.env.PORT) || 3000;
const isDevelopment = process.env.NODE_ENV === 'development';

// Client build path
const clientDistPath = path.join(__dirname, '../../client/dist');
const clientExists = existsSync(clientDistPath);

// ============================================================================
// Create Colyseus Server
// ============================================================================

const gameServer = new Server({
  server: createServer(),
});

// Get the underlying Express app
const app = gameServer.app;

// ============================================================================
// Middleware
// ============================================================================

// CORS only needed in development when using separate Vite server
if (isDevelopment && !clientExists) {
  app.use(cors({
    origin: 'http://localhost:5173',
    credentials: true,
  }));
  logger.info('CORS enabled for development (separate Vite server)');
}

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
// Register Colyseus Rooms
// ============================================================================

gameServer.define('lobby', LobbyRoom);
gameServer.define('game', GameRoom);

logger.info('Colyseus rooms registered', {
  rooms: ['lobby', 'game'],
});

// ============================================================================
// REST API Routes (using Colyseus's built-in Express app)
// ============================================================================

/**
 * Note: Colyseus provides built-in matchmaker endpoints automatically:
 * - GET /matchmaker/rooms - List all rooms
 * - POST /matchmaker/joinOrCreate/:roomName - Join or create room
 * - GET /matchmaker/availability/:roomName - Check room availability
 *
 * See: https://docs.colyseus.io/server/matchmaker/#built-in-http-endpoints
 */

// Register custom API routes
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
    matchmaker: {
      info: 'Colyseus provides built-in matchmaker endpoints',
      docs: 'https://docs.colyseus.io/server/matchmaker/#built-in-http-endpoints',
      endpoints: {
        rooms: 'GET /matchmaker/rooms',
        join: 'POST /matchmaker/joinOrCreate/:roomName',
        availability: 'GET /matchmaker/availability/:roomName',
      },
    },
    websocket: {
      endpoint: `ws://localhost:${port}`,
      rooms: ['lobby', 'game'],
    },
  });
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
// Serve Frontend (Production or Built Client)
// ============================================================================

if (clientExists) {
  // Serve static files from client/dist
  app.use(express.static(clientDistPath));

  // SPA fallback: Return index.html for all non-API routes
  app.get('*', (req, res) => {
    // Skip API routes, health check, and colyseus monitor
    if (req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/colyseus')) {
      return res.status(404).json({ error: 'Not found' });
    }

    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  logger.info('Serving frontend from client/dist');
} else if (isDevelopment) {
  logger.warn('Client not built. Run "pnpm build:client" or use separate Vite dev server on http://localhost:5173');
} else {
  logger.error('Client build not found. Run "pnpm build:client" before starting production server.');
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
      servingFrontend: clientExists,
      websocket: `ws://localhost:${port}`,
      database: 'connected',
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
