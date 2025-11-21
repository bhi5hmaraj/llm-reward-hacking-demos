"""
Axelrod strategy service
Provides access to 200+ IPD strategies and tournament functionality
"""

import axelrod as axl
from typing import List, Dict, Optional, Tuple
from ..models.schemas import ActionHistory


class AxelrodService:
    """Service for managing Axelrod strategies"""

    def __init__(self):
        """Initialize with all available strategies"""
        self.all_strategies = axl.all_strategies
        self.strategy_instances: Dict[str, axl.Player] = {}

    def list_strategies(self, filter_basic: bool = False) -> List[Dict[str, any]]:
        """
        List all available strategies

        Args:
            filter_basic: If True, only return well-known basic strategies

        Returns:
            List of strategy information
        """
        if filter_basic:
            basic_names = [
                "Cooperator", "Defector", "TitForTat", "TitForTwoTats",
                "Grudger", "Pavlov", "Random", "AlternatingCooperator",
                "AlternatingDefector", "SuspiciousTitForTat", "Joss",
                "GTFT", "HardMajority", "SoftMajority"
            ]
            strategies = [s for s in self.all_strategies if s.__name__ in basic_names]
        else:
            strategies = self.all_strategies

        return [
            {
                "name": strategy.__name__,
                "classifier": strategy.classifier if hasattr(strategy, 'classifier') else {},
                "docstring": strategy.__doc__ or "No description available"
            }
            for strategy in strategies
        ]

    def get_strategy(self, strategy_name: str) -> Optional[axl.Player]:
        """
        Get a strategy instance by name

        Args:
            strategy_name: Name of the strategy

        Returns:
            Strategy instance or None if not found
        """
        # Try to find strategy by name
        for strategy_class in self.all_strategies:
            if strategy_class.__name__.lower() == strategy_name.lower():
                return strategy_class()

        return None

    def play_action(
        self,
        strategy_name: str,
        history: List[ActionHistory],
        opponent_id: Optional[str] = None
    ) -> Tuple[str, str]:
        """
        Get action from a strategy given history

        Args:
            strategy_name: Name of strategy to use
            history: Game history
            opponent_id: Opponent identifier

        Returns:
            Tuple of (action, reasoning)
        """
        strategy = self.get_strategy(strategy_name)

        if not strategy:
            raise ValueError(f"Strategy '{strategy_name}' not found")

        # Convert history to Axelrod format
        if history:
            # Axelrod uses C and D actions
            my_actions = [axl.Action.C if h.my_action == "C" else axl.Action.D for h in history]
            opp_actions = [axl.Action.C if h.opponent_action == "C" else axl.Action.D for h in history]

            # Set history on strategy
            strategy.history = my_actions
            opponent = axl.Player()
            opponent.history = opp_actions

            # Get next action
            action = strategy.strategy(opponent)
        else:
            # First move
            action = strategy.strategy(axl.Player())

        action_str = "C" if action == axl.Action.C else "D"

        # Generate reasoning based on strategy type
        reasoning = self._generate_reasoning(strategy, history, action_str)

        return action_str, reasoning

    def _generate_reasoning(
        self,
        strategy: axl.Player,
        history: List[ActionHistory],
        action: str
    ) -> str:
        """Generate human-readable reasoning for action"""

        strategy_name = strategy.__class__.__name__

        if not history:
            return f"{strategy_name}: First move, following initial strategy"

        last_opp_action = history[-1].opponent_action

        # Strategy-specific reasoning
        if strategy_name == "TitForTat":
            return f"TitForTat: Copying opponent's last action ({last_opp_action})"
        elif strategy_name == "Cooperator":
            return "Cooperator: Always cooperate"
        elif strategy_name == "Defector":
            return "Defector: Always defect"
        elif strategy_name == "Grudger":
            has_defected = any(h.opponent_action == "D" for h in history)
            if has_defected:
                return "Grudger: Opponent defected before, retaliating forever"
            return "Grudger: Cooperating while opponent cooperates"
        elif strategy_name == "Pavlov":
            last_my_action = history[-1].my_action
            if (last_my_action == last_opp_action):
                return "Pavlov: Both took same action last round, repeating my action"
            else:
                return "Pavlov: Actions differed last round, switching"
        else:
            return f"{strategy_name}: Following strategy logic based on history"

    def run_tournament(
        self,
        strategy_names: List[str],
        turns: int = 200,
        repetitions: int = 10
    ) -> Dict:
        """
        Run a tournament between strategies

        Args:
            strategy_names: List of strategy names
            turns: Number of turns per match
            repetitions: Number of times to repeat each match

        Returns:
            Tournament results
        """
        # Create strategy instances
        players = []
        for name in strategy_names:
            strategy = self.get_strategy(name)
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

        results = tournament.play(processes=1)  # Single process for consistency

        # Extract rankings
        rankings = []
        for i, score in enumerate(results.ranked_names):
            strategy_name = score
            mean_score = results.scores[i]
            cooperation = results.cooperation_rates[i]

            rankings.append({
                "rank": i + 1,
                "strategy": strategy_name,
                "score": float(mean_score),
                "cooperation_rate": float(cooperation)
            })

        return {
            "rankings": rankings,
            "total_matches": len(players) * (len(players) - 1) * repetitions,
            "winner": rankings[0]["strategy"],
            "cooperation_rates": {
                r["strategy"]: r["cooperation_rate"]
                for r in rankings
            }
        }

    def analyze_strategy(
        self,
        strategy_name: str,
        turns: int = 200
    ) -> Dict:
        """
        Analyze a strategy's behavior

        Args:
            strategy_name: Name of strategy to analyze
            turns: Number of turns for test matches

        Returns:
            Analysis results
        """
        strategy = self.get_strategy(strategy_name)
        if not strategy:
            raise ValueError(f"Strategy '{strategy_name}' not found")

        # Test against key strategies
        cooperator = axl.Cooperator()
        defector = axl.Defector()
        tit_for_tat = axl.TitForTat()

        # Run matches
        vs_coop = axl.Match([strategy(), cooperator], turns=turns).play()
        vs_def = axl.Match([strategy(), defector], turns=turns).play()
        vs_tft = axl.Match([strategy(), tit_for_tat], turns=turns).play()

        # Calculate metrics
        coop_score = sum(vs_coop[0])
        def_score = sum(vs_def[0])
        tft_score = sum(vs_tft[0])

        # Cooperation rates
        coop_rate_vs_coop = sum(1 for action in vs_coop[0] if action == axl.Action.C) / turns
        coop_rate_vs_def = sum(1 for action in vs_def[0] if action == axl.Action.C) / turns
        coop_rate_vs_tft = sum(1 for action in vs_tft[0] if action == axl.Action.C) / turns

        overall_coop_rate = (coop_rate_vs_coop + coop_rate_vs_def + coop_rate_vs_tft) / 3

        return {
            "strategy_name": strategy_name,
            "cooperation_rate": overall_coop_rate,
            "average_score": (coop_score + def_score + tft_score) / 3,
            "vs_cooperator": {
                "score": coop_score,
                "cooperation_rate": coop_rate_vs_coop
            },
            "vs_defector": {
                "score": def_score,
                "cooperation_rate": coop_rate_vs_def
            },
            "vs_tit_for_tat": {
                "score": tft_score,
                "cooperation_rate": coop_rate_vs_tft
            },
            "classifier": strategy.classifier if hasattr(strategy, 'classifier') else {}
        }


# Singleton instance
axelrod_service = AxelrodService()
