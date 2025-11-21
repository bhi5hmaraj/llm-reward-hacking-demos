"""
Storage layer for Axiom

Provides abstract repository interfaces and concrete implementations.
Follows Dependency Inversion Principle - services depend on repository
abstractions, not concrete storage implementations.

Available Implementations:
- RedisPolicyRepository: Redis-backed storage (production)
- InMemoryPolicyRepository: In-memory storage (development/testing)
"""

from .base import PolicyRepository
from .memory_repository import InMemoryPolicyRepository

# Optional Redis import
try:
    from .redis_repository import RedisPolicyRepository
    REDIS_AVAILABLE = True
except (ImportError, RuntimeError):
    REDIS_AVAILABLE = False

__all__ = [
    'PolicyRepository',
    'InMemoryPolicyRepository',
]

if REDIS_AVAILABLE:
    __all__.append('RedisPolicyRepository')
