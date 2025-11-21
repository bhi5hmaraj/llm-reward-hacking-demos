/**
 * API client for Axiom backend
 */

const API_URL = import.meta.env.VITE_API_URL || '/api';

export async function listStrategies(basicOnly = false) {
  const response = await fetch(`${API_URL}/strategies?basic_only=${basicOnly}`);
  if (!response.ok) throw new Error('Failed to fetch strategies');
  return response.json();
}

export async function playStrategy(strategyName, history) {
  const response = await fetch(`${API_URL}/strategies/${strategyName}/play`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ history })
  });
  if (!response.ok) throw new Error('Failed to get strategy action');
  return response.json();
}

export async function analyzeStrategy(strategyName, turns = 200) {
  const response = await fetch(`${API_URL}/strategies/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategy_name: strategyName, turns })
  });
  if (!response.ok) throw new Error('Failed to analyze strategy');
  return response.json();
}

export async function computeEquilibrium(matrix) {
  const response = await fetch(`${API_URL}/equilibrium`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ matrix })
  });
  if (!response.ok) throw new Error('Failed to compute equilibrium');
  return response.json();
}

export async function runTournament(strategies, turns = 200, repetitions = 10) {
  const response = await fetch(`${API_URL}/tournament`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ strategies, turns, repetitions })
  });
  if (!response.ok) throw new Error('Failed to run tournament');
  return response.json();
}

export async function healthCheck() {
  const response = await fetch(`${API_URL}/health`);
  if (!response.ok) throw new Error('Health check failed');
  return response.json();
}
