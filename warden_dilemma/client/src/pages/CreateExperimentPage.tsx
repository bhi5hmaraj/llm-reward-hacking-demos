/**
 * Create Experiment Page
 *
 * Form for experimenters to configure and create new experiments.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';
import { ExperimentConfig, PlayerType } from '../types';

export default function CreateExperimentPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [numPlayers, setNumPlayers] = useState(3);
  const [numRounds, setNumRounds] = useState(10);
  const [maxRefusals, setMaxRefusals] = useState(3);
  const [preset, setPreset] = useState('static');
  // Phase durations (ms)
  const [announcementMs, setAnnouncementMs] = useState(10000);
  const [communicationMs, setCommunicationMs] = useState(180000);
  const [actionMs, setActionMs] = useState(30000);
  const [revelationMs, setRevelationMs] = useState(5000);

  // Player types (simple version - all human for MVP)
  const [playerTypes, setPlayerTypes] = useState<PlayerType[]>(Array(3).fill('human'));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      // Build configuration
      const config: ExperimentConfig = {
        numPlayers,
        numRounds,
        maxRefusals,
        payoffOrdering: {
          order: ['T₂', 'R₃', 'T₁', 'S₂', 'P₀', 'S₁'],
        },
        payoffBounds: { min: 0, max: 100 },
        payoffGenerator: {
          type: 'preset',
          preset,
        },
        players: Array.from({ length: numPlayers }, (_, i) => ({
          slot: i,
          type: playerTypes[i] || 'human',
        })),
        // durations (ms)
        announcementDuration: announcementMs,
        communicationDuration: communicationMs,
        actionDuration: actionMs,
        revelationDuration: revelationMs,
      };

      // Create experiment
      const response = await apiService.createExperiment({
        name,
        config,
      });

      console.log('Experiment created:', response);

      // Mark role in session and navigate to lobby (no role in URL)
      try { sessionStorage.setItem(`role:${response.experimentId}`, 'experimenter'); } catch {}
      navigate(`/lobby/${response.experimentId}?code=${response.lobbyCode}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleNumPlayersChange = (n: number) => {
    setNumPlayers(n);
    setPlayerTypes(Array(n).fill('human'));
  };

  return (
    <div className="container" style={{ maxWidth: '700px', paddingTop: '2rem' }}>
      <h1 style={{ marginBottom: '2rem' }}>Create New Experiment</h1>

      {error && (
        <div className="card" style={{ marginBottom: '1rem', background: '#ffebee', color: '#c62828' }}>
          <strong>Error:</strong> {error}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Basic Info</h2>

          <div style={{ marginBottom: '1rem' }}>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Experiment Name *
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="e.g., Trust Dynamics Study"
              style={{ width: '100%' }}
            />
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Game Parameters</h2>

          <div className="grid grid-2" style={{ gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Number of Players
              </label>
              <select
                value={numPlayers}
                onChange={(e) => handleNumPlayersChange(parseInt(e.target.value))}
                style={{ width: '100%' }}
              >
                {[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
                Number of Rounds
              </label>
              <input
                type="number"
                value={numRounds}
                onChange={(e) => setNumRounds(parseInt(e.target.value))}
                min="1"
                max="100"
                style={{ width: '100%' }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Max Opt-Outs per Player
            </label>
            <input
              type="number"
              value={maxRefusals}
              onChange={(e) => setMaxRefusals(parseInt(e.target.value))}
              min="0"
              max="10"
              style={{ width: '100%' }}
            />
            <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.25rem' }}>
              Number of times a player can opt out of a round
            </p>
          </div>

          {/* Phase durations */}
          <div style={{ marginTop: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.75rem' }}>Phase Durations (milliseconds)</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Announcement</label>
                <input type="number" min={500} step={500} value={announcementMs}
                  onChange={(e) => setAnnouncementMs(parseInt(e.target.value || '0'))}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Communication</label>
                <input type="number" min={1000} step={500} value={communicationMs}
                  onChange={(e) => setCommunicationMs(parseInt(e.target.value || '0'))}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Action</label>
                <input type="number" min={1000} step={500} value={actionMs}
                  onChange={(e) => setActionMs(parseInt(e.target.value || '0'))}
                  style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ display: 'block', marginBottom: '0.5rem' }}>Revelation</label>
                <input type="number" min={500} step={500} value={revelationMs}
                  onChange={(e) => setRevelationMs(parseInt(e.target.value || '0'))}
                  style={{ width: '100%' }} />
              </div>
            </div>
            <div style={{ marginTop: '0.75rem', display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="secondary" onClick={() => {
                setAnnouncementMs(2000);
                setCommunicationMs(10000);
                setActionMs(10000);
                setRevelationMs(2000);
              }}>
                Use Quick (2s/10s/10s/2s)
              </button>
              <button type="button" className="secondary" onClick={() => {
                setAnnouncementMs(10000);
                setCommunicationMs(180000);
                setActionMs(30000);
                setRevelationMs(5000);
              }}>
                Use Default (10s/180s/30s/5s)
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Payoff Generator</h2>

          <div>
            <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 500 }}>
              Preset
            </label>
            <select
              value={preset}
              onChange={(e) => setPreset(e.target.value)}
              style={{ width: '100%', marginBottom: '0.5rem' }}
            >
              <option value="static">Static (same every round)</option>
              <option value="random_walk">Random Walk (±20% noise)</option>
              <option value="adaptive_anti_coop">Adaptive Anti-Cooperation</option>
              <option value="escalating_stakes">Escalating Stakes</option>
            </select>

            {preset === 'static' && (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                Fixed payoffs: T₂=6, R₃=5, T₁=4, S₂=3, P₀=2, S₁=1
              </p>
            )}
            {preset === 'adaptive_anti_coop' && (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                Increases defection temptation when cooperation is high
              </p>
            )}
            {preset === 'escalating_stakes' && (
              <p style={{ fontSize: '0.875rem', color: '#666', marginTop: '0.5rem' }}>
                Payoffs multiply by round number (linear escalation)
              </p>
            )}
          </div>
        </div>

        <div className="card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>Players</h2>

          <p style={{ fontSize: '0.875rem', color: '#666', marginBottom: '1rem' }}>
            All players set to <strong>Human</strong> for MVP.
            AI and scripted players will be supported in Phase 2.
          </p>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            {playerTypes.map((_, i) => (
              <div
                key={i}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#e3f2fd',
                  borderRadius: '4px',
                  fontSize: '0.875rem',
                }}
              >
                Player {i + 1}: Human
              </div>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={() => navigate('/')}
            disabled={loading}
            style={{ background: '#ccc', color: '#333' }}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="primary"
            disabled={loading || !name.trim()}
          >
            {loading ? 'Creating...' : 'Create Experiment'}
          </button>
        </div>
      </form>

      <div className="card" style={{ marginTop: '2rem', background: '#fff3cd' }}>
        <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>💡 What happens next?</h3>
        <ol style={{ marginLeft: '1.5rem', fontSize: '0.875rem', lineHeight: '1.6' }}>
          <li>You'll be taken to the lobby with a unique lobby code</li>
          <li>Share the lobby code with {numPlayers} players</li>
          <li>Once all players join, you can start the experiment</li>
          <li>Monitor the game in real-time from the experimenter dashboard</li>
        </ol>
      </div>
    </div>
  );
}
