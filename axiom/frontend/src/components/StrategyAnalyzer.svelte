<script>
  import { onMount } from 'svelte';
  import { listStrategies, analyzeStrategy } from '../api.js';

  let strategies = [];
  let selectedStrategy = '';
  let turns = 200;
  let loading = false;
  let result = null;

  onMount(async () => {
    strategies = await listStrategies(true);
    if (strategies.length > 0) {
      selectedStrategy = strategies[0].name;
    }
  });

  async function analyze() {
    loading = true;
    result = null;
    try {
      result = await analyzeStrategy(selectedStrategy, turns);
    } catch (error) {
      alert('Failed to analyze strategy');
    } finally {
      loading = false;
    }
  }
</script>

<div class="card">
  <h2>📊 Strategy Analyzer</h2>
  <p style="color: var(--text-dim); margin-bottom: 1.5rem;">
    Analyze how a strategy performs against standard opponents
  </p>

  <div class="form-group">
    <label>Select Strategy:</label>
    <select bind:value={selectedStrategy}>
      {#each strategies as strategy}
        <option value={strategy.name}>{strategy.name}</option>
      {/each}
    </select>
  </div>

  <div class="form-group">
    <label>Turns per Match: {turns}</label>
    <input type="range" bind:value={turns} min="50" max="500" step="50" />
  </div>

  <button on:click={analyze} disabled={loading || !selectedStrategy}>
    {loading ? 'Analyzing...' : 'Analyze Strategy'}
  </button>

  {#if result}
    <div class="card" style="background: var(--bg); margin-top: 1.5rem;">
      <h3>Analysis Results: {result.strategy_name}</h3>

      <div class="metrics">
        <div class="metric-card">
          <div class="metric-value">{(result.cooperation_rate * 100).toFixed(1)}%</div>
          <div class="metric-label">Overall Cooperation Rate</div>
        </div>
        <div class="metric-card">
          <div class="metric-value">{result.average_score.toFixed(1)}</div>
          <div class="metric-label">Average Score</div>
        </div>
      </div>

      <div style="margin-top: 1.5rem;">
        <h4>Performance Against Standard Opponents</h4>
        <table>
          <thead>
            <tr>
              <th>Opponent</th>
              <th>Score</th>
              <th>Cooperation Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Cooperator</td>
              <td>{result.vs_cooperator.score.toFixed(1)}</td>
              <td>{(result.vs_cooperator.cooperation_rate * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Defector</td>
              <td>{result.vs_defector.score.toFixed(1)}</td>
              <td>{(result.vs_defector.cooperation_rate * 100).toFixed(1)}%</td>
            </tr>
            <tr>
              <td>Tit For Tat</td>
              <td>{result.vs_tit_for_tat.score.toFixed(1)}</td>
              <td>{(result.vs_tit_for_tat.cooperation_rate * 100).toFixed(1)}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      {#if result.classifier && Object.keys(result.classifier).length > 0}
        <details style="margin-top: 1rem;">
          <summary>Strategy Classifier</summary>
          <pre>{JSON.stringify(result.classifier, null, 2)}</pre>
        </details>
      {/if}
    </div>
  {/if}
</div>

<style>
  .metrics {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: 1rem;
    margin-top: 1rem;
  }

  .metric-card {
    background: var(--bg-light);
    padding: 1.5rem;
    border-radius: 12px;
    text-align: center;
    border: 1px solid var(--border);
  }

  .metric-value {
    font-size: 2rem;
    font-weight: 700;
    color: var(--primary);
    margin-bottom: 0.5rem;
  }

  .metric-label {
    color: var(--text-dim);
    font-size: 0.875rem;
  }

  h4 {
    margin-bottom: 1rem;
  }

  details {
    cursor: pointer;
  }

  pre {
    background: var(--bg-light);
    padding: 1rem;
    border-radius: 8px;
    overflow-x: auto;
    font-size: 0.875rem;
    margin-top: 0.5rem;
  }
</style>
