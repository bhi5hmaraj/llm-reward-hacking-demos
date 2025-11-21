"""
OpenAI LLM Provider
Implements Strategy Pattern for OpenAI models (GPT-4, GPT-3.5)
"""

import os
from typing import List, Dict, Optional
from .base import LLMProvider
from ...models.schemas import ActionHistory

# Optional import - only load if available
try:
    import openai
    OPENAI_INSTALLED = True
except ImportError:
    OPENAI_INSTALLED = False


class OpenAIProvider(LLMProvider):
    """
    OpenAI provider for GPT models

    Single Responsibility: Handles only OpenAI API interactions
    Open/Closed: Can be extended without modifying other providers
    Liskov Substitution: Can be substituted for any LLMProvider
    """

    def __init__(self):
        """Initialize OpenAI client"""
        if self.is_available():
            openai.api_key = os.getenv('OPENAI_API_KEY')

    @property
    def provider_name(self) -> str:
        """Provider identifier"""
        return "openai"

    def is_available(self) -> bool:
        """
        Check if OpenAI is available

        Returns:
            True if openai package is installed and API key is configured
        """
        return OPENAI_INSTALLED and bool(os.getenv('OPENAI_API_KEY'))

    def get_models(self) -> List[str]:
        """
        Get available OpenAI models

        Returns:
            List of GPT model names
        """
        return ['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']

    async def generate_action(
        self,
        model: str,
        history: List[ActionHistory],
        system_prompt: Optional[str],
        temperature: float
    ) -> Dict[str, str]:
        """
        Generate action using OpenAI API

        Args:
            model: OpenAI model name (e.g., gpt-4)
            history: Game history
            system_prompt: Custom system prompt (optional)
            temperature: Sampling temperature

        Returns:
            Dict with action, reasoning, model, and provider

        Raises:
            ValueError: If provider is not available
        """
        if not self.is_available():
            raise ValueError("OpenAI provider not available. Check API key and installation.")

        # Build conversation history
        messages = [
            {"role": "system", "content": system_prompt or self.get_default_system_prompt()}
        ]

        # Format game history
        if not history:
            messages.append({
                "role": "user",
                "content": "This is round 1. What action do you choose? Respond with ACTION: (C or D) and REASONING:"
            })
        else:
            history_text = "Game history:\n"
            for h in history:
                history_text += f"Round {h.round}: You played {h.my_action}, Opponent played {h.opponent_action}\n"

            history_text += f"\nRound {len(history) + 1}: What action do you choose? Respond with ACTION: (C or D) and REASONING:"

            messages.append({"role": "user", "content": history_text})

        # Call OpenAI API
        response = openai.chat.completions.create(
            model=model,
            messages=messages,
            temperature=temperature,
            max_tokens=300
        )

        content = response.choices[0].message.content

        # Parse response
        action, reasoning = self.parse_llm_response(content)

        return {
            "action": action,
            "reasoning": reasoning,
            "model": model,
            "provider": self.provider_name
        }
