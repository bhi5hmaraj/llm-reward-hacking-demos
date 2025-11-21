"""
Anthropic LLM Provider
Implements Strategy Pattern for Claude models
"""

import os
from typing import List, Dict, Optional
from .base import LLMProvider
from ...models.schemas import ActionHistory

# Optional import - only load if available
try:
    from anthropic import Anthropic
    ANTHROPIC_INSTALLED = True
except ImportError:
    ANTHROPIC_INSTALLED = False


class AnthropicProvider(LLMProvider):
    """
    Anthropic provider for Claude models

    Single Responsibility: Handles only Anthropic API interactions
    Open/Closed: Can be extended without modifying other providers
    Liskov Substitution: Can be substituted for any LLMProvider
    """

    def __init__(self):
        """Initialize Anthropic client"""
        if self.is_available():
            self.client = Anthropic(api_key=os.getenv('ANTHROPIC_API_KEY'))
        else:
            self.client = None

    @property
    def provider_name(self) -> str:
        """Provider identifier"""
        return "anthropic"

    def is_available(self) -> bool:
        """
        Check if Anthropic is available

        Returns:
            True if anthropic package is installed and API key is configured
        """
        return ANTHROPIC_INSTALLED and bool(os.getenv('ANTHROPIC_API_KEY'))

    def get_models(self) -> List[str]:
        """
        Get available Anthropic models

        Returns:
            List of Claude model names
        """
        return ['claude-3-5-sonnet-20241022', 'claude-3-opus-20240229']

    async def generate_action(
        self,
        model: str,
        history: List[ActionHistory],
        system_prompt: Optional[str],
        temperature: float
    ) -> Dict[str, str]:
        """
        Generate action using Anthropic API

        Args:
            model: Claude model name
            history: Game history
            system_prompt: Custom system prompt (optional)
            temperature: Sampling temperature

        Returns:
            Dict with action, reasoning, model, and provider

        Raises:
            ValueError: If provider is not available
        """
        if not self.is_available():
            raise ValueError("Anthropic provider not available. Check API key and installation.")

        # Build prompt
        if not history:
            prompt = "This is round 1. What action do you choose? Respond with ACTION: (C or D) and REASONING:"
        else:
            prompt = "Game history:\n"
            for h in history:
                prompt += f"Round {h.round}: You played {h.my_action}, Opponent played {h.opponent_action}\n"
            prompt += f"\nRound {len(history) + 1}: What action do you choose? Respond with ACTION: (C or D) and REASONING:"

        # Call Anthropic API
        message = self.client.messages.create(
            model=model,
            max_tokens=300,
            temperature=temperature,
            system=system_prompt or self.get_default_system_prompt(),
            messages=[
                {"role": "user", "content": prompt}
            ]
        )

        content = message.content[0].text

        # Parse response
        action, reasoning = self.parse_llm_response(content)

        return {
            "action": action,
            "reasoning": reasoning,
            "model": model,
            "provider": self.provider_name
        }
