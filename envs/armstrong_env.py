from __future__ import annotations

"""Minimal wrapper around the existing Armstrong toy model for uniform rollouts.

Provides a Gym-like interface without adding a hard dependency on Gym:
  - reset(seed) -> observation (str)
  - step(action) -> (observation, reward, done, info)
  - render() -> str
"""

import random
from typing import Dict, Any, Optional

from armstrong_toy_model import GameState


class ArmstrongEnv:
    def __init__(self, seed: Optional[int] = None):
        self._seed = seed
        self.state: Optional[GameState] = None

    def seed(self, seed: int) -> None:
        self._seed = seed
        random.seed(seed)

    def reset(self, seed: Optional[int] = None) -> str:
        if seed is not None:
            self.seed(seed)
        elif self._seed is not None:
            random.seed(self._seed)
        self.state = GameState()
        return self.state.render()

    def step(self, action: str):
        assert self.state is not None, "Call reset() first"
        reward, done = self.state.step(action)
        obs = self.state.render()
        info: Dict[str, Any] = {
            "camera_view": self.state.camera_view(),
            "hole_count": self.state.hole_count,
            "steps": self.state.steps,
        }
        return obs, reward, done, info

    def render(self) -> str:
        assert self.state is not None, "Call reset() first"
        return self.state.render()

