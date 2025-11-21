<script>
  import { onMount } from 'svelte';
  import StrategyPlayground from './components/StrategyPlayground.svelte';
  import EquilibriumCalculator from './components/EquilibriumCalculator.svelte';
  import TournamentRunner from './components/TournamentRunner.svelte';
  import StrategyAnalyzer from './components/StrategyAnalyzer.svelte';
  import { healthCheck } from './api.js';

  let activeTab = 'playground';
  let health = null;
  let loading = true;

  onMount(async () => {
    try {
      health = await healthCheck();
    } catch (error) {
      console.error('Health check failed:', error);
    } finally {
      loading = false;
    }
  });

  const tabs = [
    { id: 'playground', label: 'Strategy Playground', icon: '🎮' },
    { id: 'equilibrium', label: 'Nash Equilibrium', icon: '⚖️' },
    { id: 'tournament', label: 'Tournament', icon: '🏆' },
    { id: 'analyzer', label: 'Strategy Analyzer', icon: '📊' }
  ];
</script>

<div class="app">
  <header>
    <h1>⚛️ Axiom</h1>
    <p>Game Theory Analysis Service</p>
    {#if health}
      <div class="health-status">
        <span class="badge badge-success">
          {health.strategies_available} strategies available
        </span>
        <span class="badge badge-info">v{health.version}</span>
      </div>
    {/if}
  </header>

  {#if loading}
    <div class="loading">Loading...</div>
  {:else}
    <nav class="tabs">
      {#each tabs as tab}
        <button
          class="tab"
          class:active={activeTab === tab.id}
          on:click={() => activeTab = tab.id}
        >
          <span class="tab-icon">{tab.icon}</span>
          {tab.label}
        </button>
      {/each}
    </nav>

    <main>
      {#if activeTab === 'playground'}
        <StrategyPlayground />
      {:else if activeTab === 'equilibrium'}
        <EquilibriumCalculator />
      {:else if activeTab === 'tournament'}
        <TournamentRunner />
      {:else if activeTab === 'analyzer'}
        <StrategyAnalyzer />
      {/if}
    </main>
  {/if}
</div>

<style>
  header {
    text-align: center;
    margin-bottom: 2rem;
    padding-bottom: 2rem;
    border-bottom: 1px solid var(--border);
  }

  h1 {
    font-size: 3rem;
    margin-bottom: 0.5rem;
  }

  header p {
    color: var(--text-dim);
    font-size: 1.25rem;
  }

  .health-status {
    margin-top: 1rem;
    display: flex;
    gap: 0.5rem;
    justify-content: center;
  }

  .tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 2rem;
    border-bottom: 2px solid var(--border);
    overflow-x: auto;
  }

  .tab {
    background: transparent;
    padding: 1rem 1.5rem;
    border: none;
    border-bottom: 3px solid transparent;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    white-space: nowrap;
  }

  .tab:hover {
    background: var(--bg-light);
  }

  .tab.active {
    border-bottom-color: var(--primary);
    background: var(--bg-light);
  }

  .tab-icon {
    font-size: 1.25rem;
  }
</style>
