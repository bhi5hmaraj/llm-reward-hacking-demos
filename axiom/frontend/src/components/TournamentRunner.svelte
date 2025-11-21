<script>
  import { onMount } from 'svelte';
  import { listStrategies, runTournament } from '../api.js';

  let strategies = [];
  let selectedStrategies = [];
  let turns = 200;
  let repetitions = 10;
  let loading = false;
  let result = null;

  onMount(async () => {
    strategies = await listStrategies(true);
  });

  function toggleStrategy(name) {
    if (selectedStrategies.includes(name)) {
      selectedStrategies = selectedStrategies.filter(s => s !== name);
    } else {
      selectedStrategies = [...selectedStrategies, name];
    }
  }

  function selectPreset() {
    selectedStrategies = ['TitForTat', 'Cooperator', 'Defector', 'Pavlov'];
  }

  async function run() {
    if (selectedStrategies.length < 2) {
      alert('Select at least 2 strategies');
      return;
    }

    loading = true;
    result = null;
    try {
      result = await runTournament(selectedStrategies, turns, repetitions);
    } catch (error) {
      alert('Failed to run tournament');
    } finally {
      loading = false;
    }
  }
</script>

<div class="card">
  <h2>🏆 Tournament Runner</h2>
  <p style="color: var(--text-dim); margin-bottom: 1.5rem;">
    Run a round-robin tournament between strategies
  </p>

  <div class="grid grid-2">
    <div>
      <h3>Select Strategies ({selectedStrategies.length})</h3>
      <button on:click={selectPreset} style="margin-bottom: 1rem;">
        Load Classic Preset
      </button>
      <div class="strategy-list">
        {#each strategies as strategy}
          <label class="strategy-item">
            <input
              type="checkbox"
              checked={selectedStrategies.includes(strategy.name)}
              on:change={() => toggleStrategy(strategy.name)}
            />
            {strategy.name}
          </label>
        {/each}
      </div>
    </div>

    <div>
      <h3>Tournament Settings</h3>
      <div class="form-group">
        <label>Turns per Match: {turns}</label>
        <input type="range" bind:value={turns} min="50" max="500" step="50" />
      </div>
      <div class="form-group">
        <label>Repetitions: {repetitions}</label>
        <input type="range" bind:value={repetitions} min="1" max="50" />
      </div>
      <button on:click={run} disabled={loading || selectedStrategies.length < 2}>
        {loading ? 'Running...' : 'Run Tournament'}
      </button>
    </div>
  </div>

  {#if result}
    <div class="card" style="background: var(--bg); margin-top: 1.5rem;">
      <h3>🏆 Tournament Results</h3>
      <div style="margin-bottom: 1rem;">
        <strong>Winner:</strong> {result.winner}
        <br />
        <strong>Total Matches:</strong> {result.total_matches}
      </div>

      <table>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Strategy</th>
            <th>Score</th>
            <th>Cooperation Rate</th>
          </tr>
        </thead>
        <tbody>
          {#each result.rankings as ranking}
            <tr>
              <td>
                {#if ranking.rank === 1}🥇
                {:else if ranking.rank === 2}🥈
                {:else if ranking.rank === 3}🥉
                {:else}{ranking.rank}{/if}
              </td>
              <td>{ranking.strategy}</td>
              <td>{ranking.score.toFixed(1)}</td>
              <td>{(ranking.cooperation_rate * 100).toFixed(1)}%</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .strategy-list {
    max-height: 400px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .strategy-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
  }

  .strategy-item input {
    width: auto;
  }
</style>
