# Storage Layer Architecture

**Repository Pattern with Multiple Backends**

## Overview

The storage layer uses the Repository pattern to abstract persistence, allowing different backends without code changes. Currently used for policy storage, designed to expand to experiments.

## Architecture

```python
# Abstract interface
class PolicyRepository(ABC):
    async def create(self, policy_id, name, text, ...) -> Dict
    async def get(self, policy_id) -> Optional[Dict]
    async def list_all() -> List[Dict]
    async def update(self, policy_id, ...) -> Optional[Dict]
    async def delete(self, policy_id) -> bool

# Concrete implementations
class RedisPolicyRepository(PolicyRepository):
    # Production: persistent, fast key-value storage

class InMemoryPolicyRepository(PolicyRepository):
    # Development: no setup, data lost on restart
```

## Backend Selection

Automatic based on availability:

```python
class PolicyService:
    def __init__(self):
        if REDIS_AVAILABLE and os.getenv('REDIS_URL'):
            self.repository = RedisPolicyRepository()
        else:
            self.repository = InMemoryPolicyRepository()
```

## Redis Implementation

### Key Structure
```
policy:{id}           # JSON policy data
policies:index        # Set of all policy IDs
```

### Features
- Persistent storage
- Fast lookups (O(1) by ID)
- Set-based indexing for listings
- JSON serialization for complex data

### Example
```python
# Store policy
await redis.set("policy:uuid-123", json.dumps({
    "id": "uuid-123",
    "name": "Forgiving TFT",
    "text": "Forgive single defections...",
    "created_at": "2025-01-15T10:30:00"
}))

# Index for listing
await redis.sadd("policies:index", "uuid-123")
```

## In-Memory Implementation

### Features
- Zero configuration
- Instant setup for development
- Dictionary-based storage
- Data cleared on restart

### Use Cases
- Local development
- Testing
- Demos without Redis

## Adding New Repositories

To add storage for new entities (e.g., experiments):

1. **Define interface** in `storage/base.py`:
```python
class ExperimentRepository(ABC):
    @abstractmethod
    async def create(self, experiment_id, ...) -> Dict:
        pass
```

2. **Implement Redis** in `storage/redis_repository.py`:
```python
class RedisExperimentRepository(ExperimentRepository):
    async def create(self, experiment_id, ...):
        # Use keys like experiment:{id}
        # Index in experiments:index
```

3. **Implement in-memory** in `storage/memory_repository.py`:
```python
class InMemoryExperimentRepository(ExperimentRepository):
    def __init__(self):
        self._experiments = {}
```

4. **Create service** in `services/`:
```python
class ExperimentService:
    def __init__(self, repository: Optional[ExperimentRepository] = None):
        self.repository = repository or self._auto_select()
```

## Configuration

Set `REDIS_URL` in `.env`:
```bash
REDIS_URL=redis://localhost:6379
# Or for remote Redis:
REDIS_URL=redis://:password@host:6379/0
```

## Testing

Services accept repository injection for testing:
```python
# Production
service = PolicyService()  # Auto-selects Redis or in-memory

# Testing with mock
mock_repo = Mock(spec=PolicyRepository)
service = PolicyService(repository=mock_repo)
```

## Future Backends

The abstraction allows adding:
- PostgreSQL repository
- S3-backed repository
- MongoDB repository
- Multi-backend replication

Just implement the repository interface!
