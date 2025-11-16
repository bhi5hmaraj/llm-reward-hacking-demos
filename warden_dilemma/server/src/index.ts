/**
 * Warden's Dilemma - Server Entry Point
 *
 * Initializes Colyseus server with Express for REST API
 */

import { Server } from 'colyseus';
import { createServer } from 'http';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const port = Number(process.env.PORT) || 3000;

// Middleware
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// REST API routes (placeholder)
app.get('/api/experiments', (req, res) => {
  // TODO: Implement experiment listing
  res.json({ experiments: [] });
});

// Create HTTP server
const server = createServer(app);

// Initialize Colyseus
const gameServer = new Server({
  server,
  express: app,
});

// Register Colyseus rooms (to be implemented)
// gameServer.define('lobby', LobbyRoom);
// gameServer.define('game', GameRoom);

// Optional: Colyseus monitor for debugging
if (process.env.MONITOR_ENABLED === 'true') {
  const { monitor } = require('@colyseus/monitor');
  app.use('/colyseus', monitor());
  console.log(`📊 Colyseus Monitor available at http://localhost:${port}/colyseus`);
}

// Start server
gameServer.listen(port);

console.log(`🎮 Warden's Dilemma Server running on port ${port}`);
console.log(`🌐 Client expected at ${process.env.CLIENT_URL || 'http://localhost:5173'}`);
console.log(`📡 WebSocket endpoint: ws://localhost:${port}`);
