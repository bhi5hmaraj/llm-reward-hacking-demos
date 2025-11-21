"""
Pydantic schemas for experiments
"""

from typing import List, Optional, Dict, Literal, Any
from pydantic import BaseModel, Field


# Experiment Configuration Schemas

class LLMStrategyConfig(BaseModel):
    """LLM strategy configuration"""
    provider: Literal['openai', 'anthropic'] = Field(..., description="LLM provider")
    model: str = Field(..., description="Model name")
    policy_id: Optional[str] = Field(None, description="Policy to apply")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0, description="Temperature")


class ExperimentConfig(BaseModel):
    """Experiment configuration"""
    llm_strategy: Optional[LLMStrategyConfig] = Field(None, description="LLM strategy config")
    classical_strategies: List[str] = Field(default_factory=list, description="Classical strategies to test against")
    turns: int = Field(default=200, ge=5, le=1000, description="Turns per match")
    repetitions: int = Field(default=10, ge=1, le=100, description="Repetitions per match")
    target_runs: int = Field(default=30, ge=1, le=200, description="Target number of runs for statistical validity")


# Experiment Schemas

class ExperimentBase(BaseModel):
    """Base experiment fields"""
    name: str = Field(..., min_length=1, max_length=200, description="Experiment name")
    hypothesis: str = Field(..., min_length=1, max_length=1000, description="Research hypothesis")
    description: Optional[str] = Field(None, max_length=2000, description="Experiment description")
    tags: List[str] = Field(default_factory=list, description="Tags for categorization")
    config: ExperimentConfig = Field(..., description="Experiment configuration")


class ExperimentCreate(ExperimentBase):
    """Request to create an experiment"""
    pass


class ExperimentUpdate(BaseModel):
    """Request to update an experiment"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    hypothesis: Optional[str] = Field(None, min_length=1, max_length=1000)
    description: Optional[str] = Field(None, max_length=2000)
    tags: Optional[List[str]] = None
    config: Optional[ExperimentConfig] = None
    status: Optional[Literal['draft', 'running', 'completed', 'failed']] = None


class Experiment(ExperimentBase):
    """Full experiment response"""
    id: str = Field(..., description="Experiment ID")
    status: Literal['draft', 'running', 'completed', 'failed'] = Field(..., description="Experiment status")
    created_at: str = Field(..., description="Creation timestamp (ISO format)")
    updated_at: str = Field(..., description="Last update timestamp (ISO format)")

    class Config:
        from_attributes = True


class ExperimentList(BaseModel):
    """List of experiments"""
    experiments: List[Experiment]
    total: int = Field(..., description="Total number of experiments")


# Experiment Run Schemas

class ExperimentRunCreate(BaseModel):
    """Request to create experiment run(s)"""
    count: int = Field(default=1, ge=1, le=100, description="Number of runs to create")


class ExperimentRun(BaseModel):
    """Experiment run response"""
    id: str = Field(..., description="Run ID")
    experiment_id: str = Field(..., description="Parent experiment ID")
    run_number: int = Field(..., description="Run sequence number")
    status: Literal['pending', 'running', 'completed', 'failed'] = Field(..., description="Run status")
    config_snapshot: Dict[str, Any] = Field(..., description="Config snapshot at run time")
    results: Optional[Dict[str, Any]] = Field(None, description="Tournament results")
    error: Optional[Dict[str, str]] = Field(None, description="Error info if failed")
    started_at: str = Field(..., description="Start timestamp (ISO format)")
    completed_at: Optional[str] = Field(None, description="Completion timestamp (ISO format)")
    duration_seconds: Optional[float] = Field(None, description="Run duration in seconds")

    class Config:
        from_attributes = True


class ExperimentRunList(BaseModel):
    """List of experiment runs"""
    runs: List[ExperimentRun]
    total: int = Field(..., description="Total number of runs")


# Analysis Schemas

class MetricStats(BaseModel):
    """Statistics for a metric"""
    mean: float = Field(..., description="Mean value")
    std: float = Field(..., description="Standard deviation")
    confidence_interval_95: List[float] = Field(..., description="95% confidence interval [lower, upper]")


class StrategyStats(BaseModel):
    """Per-strategy statistics"""
    mean_score: float = Field(..., description="Mean score")
    mean_cooperation_rate: float = Field(..., description="Mean cooperation rate")
    wins: int = Field(..., description="Number of wins")


class ExperimentAnalysis(BaseModel):
    """Aggregated experiment analysis"""
    experiment_id: str = Field(..., description="Experiment ID")
    total_runs: int = Field(..., description="Total runs")
    successful_runs: int = Field(..., description="Successfully completed runs")
    failed_runs: int = Field(..., description="Failed runs")

    cooperation_rate: Optional[MetricStats] = Field(None, description="Cooperation rate statistics")
    score: Optional[MetricStats] = Field(None, description="Score statistics")

    by_strategy: Dict[str, StrategyStats] = Field(default_factory=dict, description="Per-strategy breakdown")

    computed_at: str = Field(..., description="Analysis computation timestamp (ISO format)")


class ExperimentComparison(BaseModel):
    """Comparison of multiple experiments"""
    experiments: List[Experiment] = Field(..., description="Experiments being compared")
    analyses: List[ExperimentAnalysis] = Field(..., description="Analysis for each experiment")
    computed_at: str = Field(..., description="Comparison computation timestamp (ISO format)")
