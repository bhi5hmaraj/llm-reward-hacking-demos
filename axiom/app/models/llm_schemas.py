"""
Pydantic schemas for LLM-based strategies
"""

from typing import List, Optional, Literal
from pydantic import BaseModel, Field
from .schemas import ActionHistory


class LLMModelsResponse(BaseModel):
    """Available LLM models"""
    available: bool = Field(..., description="Whether any LLM providers are available")
    providers: dict = Field(..., description="Available providers and models")


class LLMActionRequest(BaseModel):
    """Request for LLM to generate action"""
    provider: Literal['openai', 'anthropic'] = Field(..., description="LLM provider")
    model: str = Field(..., description="Model name (e.g., gpt-4, claude-3-5-sonnet-20241022)")
    history: List[ActionHistory] = Field(
        default_factory=list,
        description="Game history"
    )
    system_prompt: Optional[str] = Field(
        None,
        description="Custom system prompt (optional)"
    )
    policy_id: Optional[str] = Field(
        None,
        description="Policy ID to apply strategy modifications (optional)"
    )
    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Sampling temperature"
    )


class LLMActionResponse(BaseModel):
    """LLM-generated action"""
    action: Literal['C', 'D']
    reasoning: str = Field(..., description="LLM's strategic reasoning")
    model: str = Field(..., description="Model used")
    provider: str = Field(..., description="Provider used")


class LLMTournamentRequest(BaseModel):
    """Request to run tournament with LLM strategies"""
    llm_configs: List[dict] = Field(
        ...,
        description="List of LLM configurations",
        example=[
            {"provider": "openai", "model": "gpt-4", "name": "GPT-4"},
            {"provider": "anthropic", "model": "claude-3-5-sonnet-20241022", "name": "Claude"}
        ]
    )
    classical_strategies: List[str] = Field(
        default_factory=list,
        description="Classical Axelrod strategies to include"
    )
    turns: int = Field(default=20, ge=5, le=100)
    repetitions: int = Field(default=3, ge=1, le=10)
