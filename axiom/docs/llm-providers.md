# LLM Provider System

**Strategy Pattern for Multi-Provider LLM Integration**

## Overview

LLM providers use the Strategy pattern to support multiple AI backends (OpenAI, Anthropic) with a unified interface. Adding new providers requires no changes to existing code.

## Architecture

```python
# Abstract provider interface
class LLMProvider(ABC):
    @abstractmethod
    async def generate_action(self, model, history, system_prompt, temperature)

    @abstractmethod
    def get_models(self) -> List[str]

    @abstractmethod
    def is_available(self) -> bool

    @property
    @abstractmethod
    def provider_name(self) -> str
```

## Provider Registry

Central registry manages all providers:

```python
class ProviderRegistry:
    def register(self, provider: LLMProvider)
    def get(self, provider_name: str) -> Optional[LLMProvider]
    def get_available_providers() -> Dict[str, LLMProvider]

# Service uses registry
class LLMStrategyService:
    def __init__(self):
        self.registry = ProviderRegistry()
        self.registry.register(OpenAIProvider())
        self.registry.register(AnthropicProvider())
```

## Existing Providers

### OpenAI Provider
- **Models**: gpt-4, gpt-4-turbo, gpt-3.5-turbo
- **Availability**: Requires `OPENAI_API_KEY`
- **API**: OpenAI Chat Completions

### Anthropic Provider
- **Models**: claude-3-5-sonnet-20241022, claude-3-opus-20240229
- **Availability**: Requires `ANTHROPIC_API_KEY`
- **API**: Anthropic Messages

## Adding a New Provider

Example: Adding Google Gemini support

### 1. Create Provider Implementation

```python
# app/services/providers/gemini_provider.py
class GeminiProvider(LLMProvider):
    def __init__(self):
        if self.is_available():
            self.client = genai.GenerativeModel()

    @property
    def provider_name(self) -> str:
        return "google"

    def is_available(self) -> bool:
        return GEMINI_INSTALLED and bool(os.getenv('GOOGLE_API_KEY'))

    def get_models(self) -> List[str]:
        return ['gemini-pro', 'gemini-ultra']

    async def generate_action(self, model, history, system_prompt, temperature):
        # Implement Gemini-specific logic
        response = self.client.generate_content(...)
        action, reasoning = self.parse_llm_response(response.text)
        return {
            "action": action,
            "reasoning": reasoning,
            "model": model,
            "provider": self.provider_name
        }
```

### 2. Register Provider

```python
# app/services/llm_strategy.py
def _create_default_registry(self):
    registry = ProviderRegistry()
    registry.register(OpenAIProvider())
    registry.register(AnthropicProvider())
    registry.register(GeminiProvider())  # Add new provider
    return registry
```

### 3. Update Schema

```python
# app/models/llm_schemas.py
class LLMActionRequest(BaseModel):
    provider: Literal['openai', 'anthropic', 'google'] = Field(...)
    # ... rest of fields
```

That's it! No changes to service logic needed.

## Policy Application

Providers support policy modification via system prompts:

```python
# Get default prompt from provider
provider = registry.get('openai')
base_prompt = provider.get_default_system_prompt()

# Apply policy
modified_prompt = policy_service.apply_policy(
    base_prompt,
    policy_text="Prioritize long-term cooperation"
)

# Use modified prompt
result = await provider.generate_action(..., system_prompt=modified_prompt)
```

## Response Parsing

All providers must parse LLM output to extract:
- **Action**: 'C' (cooperate) or 'D' (defect)
- **Reasoning**: Strategic explanation

Base class provides default parser:
```python
def parse_llm_response(self, content: str) -> tuple[str, str]:
    # Looks for "ACTION: C" or "ACTION: D"
    # Extracts reasoning after "REASONING:"
    # Fallback: heuristic based on content
```

Providers can override for custom formats.

## Error Handling

Providers should raise:
- `ValueError` for invalid requests (wrong model, missing config)
- Let API errors propagate for proper HTTP status codes

## Testing

Providers support dependency injection:

```python
# Production
service = LLMStrategyService()  # Auto-registers all providers

# Testing
mock_provider = Mock(spec=LLMProvider)
mock_provider.provider_name = "mock"
mock_provider.is_available.return_value = True

registry = ProviderRegistry()
registry.register(mock_provider)
service = LLMStrategyService(registry=registry)
```

## Configuration

Each provider checks for its API key:

```bash
# .env
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_API_KEY=...  # Future provider
```

Providers gracefully handle missing keys by returning `is_available() = False`.

## Future Providers

Easy to add:
- Google Gemini
- Mistral AI
- Cohere
- Local models (Ollama, vLLM)
- Custom fine-tuned models

Each just implements the `LLMProvider` interface!
