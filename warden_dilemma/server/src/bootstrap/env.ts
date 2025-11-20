import dotenv from 'dotenv';
import path from 'path';
import { existsSync } from 'fs';

export function loadEnv() {
  const possibleEnvPaths = [
    path.join(__dirname, '../../../.env'),
    path.join(__dirname, '../../.env'),
    path.join(__dirname, '../.env'),
    '.env',
  ];

  // Helpful debug during local dev
  console.log('[DEBUG] Current __dirname:', __dirname);
  console.log('[DEBUG] Trying .env paths:');

  for (const envPath of possibleEnvPaths) {
    const resolvedPath = path.resolve(envPath);
    const exists = existsSync(resolvedPath);
    console.log(`  ${exists ? '✓' : '✗'} ${resolvedPath}`);
    if (exists) {
      dotenv.config({ path: resolvedPath });
      console.log('[DEBUG] ✅ Loaded .env from:', resolvedPath);
      break;
    }
  }

  console.log('\n[DEBUG] Environment variables loaded:');
  console.log('[DEBUG] REDIS_URL exists:', !!process.env.REDIS_URL);
  console.log('[DEBUG] REDIS_URL value:', process.env.REDIS_URL ? process.env.REDIS_URL.substring(0, 30) + '...' : 'NOT SET');
  console.log('[DEBUG] UPSTASH_REDIS_REST_URL exists:', !!process.env.UPSTASH_REDIS_REST_URL);
  console.log('');

  // Optional: enable verbose Colyseus debug logs during development
  if (process.env.COLYSEUS_DEBUG === 'true') {
    // enable all colyseus namespaces if DEBUG not already set
    if (!process.env.DEBUG) {
      process.env.DEBUG = 'colyseus:*';
      console.log('[DEBUG] Enabled Colyseus DEBUG=colyseus:*');
    }
  }
}
