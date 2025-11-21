# Axiom - Game Theory Analysis Service

**Axiom** is a FastAPI-based microservice for game theory analysis, providing Nash equilibrium computation, strategy analysis, and baseline AI agents for the Warden's Dilemma platform.

## Name Origin

**Axiom** (noun): *A self-evident truth that requires no proof; a fundamental principle.*

Named after the foundational axioms of game theory (von Neumann-Morgenstern axioms, independence axiom, etc.), Axiom provides the mathematical foundations for analyzing strategic behavior.

## Features

- 🎯 **Nash Equilibrium Computation** - Compute Nash equilibria for any payoff matrix
- 🤖 **200+ Classic Strategies** - Axelrod library integration (Tit-for-Tat, Pavlov, etc.)
- 🏆 **Tournament Framework** - Run strategy tournaments and benchmarks
- 📊 **Strategy Analysis** - Fingerprinting, cooperation patterns, coalition detection
- 🔬 **Research Tools** - Compare LLM behavior against classical strategies

## Tech Stack

- **FastAPI** - Modern, fast web framework
- **Axelrod** - Iterated Prisoner's Dilemma research library
- **Nashpy** - Nash equilibrium computation
- **Pydantic** - Data validation
- **Uvicorn** - ASGI server

## Quick Start

```bash
# Install dependencies
pip install -r requirements.txt

# Run development server
uvicorn app.main:app --reload --port 8000

# Run with Docker
docker build -t axiom .
docker run -p 8000:8000 axiom
```

## API Endpoints

### Nash Equilibrium
```
POST /equilibrium
Calculate Nash equilibria for a given payoff matrix
```

### Strategy Analysis
```
POST /strategies/analyze
Analyze a strategy's cooperation patterns
```

### Tournament
```
POST /tournament
Run a tournament between multiple strategies
```

### Baseline Agents
```
GET /agents
List available baseline strategies

POST /agents/{strategy}/play
Get action recommendation from a baseline agent
```

## Integration with Warden's Dilemma

Axiom runs as a separate service alongside the Node.js server:

```
http://localhost:3000           → Warden's Dilemma (Node.js)
http://localhost:3000/warden_dilemma → Frontend
http://localhost:8000           → Axiom (Python)
```

The Node.js server calls Axiom's API for:
- Computing Nash equilibria for custom payoff matrices
- Running AI opponents using classical strategies
- Generating baseline comparisons for research

## Environment Variables

```bash
# Server
PORT=8000
HOST=0.0.0.0
LOG_LEVEL=info

# CORS (for local development)
CORS_ORIGINS=http://localhost:3000,http://localhost:5173
```

## Development

```bash
# Install dev dependencies
pip install -r requirements-dev.txt

# Run tests
pytest

# Format code
black app/
isort app/

# Type checking
mypy app/
```

## Architecture

```
axiom/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── api/
│   │   ├── equilibrium.py   # Nash equilibrium endpoints
│   │   ├── strategies.py    # Axelrod strategy endpoints
│   │   └── tournament.py    # Tournament endpoints
│   ├── services/
│   │   ├── nash.py          # Nashpy integration
│   │   ├── axelrod_service.py  # Axelrod integration
│   │   └── analysis.py      # Strategy analysis
│   ├── models/
│   │   └── schemas.py       # Pydantic models
│   └── core/
│       ├── config.py        # Configuration
│       └── logging.py       # Logging setup
├── tests/
├── Dockerfile
├── requirements.txt
├── requirements-dev.txt
└── README.md
```

## Example Usage

### Compute Nash Equilibrium

```python
import requests

payoff_matrix = {
    "players": 3,
    "matrix": [[3, 0, 5], [5, 1, 3], [0, 4, 1]]
}

response = requests.post(
    "http://localhost:8000/equilibrium",
    json=payoff_matrix
)

print(response.json())
# {"equilibria": [...], "is_unique": true}
```

### Get AI Agent Action

```python
history = [
    {"round": 1, "my_action": "C", "opponent_action": "D"},
    {"round": 2, "my_action": "D", "opponent_action": "D"}
]

response = requests.post(
    "http://localhost:8000/agents/tit_for_tat/play",
    json={"history": history}
)

print(response.json())
# {"action": "D", "reasoning": "Opponent defected last round"}
```

## Research Applications

1. **Baseline Comparison**: Compare LLM strategies against 200+ classical strategies
2. **Equilibrium Validation**: Verify that defection is the Nash equilibrium
3. **Coalition Analysis**: Detect emergent cooperation patterns
4. **Strategy Benchmarking**: Measure how LLMs perform vs. Tit-for-Tat, Pavlov, etc.
5. **Hypothesis Testing**: Test if AI exhibits novel strategic behavior

## Citation

If you use Axiom in your research, please cite:

- **Axelrod library**: Knight et al. (2016) - https://github.com/Axelrod-Python/Axelrod
- **Nashpy**: Knight & Harper (2018) - https://github.com/drvinceknight/Nashpy

## License

MIT
