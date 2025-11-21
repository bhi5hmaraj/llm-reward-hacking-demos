"""
Storage layer for Axiom

Provides abstract repository interfaces and concrete implementations.
Follows Dependency Inversion Principle - services depend on repository
abstractions, not concrete storage implementations.

Available Implementations:
- Policy: RedisPolicyRepository, InMemoryPolicyRepository
- Experiments: RedisExperimentRepository, InMemoryExperimentRepository
- Experiment Runs: RedisExperimentRunRepository, InMemoryExperimentRunRepository
"""

from .base import PolicyRepository, ExperimentRepository, ExperimentRunRepository
from .memory_repository import (
    InMemoryPolicyRepository,
    InMemoryExperimentRepository,
    InMemoryExperimentRunRepository
)

# Optional Redis import
try:
    from .redis_repository import (
        RedisPolicyRepository,
        RedisExperimentRepository,
        RedisExperimentRunRepository
    )
    REDIS_AVAILABLE = True
except (ImportError, RuntimeError):
    REDIS_AVAILABLE = False

__all__ = [
    # Abstract interfaces
    'PolicyRepository',
    'ExperimentRepository',
    'ExperimentRunRepository',
    # In-memory implementations
    'InMemoryPolicyRepository',
    'InMemoryExperimentRepository',
    'InMemoryExperimentRunRepository',
]

if REDIS_AVAILABLE:
    __all__.extend([
        'RedisPolicyRepository',
        'RedisExperimentRepository',
        'RedisExperimentRunRepository',
    ])
