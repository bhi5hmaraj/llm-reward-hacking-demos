"""
Axelrod strategy provider

Follows SOLID principles:
- Single Responsibility: Manages access to Axelrod strategies
- Open/Closed: Can be extended with custom strategies
- Liskov Substitution: Substitutable for any StrategyProvider
"""

import axelrod as axl
from typing import List, Dict, Optional, Tuple
from .base import StrategyProvider, ReasoningGenerator
from ...models.schemas import ActionHistory


class AxelrodReasoningGenerator(ReasoningGenerator):
    """
    Generates human-readable reasoning for Axelrod strategies

    Single Responsibility: Strategy explanation generation
    """

    def generate_reasoning(
        self,
        strategy_name: str,
        history: List[ActionHistory],
        action: str
    ) -> str:
        """
        Generate reasoning for a strategy's action

        Provides context-aware explanations based on strategy type
        and game history.

        Args:
            strategy_name: Name of the strategy
            history: Game history
            action: Action taken

        Returns:
            Human-readable reasoning string
        """
        if not history:
            return f"{strategy_name}: First move, following initial strategy"

        last_opp_action = history[-1].opponent_action

        # Strategy-specific reasoning
        reasoning_map = {
            "TitForTat": lambda: f"TitForTat: Copying opponent's last action ({last_opp_action})",
            "Cooperator": lambda: "Cooperator: Always cooperate",
            "Defector": lambda: "Defector: Always defect",
            "Grudger": lambda: self._grudger_reasoning(history),
            "WinStayLoseShift": lambda: self._pavlov_reasoning(history),
        }

        return reasoning_map.get(
            strategy_name,
            lambda: f"{strategy_name}: Following strategy logic based on history"
        )()

    def _grudger_reasoning(self, history: List[ActionHistory]) -> str:
        """Generate reasoning for Grudger strategy"""
        has_defected = any(h.opponent_action == "D" for h in history)
        if has_defected:
            return "Grudger: Opponent defected before, retaliating forever"
        return "Grudger: Cooperating while opponent cooperates"

    def _pavlov_reasoning(self, history: List[ActionHistory]) -> str:
        """Generate reasoning for Pavlov strategy"""
        last_my_action = history[-1].my_action
        last_opp_action = history[-1].opponent_action

        if last_my_action == last_opp_action:
            return "Pavlov: Both took same action last round, repeating my action"
        else:
            return "Pavlov: Actions differed last round, switching"


class AxelrodStrategyProvider(StrategyProvider):
    """
    Provides access to Axelrod library strategies

    Manages 200+ IPD strategies from the Axelrod library.
    """

    # Strategy name aliases for backwards compatibility
    STRATEGY_ALIASES = {
        "Pavlov": "WinStayLoseShift",
        "pavlov": "WinStayLoseShift",
    }

    def __init__(self, reasoning_generator: Optional[ReasoningGenerator] = None):
        """
        Initialize provider

        Args:
            reasoning_generator: Optional custom reasoning generator
                                (defaults to AxelrodReasoningGenerator)
        """
        self.all_strategies = axl.all_strategies
        self.reasoning_generator = reasoning_generator or AxelrodReasoningGenerator()

    def list_strategies(self, filter_basic: bool = False) -> List[Dict]:
        """
        List all available strategies

        Args:
            filter_basic: If True, only return well-known basic strategies

        Returns:
            List of strategy information dictionaries
        """
        if filter_basic:
            basic_names = [
                "Cooperator", "Defector", "TitForTat", "TitForTwoTats",
                "Grudger", "WinStayLoseShift", "Random", "AlternatingCooperator",
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
            strategy_name: Name of the strategy (case-insensitive)

        Returns:
            Strategy instance or None if not found
        """
        # Check if this is an alias and resolve it
        resolved_name = self.STRATEGY_ALIASES.get(strategy_name, strategy_name)

        for strategy_class in self.all_strategies:
            if strategy_class.__name__.lower() == resolved_name.lower():
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
            opponent_id: Opponent identifier (unused, for interface compatibility)

        Returns:
            Tuple of (action, reasoning)

        Raises:
            ValueError: If strategy not found
        """
        strategy = self.get_strategy(strategy_name)

        if not strategy:
            raise ValueError(f"Strategy '{strategy_name}' not found")

        # Convert history to Axelrod format
        if history:
            my_actions = [
                axl.Action.C if h.my_action == "C" else axl.Action.D
                for h in history
            ]
            opp_actions = [
                axl.Action.C if h.opponent_action == "C" else axl.Action.D
                for h in history
            ]

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

        # Generate reasoning
        reasoning = self.reasoning_generator.generate_reasoning(
            strategy.__class__.__name__,
            history,
            action_str
        )

        return action_str, reasoning
