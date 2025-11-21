"""
LLM-based strategy generation service
Follows Strategy Pattern and SOLID principles

Uses dependency injection and provider registry for extensibility.
"""

from typing import List, Dict, Optional, Literal
from ..models.schemas import ActionHistory
from .providers import LLMProvider, OpenAIProvider, AnthropicProvider


class ProviderRegistry:
    """
    Registry for LLM providers

    Single Responsibility: Manages provider registration and lookup
    Open/Closed: New providers can be registered without modification
    """

    def __init__(self):
        """Initialize empty provider registry"""
        self._providers: Dict[str, LLMProvider] = {}

    def register(self, provider: LLMProvider) -> None:
        """
        Register a provider

        Args:
            provider: LLMProvider instance to register
        """
        self._providers[provider.provider_name] = provider

    def get(self, provider_name: str) -> Optional[LLMProvider]:
        """
        Get provider by name

        Args:
            provider_name: Provider identifier

        Returns:
            LLMProvider instance or None if not found
        """
        return self._providers.get(provider_name)

    def get_available_providers(self) -> Dict[str, LLMProvider]:
        """
        Get all available providers (with API keys configured)

        Returns:
            Dict of provider_name -> LLMProvider
        """
        return {
            name: provider
            for name, provider in self._providers.items()
            if provider.is_available()
        }


class LLMStrategyService:
    """
    Service for generating strategies using LLMs

    Single Responsibility: Orchestrates LLM strategy generation
    Open/Closed: New providers can be added via registry without modifying this class
    Dependency Inversion: Depends on LLMProvider abstraction, not concrete implementations
    """

    def __init__(self, registry: Optional[ProviderRegistry] = None):
        """
        Initialize service with provider registry

        Args:
            registry: ProviderRegistry instance (optional, creates default if not provided)
        """
        self.registry = registry or self._create_default_registry()

    def _create_default_registry(self) -> ProviderRegistry:
        """
        Create default registry with all available providers

        Returns:
            ProviderRegistry with OpenAI and Anthropic providers
        """
        registry = ProviderRegistry()
        registry.register(OpenAIProvider())
        registry.register(AnthropicProvider())
        return registry

    def get_available_models(self) -> Dict[str, List[str]]:
        """
        Get list of available LLM models from all providers

        Returns:
            Dict mapping provider name to list of model names
        """
        available = self.registry.get_available_providers()
        return {
            name: provider.get_models()
            for name, provider in available.items()
        }

    async def generate_action(
        self,
        provider: Literal['openai', 'anthropic'],
        model: str,
        history: List[ActionHistory],
        system_prompt: Optional[str] = None,
        temperature: float = 0.7
    ) -> Dict[str, str]:
        """
        Generate action using LLM provider

        Delegates to appropriate provider via strategy pattern.

        Args:
            provider: LLM provider name
            model: Model name
            history: Game history
            system_prompt: Custom system prompt (optional)
            temperature: Sampling temperature

        Returns:
            Dict with action, reasoning, model, and provider

        Raises:
            ValueError: If provider is not available
        """
        # Get provider from registry
        llm_provider = self.registry.get(provider)

        if not llm_provider:
            raise ValueError(f"Provider '{provider}' not found")

        if not llm_provider.is_available():
            raise ValueError(f"Provider '{provider}' not available or not configured")

        # Delegate to provider
        return await llm_provider.generate_action(
            model=model,
            history=history,
            system_prompt=system_prompt,
            temperature=temperature
        )


# Singleton instance with default registry
llm_strategy_service = LLMStrategyService()
