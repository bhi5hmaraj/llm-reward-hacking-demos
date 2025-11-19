# Warden's Dilemma - Quick Start

**Single-server setup**: The backend serves both the API and the built frontend.

---

## Installation (5 minutes)

```bash
# 1. Install dependencies
pnpm install

# 2. Setup database
createdb warden_dilemma

# 3. Configure environment
cd server
cp ../.env.example .env
# Edit DATABASE_URL in .env

# 4. Run migrations
pnpm db:migrate
cd ..

# 5. Start server
pnpm dev
```

**Open**: `http://localhost:3000`

---

## Development Modes

### **Mode 1: Single Server (Recommended)**

Build frontend once, then server serves it:

```bash
pnpm dev
```

- Frontend: `http://localhost:3000`
- API: `http://localhost:3000/api`
- WebSocket: `ws://localhost:3000`

**Rebuild frontend** after changes:
```bash
pnpm build:client
```

---

### **Mode 2: Watch Mode (Auto-rebuild)**

Frontend rebuilds automatically on changes:

```bash
pnpm dev:watch
```

- Frontend rebuilds on file changes
- Server auto-restarts with `tsx watch`

---

### **Mode 3: Separate Servers (Legacy)**

Run Vite dev server separately (hot reload):

```bash
# Terminal 1
cd server && pnpm dev

# Terminal 2
cd client && pnpm dev
```

- Frontend: `http://localhost:5173` (Vite)
- API: `http://localhost:3000`

**Enable CORS** by setting in `client/.env`:
```
VITE_COLYSEUS_URL=ws://localhost:3000
VITE_API_URL=http://localhost:3000/api
```

---

## Production Build

```bash
# Build everything
pnpm build

# Start production server
pnpm start
```

Serves optimized frontend + API from `http://localhost:3000`

---

## Common Tasks

### Database

```bash
# Migrate
cd server && pnpm db:migrate

# Open Prisma Studio
pnpm db:studio

# Reset database
pnpm db:migrate reset
```

### Testing

```bash
# Run all tests
pnpm test

# Server tests only
cd server && pnpm test

# Client tests only
cd client && pnpm test
```

### Clean Build

```bash
# Remove all build artifacts
pnpm clean

# Rebuild from scratch
pnpm clean && pnpm build
```

---

## Troubleshooting

### "Client not built" warning

```bash
pnpm build:client
```

### Port 3000 in use

```bash
# Kill process
lsof -ti:3000 | xargs kill -9

# Or change port in server/.env
PORT=3001
```

### Database connection failed

```bash
# Check PostgreSQL is running
pg_isready

# Verify DATABASE_URL in server/.env
```

---

See `SETUP.md` for comprehensive guide and `DESIGN.md` for architecture details.
