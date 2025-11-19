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

import { Server } from 'colyseus';
import { RedisDriver } from '@colyseus/redis-driver';
import { RedisPresence } from '@colyseus/redis-presence';
import { createServer } from 'http';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';
import Redis from 'ioredis';

// Services
import { initializeRedis, checkRedisHealth } from './services/redis.service';
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
// Create Colyseus Server (with optional Redis driver)
// ============================================================================

// Configure Redis driver if Upstash credentials provided
let driver: RedisDriver | undefined;
let presence: RedisPresence | undefined;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Use Upstash Redis via ioredis-compatible connection string
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  try {
    const redisClient = new Redis(redisUrl);
    driver = new RedisDriver(redisClient as any);
    presence = new RedisPresence(redisClient as any);

    logger.info('Colyseus configured with Redis driver (persistence enabled)');
  } catch (error) {
    logger.warn('Failed to initialize Redis driver, using in-memory driver', error as Error);
  }
}

const app = express();
const httpServer = createServer(app);

const gameServer = new Server({
  server: httpServer,
  driver,      // undefined = in-memory driver (default)
  presence,    // undefined = local presence (default)
});

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
  app.use((req: Request, res: Response, next: NextFunction) => {
    logger.debug(`${req.method} ${req.path}`, {
      query: req.query,
      body: req.method !== 'GET' ? req.body : undefined,
    });
    next();
  });
}

// ============================================================================
// Health Check (both root and subpath for compatibility)
// ============================================================================

const healthHandler = async (req: Request, res: Response) => {
  const redisHealthy = await checkRedisHealth();

  const health = {
    status: 'ok', // Always OK even if Redis is down (we fall back to in-memory)
    timestamp: new Date().toISOString(),
    redis: redisHealthy ? 'connected' : 'not_configured_or_disconnected',
    persistence: redisHealthy ? 'enabled' : 'in_memory_only',
    uptime: process.uptime(),
  };

  res.status(200).json(health);
};

app.get('/health', healthHandler);  // Root health check
app.get('/warden_dilemma/health', healthHandler);  // Subpath health check

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

// Register custom API routes under /warden_dilemma/api
app.use('/warden_dilemma/api', experimentsApi);

// API documentation endpoint
app.get('/warden_dilemma/api', (req: Request, res: Response) => {
  res.json({
    name: 'Warden\'s Dilemma API',
    version: '0.1.0',
    endpoints: {
      experiments: {
        create: 'POST /warden_dilemma/api/experiments',
        list: 'GET /warden_dilemma/api/experiments',
        get: 'GET /warden_dilemma/api/experiments/:id',
        results: 'GET /warden_dilemma/api/experiments/:id/results',
        chats: 'GET /warden_dilemma/api/experiments/:id/chats',
        delete: 'DELETE /warden_dilemma/api/experiments/:id',
      },
      health: 'GET /warden_dilemma/health',
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
// Serve Frontend (Production or Built Client) under /warden_dilemma
// ============================================================================

if (clientExists) {
  // Serve static files from client/dist under /warden_dilemma
  app.use('/warden_dilemma', express.static(clientDistPath));

  // SPA fallback: Return index.html for all /warden_dilemma/* routes
  app.get('/warden_dilemma/*', (req: Request, res: Response) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });

  logger.info('Serving frontend from client/dist at /warden_dilemma');
} else if (isDevelopment) {
  logger.warn('Client not built. Run "pnpm build:client" or use separate Vite dev server on http://localhost:5173/warden_dilemma');
} else {
  logger.error('Client build not found. Run "pnpm build:client" before starting production server.');
}

// Root endpoint - list all apps
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'LLM Reward Hacking Demos',
    apps: [
      {
        name: 'Warden\'s Dilemma',
        description: 'N-player iterated prisoner\'s dilemma platform',
        url: '/warden_dilemma',
        status: 'active'
      }
      // Future apps can be added here
    ],
    endpoints: {
      wardenDilemma: {
        app: '/warden_dilemma',
        api: '/warden_dilemma/api',
        health: '/warden_dilemma/health',
        websocket: `ws://${req.get('host')}`
      }
    }
  });
});

// ============================================================================
// Start Server
// ============================================================================

async function startServer() {
  try {
    // Initialize Redis (optional, falls back to in-memory if not configured)
    await initializeRedis();

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
