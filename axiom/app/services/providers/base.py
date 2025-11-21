"""
Abstract base class for LLM providers
Follows Strategy Pattern and Open/Closed Principle
"""

from abc import ABC, abstractmethod
from typing import List, Dict, Optional
from ...models.schemas import ActionHistory


class LLMProvider(ABC):
    """
    Abstract base class for LLM providers

    Implements Strategy Pattern - each provider encapsulates its own algorithm
    for generating actions based on game history.
    """

    @abstractmethod
    async def generate_action(
        self,
        model: str,
        history: List[ActionHistory],
        system_prompt: Optional[str],
        temperature: float
    ) -> Dict[str, str]:
        """
        Generate action using LLM

        Args:
            model: Model name specific to this provider
            history: Game history
            system_prompt: Custom system prompt (optional)
            temperature: Sampling temperature

        Returns:
            Dict with action, reasoning, model, and provider
        """
        pass

    @abstractmethod
    def get_models(self) -> List[str]:
        """
        Get list of available models for this provider

        Returns:
            List of model names
        """
        pass

    @abstractmethod
    def is_available(self) -> bool:
        """
        Check if provider is available (API key configured)

        Returns:
            True if provider can be used
        """
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Provider name identifier"""
        pass

    def get_default_system_prompt(self) -> str:
        """
        Default system prompt for prisoner's dilemma

        Returns:
            Default prompt text
        """
        return """You are an expert in game theory playing an iterated prisoner's dilemma.

The game:
- Each round, you choose: Cooperate (C) or Defect (D)
- Payoffs: Both cooperate = 3,3 | You cooperate, opponent defects = 0,5 | You defect, opponent cooperates = 5,0 | Both defect = 1,1
- This is iterated - you'll play multiple rounds with the same opponent

Your goal: Maximize your total score across all rounds.

Think strategically about:
- Building trust through cooperation
- Punishing defection
- Forgiving occasional defects
- Establishing patterns
- Adapting to opponent's strategy

Respond with:
1. ACTION: Either 'C' (cooperate) or 'D' (defect)
2. REASONING: Brief explanation of your strategic thinking"""

    def parse_llm_response(self, content: str) -> tuple[str, str]:
        """
        Parse LLM response to extract action and reasoning

        Expected format:
        ACTION: C
        REASONING: ...

        Args:
            content: LLM response text

        Returns:
            Tuple of (action, reasoning)
        """
        lines = content.strip().split('\n')
        action = None
        reasoning = []

        for line in lines:
            line = line.strip()
            if line.startswith('ACTION:'):
                action_text = line.replace('ACTION:', '').strip()
                # Extract C or D
                if 'C' in action_text.upper() and 'D' not in action_text.upper():
                    action = 'C'
                elif 'D' in action_text.upper():
                    action = 'D'
            elif line.startswith('REASONING:'):
                reasoning.append(line.replace('REASONING:', '').strip())
            elif line and action is not None:
                # Additional reasoning lines
                reasoning.append(line)

        # Fallback: search for C or D in content
        if action is None:
            content_upper = content.upper()
            if 'COOPERATE' in content_upper or (content_upper.count('C') > content_upper.count('D')):
                action = 'C'
            else:
                action = 'D'

        reasoning_text = ' '.join(reasoning) if reasoning else content[:200]

        return action, reasoning_text
