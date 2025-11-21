"""
Nash Equilibrium computation service

Refactored to follow SOLID principles with dependency injection.
Uses NashpyCalculator for actual computation.
"""

from typing import List, Dict, Tuple, Optional
from .game_theory import EquilibriumCalculator, NashpyCalculator


class NashService:
    """
    Service for computing Nash equilibria

    Single Responsibility: Orchestrates equilibrium computation
    Dependency Inversion: Depends on EquilibriumCalculator abstraction
    """

    def __init__(self, calculator: Optional[EquilibriumCalculator] = None):
        """
        Initialize service with equilibrium calculator

        Args:
            calculator: EquilibriumCalculator implementation
                       (defaults to NashpyCalculator if not provided)
        """
        self.calculator = calculator or NashpyCalculator()

    def compute_equilibria(self, payoff_matrix: List[List[float]]) -> Dict:
        """
        Compute Nash equilibria for a given payoff matrix

        Delegates to the calculator implementation.

        Args:
            payoff_matrix: 2D list representing the payoff matrix

        Returns:
            Dictionary with equilibria information
        """
        return self.calculator.compute_equilibria(payoff_matrix)

    def is_dominant_strategy(
        self,
        payoff_matrix: List[List[float]],
        strategy_index: int,
        player: int = 0
    ) -> bool:
        """
        Check if a strategy is strictly dominant

        Delegates to the calculator implementation.

        Args:
            payoff_matrix: Payoff matrix
            strategy_index: Index of strategy to check
            player: Player index (0 for row player, 1 for column player)

        Returns:
            True if strategy is strictly dominant
        """
        return self.calculator.is_dominant_strategy(
            payoff_matrix,
            strategy_index,
            player
        )

    def compute_expected_payoff(
        self,
        payoff_matrix: List[List[float]],
        strategy_profile: Tuple[List[float], List[float]]
    ) -> float:
        """
        Compute expected payoff for a strategy profile

        Delegates to the calculator implementation.

        Args:
            payoff_matrix: Payoff matrix
            strategy_profile: Tuple of (row_strategy, col_strategy) probabilities

        Returns:
            Expected payoff for row player
        """
        return self.calculator.compute_expected_payoff(
            payoff_matrix,
            strategy_profile
        )


# Singleton instance with default calculator
nash_service = NashService()
