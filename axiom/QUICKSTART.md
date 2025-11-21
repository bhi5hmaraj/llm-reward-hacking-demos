# Axiom Quick Start

## Installation

```bash
cd axiom

# Backend dependencies
pip install -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

## Development

### Option 1: Both Services Separately (Recommended for Development)

Terminal 1 (Backend):
```bash
python run.py
# Runs on http://localhost:8000
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
# Runs on http://localhost:5174
```

### Option 2: Built Frontend + Backend (Production-like)

```bash
# Build frontend
cd frontend
npm run build  # Outputs to ../static
cd ..

# Run backend (serves built frontend)
python run.py
# Visit http://localhost:8000
```

## Usage

### Web Interface

Visit the frontend to use the interactive UI:
- **Strategy Playground**: Test strategies against game history
- **Nash Equilibrium**: Calculate equilibria for payoff matrices
- **Tournament**: Run competitions between strategies
- **Analyzer**: Profile strategy behavior

### API

```bash
# Health check
curl http://localhost:8000/health

# List strategies
curl http://localhost:8000/strategies?basic_only=true

# Get action from Tit-for-Tat
curl -X POST http://localhost:8000/strategies/TitForTat/play \
  -H "Content-Type: application/json" \
  -d '{"history": []}'

# Compute Nash equilibrium
curl -X POST http://localhost:8000/equilibrium \
  -H "Content-Type: application/json" \
  -d '{"matrix": [[3, 0], [5, 1]]}'
```

### API Documentation

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

## Docker

```bash
# Build
docker build -t axiom .

# Run
docker run -p 8000:8000 axiom
```

## Integration with Warden's Dilemma

See [INTEGRATION.md](./INTEGRATION.md) for details on integrating Axiom with the Warden's Dilemma platform.

## Troubleshooting

**Frontend shows blank page**: Build the frontend first with `cd frontend && npm run build`

**API returns 404**: Check that the backend is running on port 8000

**CORS errors**: Update `CORS_ORIGINS` in `.env`
