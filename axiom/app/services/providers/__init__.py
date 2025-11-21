"""
LLM Provider implementations

Follows Strategy Pattern and SOLID principles:
- Single Responsibility: Each provider handles one LLM API
- Open/Closed: New providers can be added without modifying existing code
- Liskov Substitution: All providers can be used interchangeably
- Interface Segregation: Clean abstract interface with no unnecessary methods
- Dependency Inversion: Depends on abstractions (LLMProvider), not concrete implementations
"""

from .base import LLMProvider
from .openai_provider import OpenAIProvider
from .anthropic_provider import AnthropicProvider

__all__ = [
    'LLMProvider',
    'OpenAIProvider',
    'AnthropicProvider',
]
