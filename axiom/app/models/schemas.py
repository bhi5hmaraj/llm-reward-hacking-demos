"""
Pydantic schemas for API request/response models
"""

from typing import List, Optional, Dict, Any, Literal
from pydantic import BaseModel, Field


# ============================================================================
# Nash Equilibrium Models
# ============================================================================

class PayoffMatrix(BaseModel):
    """Payoff matrix for Nash equilibrium computation"""

    matrix: List[List[float]] = Field(
        ...,
        description="2D payoff matrix (row player perspective)",
        example=[[3, 0], [5, 1]]
    )
    player_names: Optional[List[str]] = Field(
        None,
        description="Names of players",
        example=["Player 1", "Player 2"]
    )


class NashEquilibrium(BaseModel):
    """Nash equilibrium result"""

    equilibria: List[List[float]] = Field(
        ...,
        description="List of Nash equilibria (mixed strategy profiles)"
    )
    is_unique: bool = Field(
        ...,
        description="Whether the equilibrium is unique"
    )
    pure_equilibria: List[Dict[str, int]] = Field(
        default_factory=list,
        description="Pure strategy Nash equilibria"
    )


# ============================================================================
# Strategy Models
# ============================================================================

class ActionHistory(BaseModel):
    """History of actions in a game"""

    round: int = Field(..., ge=1)
    my_action: Literal["C", "D"] = Field(..., description="Cooperate or Defect")
    opponent_action: Literal["C", "D"]


class StrategyPlayRequest(BaseModel):
    """Request to get action from a strategy"""

    history: List[ActionHistory] = Field(
        default_factory=list,
        description="Game history (empty for first round)"
    )
    opponent_id: Optional[str] = Field(
        None,
        description="Opponent identifier for memory-based strategies"
    )


class StrategyPlayResponse(BaseModel):
    """Response with strategy's action"""

    action: Literal["C", "D"]
    reasoning: str = Field(..., description="Explanation of why this action was chosen")
    strategy_name: str


class StrategyInfo(BaseModel):
    """Information about a strategy"""

    name: str
    classifier: Dict[str, Any] = Field(
        default_factory=dict,
        description="Axelrod classifier (memory depth, stochastic, etc.)"
    )
    description: str


# ============================================================================
# Tournament Models
# ============================================================================

class TournamentRequest(BaseModel):
    """Request to run a tournament"""

    strategies: List[str] = Field(
        ...,
        description="List of strategy names to compete",
        min_length=2,
        max_length=20,
        example=["TitForTat", "Cooperator", "Defector"]
    )
    turns: int = Field(
        default=200,
        ge=10,
        le=1000,
        description="Number of turns per match"
    )
    repetitions: int = Field(
        default=10,
        ge=1,
        le=100,
        description="Number of times to repeat each match"
    )


class TournamentResult(BaseModel):
    """Tournament results"""

    rankings: List[Dict[str, Any]] = Field(
        ...,
        description="Ranked list of strategies with scores"
    )
    total_matches: int
    winner: str
    cooperation_rates: Dict[str, float] = Field(
        ...,
        description="Cooperation rate for each strategy"
    )


# ============================================================================
# Analysis Models
# ============================================================================

class StrategyAnalysisRequest(BaseModel):
    """Request to analyze a strategy"""

    strategy_name: str
    probe_strategies: Optional[List[str]] = Field(
        None,
        description="Strategies to test against (default: representative set)"
    )
    turns: int = Field(
        default=200,
        ge=50,
        le=500
    )


class StrategyAnalysisResponse(BaseModel):
    """Strategy analysis results"""

    strategy_name: str
    cooperation_rate: float = Field(..., ge=0.0, le=1.0)
    average_score: float
    vs_cooperator: Dict[str, float]
    vs_defector: Dict[str, float]
    vs_tit_for_tat: Dict[str, float]
    classifier: Dict[str, Any]


# ============================================================================
# Warden's Dilemma Integration Models
# ============================================================================

class WardensGameState(BaseModel):
    """Current state of a Warden's Dilemma game"""

    player_id: str
    round: int
    history: List[Dict[str, Any]] = Field(
        default_factory=list,
        description="Full game history with all players' actions"
    )
    num_players: int = Field(..., ge=2, le=10)
    payoff_matrix: Optional[Dict[str, Any]] = None


class AIAgentAction(BaseModel):
    """AI agent's action recommendation"""

    action: Literal["C", "D", "OPT_OUT"]
    confidence: float = Field(..., ge=0.0, le=1.0)
    reasoning: str
    strategy_used: str


# ============================================================================
# Health & Info Models
# ============================================================================

class HealthResponse(BaseModel):
    """Health check response"""

    status: str = "ok"
    version: str
    strategies_available: int
    axelrod_version: str
    nashpy_version: str
