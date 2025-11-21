<script>
  import { onMount } from 'svelte';
  import { listLLMModels, llmPlayAction } from '../api.js';

  let models = { available: false, providers: {} };
  let selectedProvider = '';
  let selectedModel = '';
  let temperature = 0.7;
  let systemPrompt = '';
  let useCustomPrompt = false;

  let history = [];
  let loading = false;
  let result = null;
  let error = null;

  onMount(async () => {
    try {
      models = await listLLMModels();
      // Auto-select first available provider and model
      if (models.available) {
        const providers = Object.keys(models.providers);
        if (providers.length > 0) {
          selectedProvider = providers[0];
          selectedModel = models.providers[selectedProvider][0];
        }
      }
    } catch (e) {
      error = 'Failed to load LLM models. Check API keys configuration.';
    }
  });

  function addAction() {
    const round = history.length + 1;
    history = [...history, { round, my_action: 'C', opponent_action: 'C' }];
  }

  function removeAction(index) {
    history = history.filter((_, i) => i !== index);
    // Renumber rounds
    history = history.map((h, i) => ({ ...h, round: i + 1 }));
  }

  function clearHistory() {
    history = [];
    result = null;
    error = null;
  }

  function setPreset(preset) {
    if (preset === 'tft-defect') {
      // Tit-for-tat that got defected on
      history = [
        { round: 1, my_action: 'C', opponent_action: 'D' },
        { round: 2, my_action: 'D', opponent_action: 'D' },
        { round: 3, my_action: 'D', opponent_action: 'C' }
      ];
    } else if (preset === 'mutual-coop') {
      // Mutual cooperation
      history = [
        { round: 1, my_action: 'C', opponent_action: 'C' },
        { round: 2, my_action: 'C', opponent_action: 'C' },
        { round: 3, my_action: 'C', opponent_action: 'C' }
      ];
    } else if (preset === 'betrayal') {
      // Opponent betrayed after cooperation
      history = [
        { round: 1, my_action: 'C', opponent_action: 'C' },
        { round: 2, my_action: 'C', opponent_action: 'C' },
        { round: 3, my_action: 'C', opponent_action: 'D' },
        { round: 4, my_action: 'D', opponent_action: 'D' }
      ];
    }
    result = null;
    error = null;
  }

  async function generateAction() {
    if (!selectedProvider || !selectedModel) {
      error = 'Please select a provider and model';
      return;
    }

    loading = true;
    result = null;
    error = null;

    try {
      const request = {
        provider: selectedProvider,
        model: selectedModel,
        history: history,
        temperature: temperature
      };

      if (useCustomPrompt && systemPrompt.trim()) {
        request.system_prompt = systemPrompt;
      }

      result = await llmPlayAction(request);
    } catch (e) {
      error = e.message || 'Failed to generate action';
    } finally {
      loading = false;
    }
  }

  function providerChanged() {
    if (models.providers[selectedProvider]) {
      selectedModel = models.providers[selectedProvider][0];
    }
  }
</script>

<div class="card">
  <h2>🤖 LLM Strategy Playground</h2>
  <p style="color: var(--text-dim); margin-bottom: 1.5rem;">
    Generate strategies using LLMs (GPT-4, Claude) based on game history
  </p>

  {#if !models.available}
    <div class="alert">
      ⚠️ No LLM providers available. Configure API keys in .env file:
      <br />
      <code>OPENAI_API_KEY=sk-...</code> or <code>ANTHROPIC_API_KEY=sk-ant-...</code>
    </div>
  {:else}
    <div class="grid grid-2">
      <!-- Left: Configuration -->
      <div>
        <h3>LLM Configuration</h3>

        <div class="form-group">
          <label>Provider</label>
          <select bind:value={selectedProvider} on:change={providerChanged}>
            {#each Object.keys(models.providers) as provider}
              <option value={provider}>{provider}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label>Model</label>
          <select bind:value={selectedModel}>
            {#each models.providers[selectedProvider] || [] as model}
              <option value={model}>{model}</option>
            {/each}
          </select>
        </div>

        <div class="form-group">
          <label>Temperature: {temperature}</label>
          <input type="range" bind:value={temperature} min="0" max="2" step="0.1" />
          <small style="color: var(--text-dim);">
            Lower = more deterministic, Higher = more creative
          </small>
        </div>

        <div class="form-group">
          <label>
            <input type="checkbox" bind:checked={useCustomPrompt} />
            Use Custom System Prompt
          </label>
          {#if useCustomPrompt}
            <textarea
              bind:value={systemPrompt}
              placeholder="Enter custom system prompt..."
              rows="6"
            />
          {/if}
        </div>
      </div>

      <!-- Right: Game History -->
      <div>
        <h3>Game History</h3>

        <div style="margin-bottom: 1rem;">
          <button on:click={addAction} style="margin-right: 0.5rem;">Add Round</button>
          <button on:click={clearHistory} style="margin-right: 0.5rem;">Clear</button>
          <select on:change={(e) => { setPreset(e.target.value); e.target.value = ''; }}>
            <option value="">Load Preset...</option>
            <option value="tft-defect">Tit-for-Tat Defected</option>
            <option value="mutual-coop">Mutual Cooperation</option>
            <option value="betrayal">Betrayal Scenario</option>
          </select>
        </div>

        <div class="history-editor">
          {#if history.length === 0}
            <p style="color: var(--text-dim); text-align: center; padding: 2rem;">
              No history yet. Add rounds or load a preset.
            </p>
          {:else}
            <table style="width: 100%;">
              <thead>
                <tr>
                  <th>Round</th>
                  <th>My Action</th>
                  <th>Opponent</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {#each history as h, i}
                  <tr>
                    <td>{h.round}</td>
                    <td>
                      <select bind:value={h.my_action}>
                        <option value="C">C (Cooperate)</option>
                        <option value="D">D (Defect)</option>
                      </select>
                    </td>
                    <td>
                      <select bind:value={h.opponent_action}>
                        <option value="C">C (Cooperate)</option>
                        <option value="D">D (Defect)</option>
                      </select>
                    </td>
                    <td>
                      <button on:click={() => removeAction(i)} class="btn-small">×</button>
                    </td>
                  </tr>
                {/each}
              </tbody>
            </table>
          {/if}
        </div>

        <button
          on:click={generateAction}
          disabled={loading}
          style="width: 100%; margin-top: 1rem;"
        >
          {loading ? 'Generating...' : '🎲 Generate Next Action'}
        </button>
      </div>
    </div>

    <!-- Results -->
    {#if error}
      <div class="alert" style="margin-top: 1.5rem;">
        ❌ {error}
      </div>
    {/if}

    {#if result}
      <div class="card" style="background: var(--bg); margin-top: 1.5rem;">
        <h3>🎯 LLM Decision</h3>
        <div class="result-grid">
          <div>
            <strong>Action:</strong>
            <span class="action-badge" class:cooperate={result.action === 'C'} class:defect={result.action === 'D'}>
              {result.action === 'C' ? 'COOPERATE' : 'DEFECT'}
            </span>
          </div>
          <div>
            <strong>Model:</strong> {result.model} ({result.provider})
          </div>
        </div>
        <div style="margin-top: 1rem;">
          <strong>Reasoning:</strong>
          <p style="color: var(--text-dim); margin-top: 0.5rem;">
            {result.reasoning}
          </p>
        </div>
      </div>
    {/if}
  {/if}
</div>

<style>
  .history-editor {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 1rem;
  }

  .history-editor select {
    font-size: 0.9rem;
    padding: 0.25rem;
  }

  .btn-small {
    padding: 0.25rem 0.5rem;
    font-size: 1.2rem;
    line-height: 1;
    background: var(--danger);
  }

  .btn-small:hover {
    background: #c92a2a;
  }

  .alert {
    padding: 1rem;
    background: rgba(250, 176, 5, 0.1);
    border-left: 4px solid #fab005;
    border-radius: 4px;
    color: var(--text);
  }

  .result-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }

  .action-badge {
    display: inline-block;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    font-weight: bold;
    margin-left: 0.5rem;
  }

  .action-badge.cooperate {
    background: rgba(46, 213, 115, 0.2);
    color: #2ed573;
  }

  .action-badge.defect {
    background: rgba(255, 71, 87, 0.2);
    color: #ff4757;
  }

  textarea {
    width: 100%;
    padding: 0.5rem;
    font-family: 'Courier New', monospace;
    font-size: 0.9rem;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 4px;
    resize: vertical;
  }

  small {
    display: block;
    margin-top: 0.25rem;
  }
</style>
