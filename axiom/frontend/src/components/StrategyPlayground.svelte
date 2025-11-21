<script>
  import { onMount } from 'svelte';
  import { listStrategies, playStrategy } from '../api.js';

  let strategies = [];
  let selectedStrategy = '';
  let history = [];
  let loading = false;
  let result = null;

  onMount(async () => {
    strategies = await listStrategies(true);
    if (strategies.length > 0) {
      selectedStrategy = strategies[0].name;
    }
  });

  function addAction(myAction, oppAction) {
    history = [...history, {
      round: history.length + 1,
      my_action: myAction,
      opponent_action: oppAction
    }];
  }

  async function getStrategyAction() {
    if (!selectedStrategy) return;

    loading = true;
    try {
      result = await playStrategy(selectedStrategy, history);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to get strategy action');
    } finally {
      loading = false;
    }
  }

  function reset() {
    history = [];
    result = null;
  }
</script>

<div class="card">
  <h2>🎮 Strategy Playground</h2>
  <p style="color: var(--text-dim); margin-bottom: 1.5rem;">
    Test how different strategies respond to game history
  </p>

  <div class="form-group">
    <label>Select Strategy:</label>
    <select bind:value={selectedStrategy}>
      {#each strategies as strategy}
        <option value={strategy.name}>{strategy.name}</option>
      {/each}
    </select>
  </div>

  <div class="card" style="background: var(--bg);">
    <h3>Game History</h3>
    {#if history.length === 0}
      <p style="color: var(--text-dim); text-align: center; padding: 2rem;">
        No history yet. Add some actions below.
      </p>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Round</th>
            <th>My Action</th>
            <th>Opponent Action</th>
          </tr>
        </thead>
        <tbody>
          {#each history as h}
            <tr>
              <td>{h.round}</td>
              <td><span class="action {h.my_action}">{h.my_action}</span></td>
              <td><span class="action {h.opponent_action}">{h.opponent_action}</span></td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}

    <div style="margin-top: 1rem; display: flex; gap: 0.5rem;">
      <button on:click={() => addAction('C', 'C')}>Both Cooperate</button>
      <button on:click={() => addAction('C', 'D')}>I Coop, Opp Defect</button>
      <button on:click={() => addAction('D', 'C')}>I Defect, Opp Coop</button>
      <button on:click={() => addAction('D', 'D')}>Both Defect</button>
      <button on:click={reset} style="margin-left: auto;">Reset</button>
    </div>
  </div>

  <button on:click={getStrategyAction} disabled={loading || !selectedStrategy}>
    {loading ? 'Computing...' : 'Get Strategy Action'}
  </button>

  {#if result}
    <div class="card" style="background: var(--bg); margin-top: 1rem;">
      <h3>Strategy Response</h3>
      <div class="result-display">
        <div class="result-action">
          <span class="action-label">Action:</span>
          <span class="action {result.action}">{result.action === 'C' ? 'Cooperate' : 'Defect'}</span>
        </div>
        <div class="reasoning">
          <strong>Reasoning:</strong>
          <p>{result.reasoning}</p>
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  .form-group {
    margin-bottom: 1.5rem;
  }

  label {
    display: block;
    margin-bottom: 0.5rem;
    font-weight: 500;
  }

  .action {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 4px;
    font-weight: 600;
  }

  .action.C {
    background: rgba(74, 222, 128, 0.2);
    color: var(--success);
  }

  .action.D {
    background: rgba(248, 113, 113, 0.2);
    color: var(--danger);
  }

  .result-display {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .result-action {
    display: flex;
    align-items: center;
    gap: 1rem;
    font-size: 1.25rem;
  }

  .action-label {
    color: var(--text-dim);
  }

  .reasoning {
    padding: 1rem;
    background: var(--bg-light);
    border-radius: 8px;
  }

  .reasoning p {
    margin-top: 0.5rem;
    color: var(--text-dim);
  }
</style>
