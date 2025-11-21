# Game Theory Services

**Modular System for IPD Strategies and Nash Equilibria**

## Overview

Game theory services provide classical strategy analysis using the Axelrod library (200+ IPD strategies) and Nash equilibrium computation with Nashpy. All components follow SOLID principles with clear separation of concerns.

## Architecture

### Core Abstractions

```python
# Strategy management
class StrategyProvider(ABC):
    def list_strategies(self, filter_basic: bool) -> List[Dict]
    def get_strategy(self, strategy_name: str)
    def play_action(self, strategy_name, history) -> Tuple[str, str]

# Tournament execution
class TournamentRunner(ABC):
    def run_tournament(self, strategy_names, turns, repetitions) -> Dict

# Strategy analysis
class StrategyAnalyzer(ABC):
    def analyze_strategy(self, strategy_name, turns) -> Dict

# Equilibrium computation
class EquilibriumCalculator(ABC):
    def compute_equilibria(self, payoff_matrix) -> Dict
    def is_dominant_strategy(self, payoff_matrix, strategy_index) -> bool
```

## Axelrod Service

Orchestrates IPD strategy operations:

```python
class AxelrodService:
    def __init__(
        self,
        strategy_provider: Optional[StrategyProvider] = None,
        tournament_runner: Optional[TournamentRunner] = None,
        strategy_analyzer: Optional[StrategyAnalyzer] = None
    )
```

### Strategy Provider

Manages 200+ strategies from Axelrod library:
- `TitForTat`, `Cooperator`, `Defector`, `Grudger`, `Pavlov`, etc.
- Filters basic vs advanced strategies
- Converts game history to Axelrod format
- Generates human-readable reasoning

### Tournament Runner

Round-robin tournaments:
- Each strategy plays every other strategy
- Configurable turns and repetitions
- Returns rankings with scores and cooperation rates

### Strategy Analyzer

Behavioral profiling:
- Tests strategy against key opponents (Cooperator, Defector, TitForTat)
- Calculates cooperation rates and average scores
- Provides strategy classification tags

## Nash Service

Nash equilibrium computation:

```python
class NashService:
    def __init__(self, calculator: Optional[EquilibriumCalculator] = None):
        self.calculator = calculator or NashpyCalculator()
```

### Features
- Find all Nash equilibria (pure and mixed)
- Check for dominant strategies
- Calculate expected payoffs for strategy profiles
- Support for symmetric and asymmetric games

## Reasoning Generation

Separate concern for strategy explanations:

```python
class ReasoningGenerator(ABC):
    def generate_reasoning(self, strategy_name, history, action) -> str

# Axelrod-specific implementation
class AxelrodReasoningGenerator(ReasoningGenerator):
    # Strategy-specific explanations
    # - TitForTat: "Copying opponent's last action"
    # - Grudger: "Retaliating forever after defection"
    # - Pavlov: "Switching based on outcome"
```

## Usage Examples

### Run a Tournament

```python
service = AxelrodService()

result = service.run_tournament(
    strategy_names=['TitForTat', 'Cooperator', 'Defector', 'Pavlov'],
    turns=200,
    repetitions=10
)

# Returns:
# {
#   "rankings": [
#     {"rank": 1, "strategy": "TitForTat", "score": 3.2, "cooperation_rate": 0.85},
#     ...
#   ],
#   "winner": "TitForTat",
#   "total_matches": 120
# }
```

### Analyze a Strategy

```python
result = service.analyze_strategy('TitForTat', turns=200)

# Returns behavior vs Cooperator, Defector, TitForTat
# Includes cooperation rates and scores
```

### Compute Nash Equilibrium

```python
nash_service = NashService()

result = nash_service.compute_equilibria([
    [3, 0],
    [5, 1]
])

# Returns equilibria, pure equilibria, uniqueness
```

### Play Single Action

```python
action, reasoning = service.play_action(
    strategy_name='TitForTat',
    history=[
        ActionHistory(round=1, my_action='C', opponent_action='D')
    ]
)

# Returns: ('D', 'TitForTat: Copying opponent's last action (D)')
```

## Adding Custom Strategies

### Option 1: Use Axelrod's Custom Strategies

```python
import axelrod as axl

class MyStrategy(axl.Player):
    def strategy(self, opponent):
        # Custom logic
        return axl.Action.C
```

### Option 2: Implement StrategyProvider

```python
class CustomStrategyProvider(StrategyProvider):
    def get_strategy(self, name):
        if name == "MyCustom":
            return MyCustomStrategy()
        return None
```

Then inject:
```python
service = AxelrodService(strategy_provider=CustomStrategyProvider())
```

## Testing

All components support dependency injection:

```python
# Mock provider
mock_provider = Mock(spec=StrategyProvider)
mock_provider.play_action.return_value = ('C', 'Always cooperate')

# Inject into service
service = AxelrodService(strategy_provider=mock_provider)
```

## Extending with New Backends

Want to use a different game theory library?

1. Implement the abstract interfaces
2. Inject into service
3. No changes to API layer needed!

Example: Gambit integration:
```python
class GambitCalculator(EquilibriumCalculator):
    def compute_equilibria(self, payoff_matrix):
        # Use Gambit library
        ...

nash_service = NashService(calculator=GambitCalculator())
```

## Performance Considerations

- **Tournaments**: Use `processes=1` for consistency (Axelrod library supports multiprocessing)
- **Strategy Analysis**: Caching recommended for repeated analyses
- **Nash Computation**: Support enumeration can be slow for large games (>5x5)

## Available Strategies

Basic strategies (filtered view):
- **Cooperator**: Always cooperate
- **Defector**: Always defect
- **TitForTat**: Copy opponent's last move
- **Grudger**: Cooperate until opponent defects, then always defect
- **Pavlov**: Repeat if both chose same, switch if different
- **Random**: Random C/D

Advanced (200+ total):
- Sophisticated strategies from Axelrod's tournaments
- Adaptive, memory-based, probabilistic strategies
- Meta-strategies and evolved strategies

See `/strategies` endpoint for full list.
