# Axiom Frontend

Svelte frontend for the Axiom game theory service.

## Development

```bash
# Install dependencies
npm install

# Start dev server (port 5174)
npm run dev

# Build for production
npm run build
```

## Features

- **Strategy Playground** - Test strategies against game history
- **Nash Equilibrium Calculator** - Compute equilibria for payoff matrices
- **Tournament Runner** - Run tournaments between strategies
- **Strategy Analyzer** - Analyze strategy performance

## Tech Stack

- Svelte 4
- Vite
- Vanilla CSS (no framework)

## API Integration

The frontend proxies API requests to the FastAPI backend at `http://localhost:8000`.

In production, FastAPI serves the built frontend from the `../static` directory.
