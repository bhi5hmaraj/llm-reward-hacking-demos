"""
Game theory services package

Follows SOLID principles:
- Single Responsibility: Each class has one clear purpose
- Open/Closed: New implementations can be added without modifying existing code
- Liskov Substitution: All concrete classes can substitute their abstractions
- Interface Segregation: Clean, focused interfaces
- Dependency Inversion: Services depend on abstractions, not concretions

Architecture:
- base.py: Abstract base classes defining interfaces
- nashpy_calculator.py: Nash equilibrium computation
- axelrod_provider.py: Strategy management
- axelrod_tournament.py: Tournament execution
- axelrod_analyzer.py: Strategy analysis
"""

from .base import (
    EquilibriumCalculator,
    StrategyProvider,
    TournamentRunner,
    StrategyAnalyzer,
    ReasoningGenerator
)

from .nashpy_calculator import NashpyCalculator

from .axelrod_provider import (
    AxelrodStrategyProvider,
    AxelrodReasoningGenerator
)

from .axelrod_tournament import AxelrodTournamentRunner
from .axelrod_analyzer import AxelrodStrategyAnalyzer

__all__ = [
    # Abstract interfaces
    'EquilibriumCalculator',
    'StrategyProvider',
    'TournamentRunner',
    'StrategyAnalyzer',
    'ReasoningGenerator',
    # Concrete implementations
    'NashpyCalculator',
    'AxelrodStrategyProvider',
    'AxelrodReasoningGenerator',
    'AxelrodTournamentRunner',
    'AxelrodStrategyAnalyzer',
]
