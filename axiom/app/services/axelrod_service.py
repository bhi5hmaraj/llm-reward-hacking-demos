"""
Axelrod strategy service

Refactored to follow SOLID principles with dependency injection.
Uses AxelrodStrategyProvider, AxelrodTournamentRunner, and AxelrodStrategyAnalyzer.
"""

from typing import List, Dict, Optional, Tuple
from ..models.schemas import ActionHistory
from .game_theory import (
    StrategyProvider,
    TournamentRunner,
    StrategyAnalyzer,
    AxelrodStrategyProvider,
    AxelrodTournamentRunner,
    AxelrodStrategyAnalyzer
)


class AxelrodService:
    """
    Service for managing Axelrod strategies

    Single Responsibility: Orchestrates strategy operations
    Dependency Inversion: Depends on abstractions (StrategyProvider, etc.)
    Open/Closed: New implementations can be injected without modifying this class
    """

    def __init__(
        self,
        strategy_provider: Optional[StrategyProvider] = None,
        tournament_runner: Optional[TournamentRunner] = None,
        strategy_analyzer: Optional[StrategyAnalyzer] = None
    ):
        """
        Initialize service with dependencies

        Args:
            strategy_provider: Provider for strategy management
                              (defaults to AxelrodStrategyProvider)
            tournament_runner: Runner for tournaments
                              (defaults to AxelrodTournamentRunner)
            strategy_analyzer: Analyzer for strategy behavior
                              (defaults to AxelrodStrategyAnalyzer)
        """
        # Create default Axelrod provider if not provided
        self.strategy_provider = strategy_provider or AxelrodStrategyProvider()

        # Create default tournament runner with the provider
        self.tournament_runner = tournament_runner or AxelrodTournamentRunner(
            self.strategy_provider
        )

        # Create default analyzer with the provider
        self.strategy_analyzer = strategy_analyzer or AxelrodStrategyAnalyzer(
            self.strategy_provider
        )

    def list_strategies(self, filter_basic: bool = False) -> List[Dict]:
        """
        List all available strategies

        Delegates to strategy provider.

        Args:
            filter_basic: If True, only return well-known basic strategies

        Returns:
            List of strategy information
        """
        return self.strategy_provider.list_strategies(filter_basic)

    def get_strategy(self, strategy_name: str):
        """
        Get a strategy instance by name

        Delegates to strategy provider.

        Args:
            strategy_name: Name of the strategy

        Returns:
            Strategy instance or None if not found
        """
        return self.strategy_provider.get_strategy(strategy_name)

    def play_action(
        self,
        strategy_name: str,
        history: List[ActionHistory],
        opponent_id: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Get action from a strategy given history

        Delegates to strategy provider.

        Args:
            strategy_name: Name of strategy to use
            history: Game history
            opponent_id: Opponent identifier

        Returns:
            Tuple of (action, reasoning)

        Raises:
            ValueError: If strategy not found
        """
        return self.strategy_provider.play_action(
            strategy_name,
            history,
            opponent_id
        )

    def run_tournament(
        self,
        strategy_names: List[str],
        turns: int = 200,
        repetitions: int = 10
    ) -> Dict:
        """
        Run a tournament between strategies

        Delegates to tournament runner.

        Args:
            strategy_names: List of strategy names
            turns: Number of turns per match
            repetitions: Number of times to repeat each match

        Returns:
            Tournament results

        Raises:
            ValueError: If any strategy not found
        """
        return self.tournament_runner.run_tournament(
            strategy_names,
            turns,
            repetitions
        )

    def analyze_strategy(
        self,
        strategy_name: str,
        turns: int = 200
    ) -> Dict:
        """
        Analyze a strategy's behavior

        Delegates to strategy analyzer.

        Args:
            strategy_name: Name of strategy to analyze
            turns: Number of turns for test matches

        Returns:
            Analysis results

        Raises:
            ValueError: If strategy not found
        """
        return self.strategy_analyzer.analyze_strategy(
            strategy_name,
            turns
        )


# Singleton instance with default dependencies
axelrod_service = AxelrodService()
