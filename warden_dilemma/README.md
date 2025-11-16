# Warden's Dilemma

A web-based platform for studying strategic behavior in N-player iterated prisoner's dilemma games with private communication.

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

- Node.js 18+
- PostgreSQL 15+
- Redis 7+
- pnpm (recommended) or npm

### Installation

```bash
# Install dependencies
pnpm install

# Set up environment variables
cp .env.example .env
# Edit .env with your database credentials and API keys

# Run database migrations
cd server && pnpm db:migrate

# Start development servers
pnpm dev
```

This will start:
- Client dev server: `http://localhost:5173`
- Server (Colyseus + API): `http://localhost:3000`

### Running an Experiment

1. Navigate to `http://localhost:5173/experiment/new`
2. Configure game parameters (players, rounds, payoff structure)
3. Launch the experiment (generates a lobby code)
4. Players join via lobby code
5. Monitor real-time from experimenter dashboard

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

**Database**: PostgreSQL, Redis

**AI Integration**: OpenAI API, Anthropic API

## Game Mechanics

Players participate in an iterated prisoner's dilemma with:
- **Actions**: Cooperate (C), Defect (D), or Opt-Out
- **Communication**: Private 1:1 chat during each round
- **Payoffs**: Based on your action + number of cooperators
- **Rounds**: Configurable number of iterations

See [DESIGN.md](./DESIGN.md) for detailed game mechanics and architecture.

## Development Roadmap

- [x] Phase 1: Core infrastructure and MVP
- [ ] Phase 2: Custom payoff generators and AI integration
- [ ] Phase 3: Advanced analytics and visualizations
- [ ] Phase 4: Scaling and production deployment

## Contributing

This is a research project. For questions or collaboration inquiries, please open an issue.

## License

MIT
