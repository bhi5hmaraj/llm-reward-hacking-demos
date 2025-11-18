# Warden's Dilemma - Setup Guide

Complete setup and development guide for the Warden's Dilemma platform.

---

## Prerequisites

- **Node.js** 18+ (with npm or pnpm)
- **PostgreSQL** 15+
- **Redis** 7+ (optional for MVP, required for production)
- **Git**

---

## Quick Start (Development)

### 1. Clone and Install

```bash
cd warden_dilemma

# Install root dependencies
pnpm install

# Install server dependencies
cd server
pnpm install

# Install client dependencies
cd ../client
pnpm install
cd ..
```

### 2. Database Setup

```bash
# Start PostgreSQL (if not running)
# On macOS with Homebrew:
brew services start postgresql@15

# Create database
createdb warden_dilemma

# Or via psql:
psql postgres
CREATE DATABASE warden_dilemma;
\q
```

### 3. Environment Configuration

**Server** (`server/.env`):

```bash
cd server
cp ../.env.example .env

# Edit .env with your database credentials:
# DATABASE_URL="postgresql://user:password@localhost:5432/warden_dilemma?schema=public"
# PORT=3000
# CLIENT_URL=http://localhost:5173
```

**Client** (`client/.env`):

```bash
cd ../client
cp .env.example .env

# Defaults should work for local development:
# VITE_COLYSEUS_URL=ws://localhost:3000
# VITE_API_URL=http://localhost:3000/api
```

### 4. Database Migration

```bash
cd server

# Generate Prisma client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Verify with Prisma Studio (optional)
pnpm db:studio
```

### 5. Start Development Servers

**Option A: Run both servers simultaneously (recommended)**

```bash
# From root directory
pnpm dev
```

This starts:
- Server (Colyseus + API): `http://localhost:3000`
- Client (Vite): `http://localhost:5173`

**Option B: Run servers separately**

Terminal 1 (Server):
```bash
cd server
pnpm dev
```

Terminal 2 (Client):
```bash
cd client
pnpm dev
```

### 6. Verify Installation

Open browser to `http://localhost:5173`

You should see the Warden's Dilemma homepage.

---

## Running an Experiment

### As Experimenter

1. Navigate to "Create New Experiment"
2. Configure:
   - Experiment name
   - Number of players (2-10)
   - Number of rounds
   - Payoff generator preset
3. Click "Create Experiment"
4. You'll be redirected to the lobby with a **6-character lobby code**
5. Share the lobby code with players
6. Once all players join, click "Start Experiment"
7. Monitor gameplay in real-time
8. View results when game ends

### As Player

1. On homepage, enter the lobby code provided by experimenter
2. Wait in lobby for other players to join
3. When game starts:
   - **Announcement Phase**: Review payoff matrix
   - **Communication Phase**: Chat privately with other players (1:1 DMs)
   - **Action Phase**: Choose Cooperate, Defect, or Opt-Out
   - **Revelation Phase**: See results and updated scores
4. Repeat for all rounds
5. View final results

---

## Project Structure

```
warden_dilemma/
│
├── server/                     # Backend (Colyseus + Express)
│   ├── src/
│   │   ├── index.ts            # Server entry point
│   │   ├── types/              # TypeScript types
│   │   ├── rooms/              # Colyseus rooms
│   │   │   ├── LobbyRoom.ts    # Pre-game matchmaking
│   │   │   ├── GameRoom.ts     # Main game orchestration
│   │   │   └── schemas/        # Colyseus state schemas
│   │   ├── services/           # Business logic
│   │   │   ├── database.service.ts
│   │   │   ├── logger.service.ts
│   │   │   └── payoff-engine.service.ts
│   │   └── api/                # REST endpoints
│   │       └── experiments.api.ts
│   ├── prisma/
│   │   └── schema.prisma       # Database schema
│   ├── package.json
│   └── tsconfig.json
│
├── client/                     # Frontend (React + Vite)
│   ├── src/
│   │   ├── main.tsx            # Entry point
│   │   ├── App.tsx             # Root component with routing
│   │   ├── types/              # TypeScript types
│   │   ├── services/           # API clients
│   │   │   ├── api.service.ts
│   │   │   └── colyseus.service.ts
│   │   └── pages/              # Route pages
│   │       ├── HomePage.tsx
│   │       ├── CreateExperimentPage.tsx
│   │       ├── LobbyPage.tsx
│   │       ├── GamePage.tsx
│   │       └── ResultsPage.tsx
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── DESIGN.md                   # Comprehensive design document
├── SETUP.md                    # This file
├── README.md                   # Quick start guide
└── package.json                # Workspace root
```

---

## Key Technologies

### Backend

- **Colyseus**: Real-time multiplayer framework
- **Express**: REST API server
- **Prisma**: Database ORM
- **PostgreSQL**: Relational database
- **TypeScript**: Type safety

### Frontend

- **React**: UI framework
- **React Router**: Client-side routing
- **Colyseus Client**: WebSocket client
- **Vite**: Build tool and dev server
- **TypeScript**: Type safety

---

## Development Workflow

### Database Changes

1. Edit `server/prisma/schema.prisma`
2. Run migration:
   ```bash
   cd server
   pnpm db:migrate
   ```
3. Prisma Client regenerates automatically

### Adding New API Endpoint

1. Add route to `server/src/api/experiments.api.ts` (or create new file)
2. Import and mount in `server/src/index.ts`
3. Create corresponding client method in `client/src/services/api.service.ts`

### Adding New Colyseus Room

1. Create room class in `server/src/rooms/`
2. Create state schema in `server/src/rooms/schemas/`
3. Register in `server/src/index.ts`:
   ```typescript
   gameServer.define('my_room', MyRoom);
   ```

### Adding New Page

1. Create component in `client/src/pages/`
2. Add route in `client/src/App.tsx`:
   ```typescript
   <Route path="/my-page" element={<MyPage />} />
   ```

---

## Debugging

### Server Logs

All server-side events are logged via `logger.service.ts`:

```typescript
import { logger } from './services/logger.service';

logger.info('Message', { context });
logger.error('Error', error, { context });
logger.gameEvent('event_name', { data });
```

Logs include timestamps and structured context for easy filtering.

### Client Logs

Browser console shows:
- Colyseus connection events
- Room state changes
- Message send/receive
- Errors

Open DevTools → Console

### Database Inspection

```bash
cd server
pnpm db:studio
```

Opens Prisma Studio at `http://localhost:5555` for browsing tables.

### Colyseus Monitor (Optional)

1. Install `@colyseus/monitor`:
   ```bash
   cd server
   pnpm add @colyseus/monitor
   ```

2. Enable in `.env`:
   ```
   MONITOR_ENABLED=true
   ```

3. Access at `http://localhost:3000/colyseus`

---

## Common Issues

### Port Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution**: Kill process on port 3000:
```bash
lsof -ti:3000 | xargs kill -9
```

Or change port in `server/.env`:
```
PORT=3001
```

### Database Connection Failed

```
Error: Can't reach database server
```

**Solution**: Verify PostgreSQL is running:
```bash
pg_isready
psql -U postgres -c "SELECT 1"
```

Check DATABASE_URL in `server/.env`

### Prisma Client Not Found

```
Error: @prisma/client did not initialize yet
```

**Solution**: Generate Prisma Client:
```bash
cd server
pnpm db:generate
```

### WebSocket Connection Failed

```
WebSocket connection to 'ws://localhost:3000' failed
```

**Solution**: Ensure server is running. Check `VITE_COLYSEUS_URL` in `client/.env`

---

## Testing

### Manual Testing Flow

1. Create experiment (as experimenter)
2. Open lobby page in **3 different browsers/tabs**:
   - Tab 1: Experimenter view
   - Tabs 2-3: Player views with lobby code
3. Start game from experimenter tab
4. Test full game flow:
   - View payoff matrix
   - Send chat messages (1:1 only)
   - Submit actions
   - View results
5. Check database in Prisma Studio

### Automated Tests (Phase 2)

```bash
# Server tests
cd server
pnpm test

# Client tests
cd client
pnpm test
```

---

## Building for Production

### Server

```bash
cd server
pnpm build

# Output in server/dist/
node dist/index.js
```

### Client

```bash
cd client
pnpm build

# Output in client/dist/
# Serve with any static file server
npx serve -s dist
```

---

## Environment Variables Reference

### Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `3000` | Server port |
| `DATABASE_URL` | - | PostgreSQL connection string |
| `REDIS_URL` | - | Redis connection string (optional) |
| `CLIENT_URL` | `http://localhost:5173` | CORS allowed origin |
| `OPENAI_API_KEY` | - | OpenAI API key (for AI players) |
| `ANTHROPIC_API_KEY` | - | Anthropic API key (for AI players) |
| `JWT_SECRET` | - | JWT signing secret (for auth) |
| `MONITOR_ENABLED` | `false` | Enable Colyseus Monitor |

### Client (`client/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_COLYSEUS_URL` | `ws://localhost:3000` | WebSocket URL |
| `VITE_API_URL` | `http://localhost:3000/api` | REST API URL |

---

## Contributing

1. Create feature branch: `git checkout -b feature/my-feature`
2. Make changes with clear commits
3. Test thoroughly
4. Submit pull request

---

## Support

For issues or questions:
1. Check `DESIGN.md` for architecture details
2. Review this setup guide
3. Check browser console / server logs
4. Open GitHub issue with reproduction steps

---

## License

MIT
