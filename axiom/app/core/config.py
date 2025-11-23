"""
Configuration settings for Axiom service
"""

from typing import List, Union
from pydantic import field_validator
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings"""

    # API Settings
    api_title: str = "Axiom"
    api_description: str = "Game Theory Analysis Service"
    api_version: str = "0.1.0"

    # Server Settings
    host: str = "0.0.0.0"
    port: int = 8000
    reload: bool = False

    # CORS Settings
    cors_origins: Union[List[str], str] = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:8000",
    ]

    # Logging
    log_level: str = "info"

    # Game Theory Settings
    default_tournament_turns: int = 200
    default_tournament_repetitions: int = 10
    max_strategies_per_tournament: int = 20

    # LLM API Keys (optional)
    openai_api_key: str = ""
    anthropic_api_key: str = ""

    # Storage (optional)
    redis_url: str = ""

    @field_validator('cors_origins', mode='before')
    @classmethod
    def parse_cors_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(',')]
        return v

    model_config = {
        "env_file": ".env",
        "case_sensitive": False,
        "extra": "ignore"  # Ignore extra fields from .env
    }


settings = Settings()
