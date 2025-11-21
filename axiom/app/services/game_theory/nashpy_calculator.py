"""
Concrete Nash equilibrium calculator using Nashpy

Follows SOLID principles:
- Single Responsibility: Nash equilibrium computation only
- Open/Closed: Can be extended without modification
- Liskov Substitution: Substitutable for any EquilibriumCalculator
- Dependency Inversion: Depends on abstract base class
"""

import nashpy as nash
import numpy as np
from typing import List, Dict, Tuple
from .base import EquilibriumCalculator


class NashpyCalculator(EquilibriumCalculator):
    """
    Nash equilibrium calculator using Nashpy library

    Implements equilibrium computation using support enumeration algorithm.
    """

    def compute_equilibria(self, payoff_matrix: List[List[float]]) -> Dict:
        """
        Compute Nash equilibria for a given payoff matrix

        Uses support enumeration to find all Nash equilibria.

        Args:
            payoff_matrix: 2D list representing the payoff matrix

        Returns:
            Dictionary with:
            - equilibria: List of equilibrium strategy profiles
            - is_unique: Whether the equilibrium is unique
            - pure_equilibria: List of pure strategy equilibria
            - num_equilibria: Total number of equilibria found
        """
        # Convert to numpy array
        matrix = np.array(payoff_matrix)

        # Create game (assuming symmetric game)
        game = nash.Game(matrix)

        # Compute equilibria using support enumeration
        equilibria = list(game.support_enumeration())

        # Find pure strategy equilibria
        pure_equilibria = self._find_pure_equilibria(matrix)

        return {
            "equilibria": [
                {
                    "player1_strategy": eq[0].tolist(),
                    "player2_strategy": eq[1].tolist() if len(eq) > 1 else eq[0].tolist()
                }
                for eq in equilibria
            ],
            "is_unique": len(equilibria) == 1,
            "pure_equilibria": pure_equilibria,
            "num_equilibria": len(equilibria)
        }

    def _find_pure_equilibria(self, matrix: np.ndarray) -> List[Dict]:
        """
        Find pure strategy Nash equilibria

        A pure strategy profile is a Nash equilibrium if each player's
        strategy is a best response to the other player's strategy.

        Args:
            matrix: Payoff matrix as numpy array

        Returns:
            List of pure equilibria as {"row": i, "col": j}
        """
        pure_equilibria = []
        rows, cols = matrix.shape

        for i in range(rows):
            for j in range(cols):
                # Check if (i, j) is a pure Nash equilibrium
                # Row player's best response: is i best given column j?
                if matrix[i, j] == max(matrix[:, j]):
                    # Column player's best response: is j best given row i?
                    if matrix[i, j] == max(matrix[i, :]):
                        pure_equilibria.append({"row": i, "col": j})

        return pure_equilibria

    def is_dominant_strategy(
        self,
        payoff_matrix: List[List[float]],
        strategy_index: int,
        player: int = 0
    ) -> bool:
        """
        Check if a strategy is strictly dominant

        A strategy is strictly dominant if it yields a higher payoff
        than any other strategy, regardless of what the other player does.

        Args:
            payoff_matrix: Payoff matrix
            strategy_index: Index of strategy to check
            player: Player index (0 for row player, 1 for column player)

        Returns:
            True if strategy is strictly dominant
        """
        matrix = np.array(payoff_matrix)

        if player == 0:  # Row player
            strategy_payoffs = matrix[strategy_index, :]
            other_payoffs = np.delete(matrix, strategy_index, axis=0)

            # Check if this strategy dominates all others
            # (strictly better against every opponent strategy)
            return np.all(strategy_payoffs >= other_payoffs)
        else:  # Column player
            strategy_payoffs = matrix[:, strategy_index]
            other_payoffs = np.delete(matrix.T, strategy_index, axis=0)

            return np.all(strategy_payoffs >= other_payoffs.T)

    def compute_expected_payoff(
        self,
        payoff_matrix: List[List[float]],
        strategy_profile: Tuple[List[float], List[float]]
    ) -> float:
        """
        Compute expected payoff for a mixed strategy profile

        Expected payoff = row_strategy^T * matrix * col_strategy

        Args:
            payoff_matrix: Payoff matrix
            strategy_profile: Tuple of (row_strategy, col_strategy) probabilities

        Returns:
            Expected payoff for row player
        """
        matrix = np.array(payoff_matrix)
        row_strategy = np.array(strategy_profile[0])
        col_strategy = np.array(strategy_profile[1])

        # Matrix multiplication: row^T * M * col
        return float(row_strategy @ matrix @ col_strategy)
