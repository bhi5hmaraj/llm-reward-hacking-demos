"""
Axelrod tournament runner

Follows SOLID principles:
- Single Responsibility: Tournament execution only
- Open/Closed: Can be extended with custom tournament types
- Dependency Inversion: Depends on StrategyProvider abstraction
"""

import axelrod as axl
from typing import List, Dict
from .base import TournamentRunner, StrategyProvider


class AxelrodTournamentRunner(TournamentRunner):
    """
    Runs tournaments using Axelrod library

    Uses round-robin tournament format where each strategy
    plays against every other strategy multiple times.
    """

    def __init__(self, strategy_provider: StrategyProvider):
        """
        Initialize tournament runner

        Args:
            strategy_provider: Provider for strategy instances
        """
        self.strategy_provider = strategy_provider

    def run_tournament(
        self,
        strategy_names: List[str],
        turns: int = 200,
        repetitions: int = 10
    ) -> Dict:
        """
        Run a round-robin tournament between strategies

        Each strategy plays against every other strategy for the
        specified number of turns, repeated multiple times.

        Args:
            strategy_names: List of strategy names to compete
            turns: Number of turns per match
            repetitions: Number of times to repeat each match

        Returns:
            Dictionary with:
            - rankings: List of ranked strategies with scores
            - total_matches: Total number of matches played
            - winner: Name of winning strategy
            - cooperation_rates: Cooperation rate for each strategy

        Raises:
            ValueError: If any strategy is not found
        """
        # Create strategy instances
        players = []
        for name in strategy_names:
            strategy = self.strategy_provider.get_strategy(name)
            if strategy:
                players.append(strategy)
            else:
                raise ValueError(f"Strategy '{name}' not found")

        # Run tournament
        tournament = axl.Tournament(
            players,
            turns=turns,
            repetitions=repetitions
        )

        # Execute tournament with single process for consistency
        results = tournament.play(processes=1)

        # Extract and format rankings
        rankings = self._format_rankings(results)

        return {
            "rankings": rankings,
            "total_matches": len(players) * (len(players) - 1) * repetitions,
            "winner": rankings[0]["strategy"],
            "cooperation_rates": {
                r["strategy"]: r["cooperation_rate"]
                for r in rankings
            }
        }

    def _format_rankings(self, results) -> List[Dict]:
        """
        Format tournament results into rankings

        Args:
            results: Axelrod tournament results object

        Returns:
            List of ranking dictionaries
        """
        rankings = []

        for i, strategy_name in enumerate(results.ranked_names):
            mean_score = results.scores[i]
            cooperation = results.cooperation_rates[i]

            rankings.append({
                "rank": i + 1,
                "strategy": strategy_name,
                "score": float(mean_score),
                "cooperation_rate": float(cooperation)
            })

        return rankings
