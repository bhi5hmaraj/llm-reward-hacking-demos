#!/usr/bin/env bash
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"

echo "[phase1] Starting training with train_armstrong_art.py"
echo "Note: uses hardcoded params in script; configs/phase1.yaml is a reference."
cd "$ROOT"
python3 train_armstrong_art.py

