"""
Nash Equilibrium computation service using Nashpy
"""

import nashpy as nash
import numpy as np
from typing import List, Dict, Tuple


class NashService:
    """Service for computing Nash equilibria"""

    @staticmethod
    def compute_equilibria(payoff_matrix: List[List[float]]) -> Dict:
        """
        Compute Nash equilibria for a given payoff matrix

        Args:
            payoff_matrix: 2D list representing the payoff matrix

        Returns:
            Dictionary with equilibria information
        """
        # Convert to numpy array
        matrix = np.array(payoff_matrix)

        # Create game (assuming symmetric game for now)
        # For asymmetric games, we'd need both player's matrices
        game = nash.Game(matrix)

        # Compute equilibria using support enumeration
        equilibria = list(game.support_enumeration())

        # Check for pure strategy equilibria
        pure_equilibria = []
        rows, cols = matrix.shape

        for i in range(rows):
            for j in range(cols):
                # Check if (i, j) is a pure Nash equilibrium
                # Row player's best response
                if matrix[i, j] == max(matrix[:, j]):
                    # Column player's best response (symmetric game)
                    if matrix[i, j] == max(matrix[i, :]):
                        pure_equilibria.append({"row": i, "col": j})

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

    @staticmethod
    def is_dominant_strategy(
        payoff_matrix: List[List[float]],
        strategy_index: int,
        player: int = 0
    ) -> bool:
        """
        Check if a strategy is strictly dominant

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
            return np.all(strategy_payoffs >= other_payoffs)
        else:  # Column player (transpose for symmetric game)
            strategy_payoffs = matrix[:, strategy_index]
            other_payoffs = np.delete(matrix.T, strategy_index, axis=0)

            return np.all(strategy_payoffs >= other_payoffs.T)

    @staticmethod
    def compute_expected_payoff(
        payoff_matrix: List[List[float]],
        strategy_profile: Tuple[List[float], List[float]]
    ) -> float:
        """
        Compute expected payoff for a strategy profile

        Args:
            payoff_matrix: Payoff matrix
            strategy_profile: Tuple of (row_strategy, col_strategy) probabilities

        Returns:
            Expected payoff for row player
        """
        matrix = np.array(payoff_matrix)
        row_strategy = np.array(strategy_profile[0])
        col_strategy = np.array(strategy_profile[1])

        # Expected payoff = row_strategy^T * matrix * col_strategy
        return float(row_strategy @ matrix @ col_strategy)


# Singleton instance
nash_service = NashService()
