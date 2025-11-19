/**
 * Database Service
 *
 * Centralized Prisma client for database operations.
 * Provides connection management and graceful shutdown.
 */

import { PrismaClient } from '@prisma/client';

/**
 * Singleton Prisma client instance
 */
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development'
    ? ['query', 'info', 'warn', 'error']
    : ['error'],
});

/**
 * Initialize database connection
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await prisma.$connect();
    console.log('✅ Database connected');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    throw error;
  }
}

/**
 * Gracefully disconnect from database
 */
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('✅ Database disconnected');
  } catch (error) {
    console.error('❌ Database disconnection failed:', error);
  }
}

/**
 * Health check for database connection
 */
export async function checkDatabaseHealth(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('❌ Database health check failed:', error);
    return false;
  }
}
