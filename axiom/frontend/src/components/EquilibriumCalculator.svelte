<script>
  import { computeEquilibrium } from '../api.js';

  let matrixSize = 2;
  let matrix = [[3, 0], [5, 1]]; // Prisoner's Dilemma default
  let loading = false;
  let result = null;

  $: {
    // Update matrix when size changes
    const newMatrix = Array(matrixSize).fill(0).map(() => Array(matrixSize).fill(0));
    for (let i = 0; i < Math.min(matrixSize, matrix.length); i++) {
      for (let j = 0; j < Math.min(matrixSize, matrix[i].length); j++) {
        newMatrix[i][j] = matrix[i][j] || 0;
      }
    }
    matrix = newMatrix;
  }

  async function calculate() {
    loading = true;
    result = null;
    try {
      result = await computeEquilibrium(matrix);
    } catch (error) {
      alert('Failed to compute equilibrium');
    } finally {
      loading = false;
    }
  }

  function loadPreset(preset) {
    if (preset === 'pd') {
      matrixSize = 2;
      matrix = [[3, 0], [5, 1]];
    } else if (preset === 'stag') {
      matrixSize = 2;
      matrix = [[5, 0], [4, 2]];
    }
  }
</script>

<div class="card">
  <h2>⚖️ Nash Equilibrium Calculator</h2>
  <p style="color: var(--text-dim); margin-bottom: 1.5rem;">
    Compute Nash equilibria for any payoff matrix
  </p>

  <div class="controls">
    <div class="form-group">
      <label>Matrix Size: {matrixSize}×{matrixSize}</label>
      <input type="range" bind:value={matrixSize} min="2" max="5" />
    </div>

    <div style="display: flex; gap: 0.5rem;">
      <button on:click={() => loadPreset('pd')}>Prisoner's Dilemma</button>
      <button on:click={() => loadPreset('stag')}>Stag Hunt</button>
    </div>
  </div>

  <div class="matrix-input">
    <h3>Payoff Matrix (Row Player)</h3>
    <div class="matrix-grid" style="grid-template-columns: repeat({matrixSize}, 1fr);">
      {#each matrix as row, i}
        {#each row as cell, j}
          <input
            type="number"
            bind:value={matrix[i][j]}
            step="0.1"
            class="matrix-cell"
          />
        {/each}
      {/each}
    </div>
  </div>

  <button on:click={calculate} disabled={loading}>
    {loading ? 'Computing...' : 'Calculate Nash Equilibrium'}
  </button>

  {#if result}
    <div class="card" style="background: var(--bg); margin-top: 1rem;">
      <h3>Results</h3>

      <div class="result-summary">
        <span class="badge {result.is_unique ? 'badge-success' : 'badge-info'}">
          {result.equilibria.length} {result.equilibria.length === 1 ? 'Equilibrium' : 'Equilibria'} Found
        </span>
        {#if result.is_unique}
          <span class="badge badge-success">Unique</span>
        {/if}
      </div>

      {#if result.pure_equilibria.length > 0}
        <div style="margin-top: 1rem;">
          <strong>Pure Strategy Equilibria:</strong>
          <ul>
            {#each result.pure_equilibria as eq}
              <li>({eq.row}, {eq.col})</li>
            {/each}
          </ul>
        </div>
      {/if}

      <details style="margin-top: 1rem;">
        <summary>Mixed Strategy Equilibria</summary>
        <pre>{JSON.stringify(result.equilibria, null, 2)}</pre>
      </details>
    </div>
  {/if}
</div>

<style>
  .controls {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    margin-bottom: 1.5rem;
  }

  .matrix-input {
    margin-bottom: 1.5rem;
  }

  .matrix-grid {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .matrix-cell {
    width: 100%;
    text-align: center;
    font-weight: 600;
  }

  .result-summary {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  ul {
    margin-left: 1.5rem;
    margin-top: 0.5rem;
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
