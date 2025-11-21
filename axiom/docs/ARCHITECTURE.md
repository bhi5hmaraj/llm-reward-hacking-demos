# Axiom Architecture

**Game Theory Analysis Service with LLM Strategy Generation**

## Overview

Axiom provides a modular platform for analyzing prisoner's dilemma strategies, combining classical game theory with modern LLM-based agents. The architecture follows SOLID principles throughout.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (Svelte)                        │
│  Strategy Playground | LLM Playground | Nash Calculator      │
│  Tournament Runner | Strategy Analyzer | Policy Manager      │
└─────────────────────────────────────────────────────────────┘
                              │
                    REST API (FastAPI)
                              │
┌─────────────────────────────────────────────────────────────┐
│                      Service Layer                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Axelrod      │  │ Nash         │  │ LLM Strategy │     │
│  │ Service      │  │ Service      │  │ Service      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│  ┌──────────────┐                                          │
│  │ Policy       │                                          │
│  │ Service      │                                          │
│  └──────────────┘                                          │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   Core Components                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Game Theory  │  │ LLM Providers│  │ Storage      │     │
│  │ (Strategies, │  │ (OpenAI,     │  │ (Redis/      │     │
│  │  Tournaments,│  │  Anthropic)  │  │  In-memory)  │     │
│  │  Analyzers)  │  │              │  │              │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                   External Dependencies                      │
│   Axelrod Library | Nashpy | OpenAI API | Anthropic API    │
└─────────────────────────────────────────────────────────────┘
```

## Core Principles

### SOLID Throughout

- **Single Responsibility**: Each class has one clear purpose
- **Open/Closed**: New implementations can be added without modifying existing code
- **Liskov Substitution**: All implementations can substitute their abstractions
- **Interface Segregation**: Clean, focused interfaces
- **Dependency Inversion**: Services depend on abstractions, not concretions

### Dependency Injection

Services use constructor injection with sensible defaults:
```python
class AxelrodService:
    def __init__(
        self,
        strategy_provider: Optional[StrategyProvider] = None,
        tournament_runner: Optional[TournamentRunner] = None
    ):
        self.strategy_provider = strategy_provider or AxelrodStrategyProvider()
        self.tournament_runner = tournament_runner or AxelrodTournamentRunner()
```

### Storage Abstraction

All persistent data uses repository pattern with automatic backend selection:
- `PolicyRepository` interface
- `RedisPolicyRepository` for production
- `InMemoryPolicyRepository` for development

## Module Structure

```
axiom/
├── app/
│   ├── api/              # FastAPI endpoints
│   │   ├── strategies.py
│   │   ├── llm_agents.py
│   │   ├── policies.py
│   │   └── ...
│   ├── services/         # Business logic
│   │   ├── game_theory/  # Game theory abstractions
│   │   ├── providers/    # LLM provider implementations
│   │   ├── policy_service.py
│   │   └── ...
│   ├── models/           # Pydantic schemas
│   ├── storage/          # Repository implementations
│   └── core/             # Configuration
├── frontend/             # Svelte UI
└── docs/                 # Documentation
    ├── storage-layer.md
    ├── llm-providers.md
    └── game-theory.md
```

## Detailed Documentation

See individual docs for detailed architecture:

- [Storage Layer](./storage-layer.md) - Repository pattern and backends
- [LLM Providers](./llm-providers.md) - Strategy pattern for LLM integration
- [Game Theory Services](./game-theory.md) - Classical strategy system

## Configuration

Environment-based configuration with sensible defaults:
- Optional Redis for persistence (falls back to in-memory)
- Optional LLM API keys (GPT-4, Claude)
- CORS configuration for frontend integration

See `.env.example` for full configuration options.

## API Structure

All endpoints follow RESTful conventions:
- `/strategies` - Classical Axelrod strategies
- `/llm` - LLM-based strategy generation
- `/policies` - Policy management
- `/equilibrium` - Nash equilibrium computation
- `/tournament` - Tournament execution

Interactive API docs available at `/docs`
