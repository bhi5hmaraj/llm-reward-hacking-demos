"""
Abstract base classes for game theory services
Follows SOLID principles
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Tuple, Optional
from ...models.schemas import ActionHistory


class EquilibriumCalculator(ABC):
    """
    Abstract base class for Nash equilibrium computation

    Single Responsibility: Compute equilibria
    Interface Segregation: Only equilibrium methods
    """

    @abstractmethod
    def compute_equilibria(self, payoff_matrix: List[List[float]]) -> Dict:
        """
        Compute Nash equilibria for a payoff matrix

        Args:
            payoff_matrix: 2D payoff matrix

        Returns:
            Dictionary with equilibria information
        """
        pass

    @abstractmethod
    def is_dominant_strategy(
        self,
        payoff_matrix: List[List[float]],
        strategy_index: int,
        player: int = 0
    ) -> bool:
        """Check if a strategy is strictly dominant"""
        pass

    @abstractmethod
    def compute_expected_payoff(
        self,
        payoff_matrix: List[List[float]],
        strategy_profile: Tuple[List[float], List[float]]
    ) -> float:
        """Compute expected payoff for a strategy profile"""
        pass


class StrategyProvider(ABC):
    """
    Abstract base class for strategy management

    Single Responsibility: Provide access to strategies
    """

    @abstractmethod
    def list_strategies(self, filter_basic: bool = False) -> List[Dict]:
        """
        List available strategies

        Args:
            filter_basic: If True, return only basic strategies

        Returns:
            List of strategy information dicts
        """
        pass

    @abstractmethod
    def get_strategy(self, strategy_name: str):
        """
        Get strategy instance by name

        Args:
            strategy_name: Name of the strategy

        Returns:
            Strategy instance or None if not found
        """
        pass

    @abstractmethod
    def play_action(
        self,
        strategy_name: str,
        history: List[ActionHistory],
        opponent_id: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Get action from strategy given history

        Args:
            strategy_name: Strategy to use
            history: Game history
            opponent_id: Opponent identifier

        Returns:
            Tuple of (action, reasoning)
        """
        pass


class TournamentRunner(ABC):
    """
    Abstract base class for tournament execution

    Single Responsibility: Run tournaments between strategies
    """

    @abstractmethod
    def run_tournament(
        self,
        strategy_names: List[str],
        turns: int = 200,
        repetitions: int = 10
    ) -> Dict:
        """
        Run tournament between strategies

        Args:
            strategy_names: List of strategy names
            turns: Number of turns per match
            repetitions: Repetitions per match

        Returns:
            Tournament results dict
        """
        pass


class StrategyAnalyzer(ABC):
    """
    Abstract base class for strategy analysis

    Single Responsibility: Analyze strategy behavior
    """

    @abstractmethod
    def analyze_strategy(
        self,
        strategy_name: str,
        turns: int = 200
    ) -> Dict:
        """
        Analyze strategy behavior

        Args:
            strategy_name: Strategy to analyze
            turns: Number of turns for test matches

        Returns:
            Analysis results dict
        """
        pass


class ReasoningGenerator(ABC):
    """
    Abstract base class for generating strategy reasoning

    Single Responsibility: Generate human-readable strategy explanations
    """

    @abstractmethod
    def generate_reasoning(
        self,
        strategy_name: str,
        history: List[ActionHistory],
        action: str
    ) -> str:
        """
        Generate reasoning for a strategy's action

        Args:
            strategy_name: Name of the strategy
            history: Game history
            action: Action taken

        Returns:
            Human-readable reasoning string
        """
        pass
