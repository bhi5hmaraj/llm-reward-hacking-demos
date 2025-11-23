"""
Axelrod strategy analyzer

Follows SOLID principles:
- Single Responsibility: Strategy behavior analysis only
- Open/Closed: Can be extended with new analysis metrics
- Dependency Inversion: Depends on StrategyProvider abstraction
"""

import axelrod as axl
from typing import Dict
from .base import StrategyAnalyzer, StrategyProvider


class AxelrodStrategyAnalyzer(StrategyAnalyzer):
    """
    Analyzes strategy behavior through test matches

    Tests strategies against key opponents (Cooperator, Defector, TitForTat)
    to characterize their behavior patterns.
    """

    def __init__(self, strategy_provider: StrategyProvider):
        """
        Initialize analyzer

        Args:
            strategy_provider: Provider for strategy instances
        """
        self.strategy_provider = strategy_provider

    def analyze_strategy(
        self,
        strategy_name: str,
        turns: int = 200
    ) -> Dict:
        """
        Analyze a strategy's behavior

        Runs the strategy against three key opponents:
        - Cooperator (always cooperates)
        - Defector (always defects)
        - TitForTat (reciprocal strategy)

        Args:
            strategy_name: Name of strategy to analyze
            turns: Number of turns for test matches

        Returns:
            Dictionary with:
            - strategy_name: Name of analyzed strategy
            - cooperation_rate: Overall cooperation rate
            - average_score: Average score across matches
            - vs_cooperator: Match results against Cooperator
            - vs_defector: Match results against Defector
            - vs_tit_for_tat: Match results against TitForTat
            - classifier: Strategy classification tags

        Raises:
            ValueError: If strategy not found
        """
        strategy = self.strategy_provider.get_strategy(strategy_name)
        if not strategy:
            raise ValueError(f"Strategy '{strategy_name}' not found")

        # Create test opponents
        opponents = {
            "cooperator": axl.Cooperator(),
            "defector": axl.Defector(),
            "tit_for_tat": axl.TitForTat()
        }

        # Run matches against each opponent
        results = {}
        for opp_name, opponent in opponents.items():
            # Create fresh strategy instance for each match
            fresh_strategy = self.strategy_provider.get_strategy(strategy_name)
            match = axl.Match([fresh_strategy, opponent], turns=turns)
            match_results = match.play()

            # Calculate metrics
            # match.final_score() returns tuple of (score_p1, score_p2)
            # or we can use match.final_score_per_turn() for normalized scores
            final_scores = match.final_score()
            score = final_scores[0] if isinstance(final_scores, tuple) else final_scores

            coop_rate = sum(
                1 for action in match_results[0]
                if action == axl.Action.C
            ) / turns

            results[opp_name] = {
                "score": float(score),
                "cooperation_rate": float(coop_rate)
            }

        # Calculate overall metrics
        overall_coop_rate = sum(
            r["cooperation_rate"] for r in results.values()
        ) / len(results)

        average_score = sum(
            r["score"] for r in results.values()
        ) / len(results)

        return {
            "strategy_name": strategy_name,
            "cooperation_rate": overall_coop_rate,
            "average_score": average_score,
            "vs_cooperator": results["cooperator"],
            "vs_defector": results["defector"],
            "vs_tit_for_tat": results["tit_for_tat"],
            "classifier": strategy.classifier if hasattr(strategy, 'classifier') else {}
        }
