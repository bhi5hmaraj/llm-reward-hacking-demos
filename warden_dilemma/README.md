# Warden's Dilemma

A web-based platform for studying strategic behavior in N-player iterated prisoner's dilemma games with private communication.

> **Note**: This app runs under the `/warden_dilemma` subpath to allow multiple experimental apps to coexist on the same server. See [SUBPATH_CONFIG.md](./SUBPATH_CONFIG.md) for details.

## Features

- **N-player support** (2-10 players)
- **Mixed populations**: Human, AI, and scripted players
- **Private 1:1 communication**: Simultaneous DM channels during gameplay
- **Configurable payoff structures**: Custom generators via TypeScript functions
- **Real-time gameplay**: Powered by Colyseus multiplayer framework
- **AI agents**: GPT-4, Claude, and other LLM integrations
- **Rich analytics**: Coalition detection, deception metrics, hypothesis testing
- **Experimenter tools**: Real-time monitoring, chat logs, data export

## Quick Start

### Prerequisites

- **Node.js 18+**
- **pnpm** (recommended) or npm
- **Upstash Redis** (optional - for data persistence)
  - Sign up at [upstash.com](https://upstash.com) for a free account
  - Works without Redis in in-memory mode for local development

### Installation

```bash
# Clone repository
cd warden_dilemma

# Install dependencies
pnpm install

# Set up environment variables (optional)
cp .env.example server/.env
# Edit server/.env with your Upstash Redis credentials if you want persistence
```

### Starting the Game

```bash
# Start the development server
pnpm dev
```

This will:
1. Build the frontend (React → static files in `client/dist`)
2. Start the Colyseus + Express server at `http://localhost:3000`
3. Serve both frontend and API from a single server

**Open your browser**:
- **App**: `http://localhost:3000/warden_dilemma`
- **Root**: `http://localhost:3000` (lists all apps)

### Alternative Development Modes

```bash
# Watch mode: Auto-rebuild client on file changes
pnpm dev:watch

# Separate servers: Frontend on :5173, Backend on :3000
pnpm dev:separate
```

See [QUICKSTART.md](./QUICKSTART.md) for more details.

### Running an Experiment

**As Experimenter:**
1. Visit `http://localhost:3000/warden_dilemma`
2. Click **"Create Experiment"**
3. Configure:
   - Experiment name and hypothesis
   - Number of players (2-10)
   - Number of rounds
   - Payoff structure (choose from presets or custom)
   - Phase durations
4. Click **"Create & Get Lobby Code"**
5. Share the **6-character lobby code** with players
6. Once all players join, click **"Start Game"**
7. Monitor the game in real-time from your dashboard

**As Player:**
1. Visit `http://localhost:3000/warden_dilemma`
2. Click **"Join Experiment"**
3. Enter the **lobby code** shared by the experimenter
4. Enter your name and wait in the lobby
5. Once game starts:
   - **Announcement Phase**: Review the payoff matrix
   - **Communication Phase**: Chat privately with other players via 1:1 DMs
   - **Action Phase**: Choose your action (Cooperate/Defect/Opt-Out)
   - **Revelation Phase**: See all actions and payoffs
6. Repeat for all rounds
7. View final results and rankings

## Project Structure

```
warden_dilemma/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── pages/          # Route pages
│   │   ├── services/       # API clients, Colyseus client
│   │   ├── hooks/          # React hooks
│   │   └── types/          # TypeScript types
│   └── package.json
│
├── server/                 # Node.js backend
│   ├── src/
│   │   ├── rooms/          # Colyseus rooms (Lobby, Game)
│   │   ├── services/       # AI agents, payoff engine
│   │   ├── models/         # Database models (Prisma)
│   │   └── api/            # Express REST API
│   └── package.json
│
├── DESIGN.md               # Comprehensive design document
└── README.md               # This file
```

## Technology Stack

**Frontend**: React 18, TypeScript, Vite, TailwindCSS, Colyseus Client, D3.js

**Backend**: Node.js, Express, Colyseus, TypeScript, Prisma

**Database**: Upstash Redis (serverless, optional), Colyseus in-memory state

**AI Integration**: OpenAI API, Anthropic API

## Game Mechanics

Players participate in an iterated prisoner's dilemma with:
- **Actions**: Cooperate (C), Defect (D), or Opt-Out
- **Communication**: Private 1:1 chat during each round
- **Payoffs**: Based on your action + number of cooperators
- **Rounds**: Configurable number of iterations

See [DESIGN.md](./DESIGN.md) for detailed game mechanics and architecture.

## Deployment

See [DEPLOYMENT.md](./DEPLOYMENT.md) for instructions on:
- Deploying to Google Cloud Run (recommended)
- Deploying with Docker
- Setting up continuous deployment from GitHub
- Environment variables and production configuration

## Development Roadmap

- [x] Phase 1: Core infrastructure and MVP
- [x] Single-server architecture with Upstash Redis
- [ ] Phase 2: Custom payoff generators and AI integration
- [ ] Phase 3: Advanced analytics and visualizations
- [ ] Phase 4: Production deployment and scaling

## Contributing

This is a research project. For questions or collaboration inquiries, please open an issue.

## License

MIT
