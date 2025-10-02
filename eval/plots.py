"""Plotting stubs for training/eval curves (to be implemented)."""

from typing import Iterable, Dict, Any

try:
    import matplotlib.pyplot as plt  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    plt = None


def plot_reward_traces(episodes: Iterable[Dict[str, Any]]):
    if plt is None:
        print("matplotlib not available; skipping plot.")
        return
    for ep in episodes:
        rs = [s.get("reward", 0.0) for s in ep.get("steps", [])]
        plt.plot(rs, alpha=0.3)
    plt.title("Per-step reward traces")
    plt.xlabel("timestep")
    plt.ylabel("reward")
    plt.show()

