/**
 * Custom Scenario Page
 *
 * A lightweight form to capture a custom scenario draft that CopilotKit can use
 * to propose or refine experiment/game configurations. No CopilotKit dependency
 * here; we just expose clean fields and a preview JSON the assistant can read.
 */

import { useEffect, useMemo, useState } from 'react';

type Durations = {
  announcementMs: number;
  communicationMs: number;
  actionMs: number;
  revelationMs: number;
};

type CustomScenarioDraft = {
  title: string;
  synopsis: string;
  goals: string;
  constraints: string;
  numPlayers: number;
  bins: number; // 2 or 3 for now
  labels: string[]; // per bin labels
  colors: string[]; // per bin colors (hex)
  durations: Durations;
  aiSeats: number; // how many AI seats to prefill (0..numPlayers)
  notes?: string;
};

const DEFAULT: CustomScenarioDraft = {
  title: '',
  synopsis: '',
  goals: '',
  constraints: '',
  numPlayers: 3,
  bins: 2,
  labels: ['Cooperate', 'Defect', ''],
  colors: ['#2ecc71', '#e74c3c', '#3498db'],
  durations: {
    announcementMs: 2000,
    communicationMs: 10000,
    actionMs: 10000,
    revelationMs: 2000,
  },
  aiSeats: 0,
  notes: '',
};

const STORAGE_KEY = 'wd.customScenarioDraft.v1';

export default function CustomScenarioPage() {
  const [draft, setDraft] = useState<CustomScenarioDraft>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? { ...DEFAULT, ...JSON.parse(saved) } : DEFAULT;
    } catch {
      return DEFAULT;
    }
  });

  const [copilotHint, setCopilotHint] = useState('');

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(draft)); } catch {}
  }, [draft]);

  const preview = useMemo(() => {
    // Provide a compact draft the assistant can transform into our config later
    return {
      scenario: {
        title: draft.title,
        synopsis: draft.synopsis,
        goals: draft.goals,
        constraints: draft.constraints,
        notes: draft.notes,
      },
      design: {
        numPlayers: draft.numPlayers,
        bins: draft.bins,
        labels: draft.labels.slice(0, draft.bins),
        colors: draft.colors.slice(0, draft.bins),
        durations: draft.durations,
        aiSeats: draft.aiSeats,
      },
      // This structure is intentionally simple for CopilotKit to consume.
      // The assistant can return a proposed ExperimentConfig later.
    };
  }, [draft]);

  const labelField = (idx: number) => (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Label (bin {idx + 1})
      </label>
      <input
        data-copilot="label"
        type="text"
        value={draft.labels[idx] || ''}
        onChange={(e) => {
          const labels = draft.labels.slice();
          labels[idx] = e.target.value;
          setDraft({ ...draft, labels });
        }}
        placeholder={idx === 0 ? 'Cooperate' : idx === 1 ? 'Defect' : 'Optional third'}
        style={{ width: '100%' }}
      />
    </div>
  );

  const colorField = (idx: number) => (
    <div>
      <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>
        Color (bin {idx + 1})
      </label>
      <input
        data-copilot="color"
        type="color"
        value={draft.colors[idx] || '#cccccc'}
        onChange={(e) => {
          const colors = draft.colors.slice();
          colors[idx] = e.target.value;
          setDraft({ ...draft, colors });
        }}
        style={{ width: '100%', height: 36, padding: 0 }}
      />
    </div>
  );

  return (
    <div className="container" style={{ maxWidth: 900, paddingTop: '2rem' }}>
      <h1 style={{ marginBottom: '1rem' }}>Custom Scenario</h1>
      <p style={{ color: '#666', marginBottom: '1.5rem' }}>
        Define a scenario that Copilot can use to propose an experiment configuration. You can save a draft locally and copy the JSON preview.
      </p>

      <div className="grid" style={{ gap: '1.5rem' }}>
        {/* Left: form */}
        <div className="card">
          <form onSubmit={(e) => e.preventDefault()}>
            <h2 style={{ fontSize: '1.125rem', marginBottom: '1rem' }}>Scenario</h2>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Title *</label>
              <input
                data-copilot="title"
                type="text"
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                required
                placeholder="e.g., Bluffing under time pressure"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Synopsis</label>
              <textarea
                data-copilot="synopsis"
                value={draft.synopsis}
                onChange={(e) => setDraft({ ...draft, synopsis: e.target.value })}
                rows={4}
                placeholder="Brief narrative of the scenario or theme"
                style={{ width: '100%' }}
              />
            </div>

            <div className="grid grid-2" style={{ gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Goals</label>
                <textarea
                  data-copilot="goals"
                  value={draft.goals}
                  onChange={(e) => setDraft({ ...draft, goals: e.target.value })}
                  rows={4}
                  placeholder="What behaviors/outcomes are sought?"
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Constraints</label>
                <textarea
                  data-copilot="constraints"
                  value={draft.constraints}
                  onChange={(e) => setDraft({ ...draft, constraints: e.target.value })}
                  rows={4}
                  placeholder="Rules, limitations, or ethical constraints"
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <h2 style={{ fontSize: '1.125rem', margin: '1.25rem 0 1rem' }}>Design</h2>
            <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Players</label>
                <input
                  data-copilot="numPlayers"
                  type="number"
                  min={2}
                  max={6}
                  value={draft.numPlayers}
                  onChange={(e) => setDraft({ ...draft, numPlayers: Math.max(2, Math.min(6, Number(e.target.value) || 2)) })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>AI Seats</label>
                <input
                  data-copilot="aiSeats"
                  type="number"
                  min={0}
                  max={draft.numPlayers}
                  value={draft.aiSeats}
                  onChange={(e) => setDraft({ ...draft, aiSeats: Math.max(0, Math.min(draft.numPlayers, Number(e.target.value) || 0)) })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div className="grid grid-3" style={{ gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Bins</label>
                <select
                  data-copilot="bins"
                  value={draft.bins}
                  onChange={(e) => setDraft({ ...draft, bins: Number(e.target.value) as 2 | 3 })}
                  style={{ width: '100%' }}
                >
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>
              {labelField(0)}
              {colorField(0)}
              {labelField(1)}
              {colorField(1)}
              {draft.bins === 3 && labelField(2)}
              {draft.bins === 3 && colorField(2)}
            </div>

            <h3 style={{ fontSize: '1rem', margin: '1rem 0 0.75rem' }}>Phase durations (ms)</h3>
            <div className="grid grid-4" style={{ gap: '0.75rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Announcement</label>
                <input
                  data-copilot="announcementMs"
                  type="number"
                  min={1000}
                  value={draft.durations.announcementMs}
                  onChange={(e) => setDraft({ ...draft, durations: { ...draft.durations, announcementMs: Number(e.target.value) || 1000 } })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Communication</label>
                <input
                  data-copilot="communicationMs"
                  type="number"
                  min={2000}
                  value={draft.durations.communicationMs}
                  onChange={(e) => setDraft({ ...draft, durations: { ...draft.durations, communicationMs: Number(e.target.value) || 2000 } })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Action</label>
                <input
                  data-copilot="actionMs"
                  type="number"
                  min={2000}
                  value={draft.durations.actionMs}
                  onChange={(e) => setDraft({ ...draft, durations: { ...draft.durations, actionMs: Number(e.target.value) || 2000 } })}
                  style={{ width: '100%' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: 6 }}>Revelation</label>
                <input
                  data-copilot="revelationMs"
                  type="number"
                  min={500}
                  value={draft.durations.revelationMs}
                  onChange={(e) => setDraft({ ...draft, durations: { ...draft.durations, revelationMs: Number(e.target.value) || 500 } })}
                  style={{ width: '100%' }}
                />
              </div>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <label style={{ display: 'block', marginBottom: 6, fontWeight: 500 }}>Hint to Copilot (optional)</label>
              <input
                data-copilot="hint"
                type="text"
                value={copilotHint}
                onChange={(e) => setCopilotHint(e.target.value)}
                placeholder="e.g., prefer cooperative equilibria with quick rounds"
                style={{ width: '100%' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.25rem' }}>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  try {
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
                    alert('Draft saved locally.');
                  } catch {}
                }}
              >
                Save Draft
              </button>
              <button
                className="secondary"
                type="button"
                onClick={() => {
                  const text = JSON.stringify(preview, null, 2);
                  navigator.clipboard?.writeText(text).then(() => alert('JSON copied to clipboard.')).catch(() => {});
                }}
              >
                Copy JSON
              </button>
            </div>
          </form>
        </div>

        {/* Right: preview & Copilot anchors */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontSize: '1.125rem' }}>Preview JSON</h2>
            <span style={{ fontSize: 12, color: '#888' }}>Copilot-ready</span>
          </div>
          <pre
            id="copilot-preview"
            data-copilot="preview-json"
            style={{
              background: '#0b1020',
              color: '#e6edf3',
              padding: '1rem',
              borderRadius: 8,
              overflow: 'auto',
              maxHeight: 380,
            }}
          >{JSON.stringify(preview, null, 2)}</pre>

          <div
            id="copilotkit-panel-anchor"
            data-copilot="panel-anchor"
            style={{ marginTop: '1rem', padding: '0.75rem', border: '1px dashed #aaa', borderRadius: 8 }}
          >
            <strong>Copilot Panel Anchor</strong>
            <p style={{ margin: '0.5rem 0 0', fontSize: 12, color: '#666' }}>
              When CopilotKit is enabled, mount the assistant panel here to read the form and suggest a configuration.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
