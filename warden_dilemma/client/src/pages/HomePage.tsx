/**
 * Home Page
 *
 * Landing page with quick start options.
 */

import { useNavigate } from 'react-router-dom';
import { useState } from 'react';

export default function HomePage() {
  const navigate = useNavigate();
  const [lobbyCode, setLobbyCode] = useState('');
  const [joinError, setJoinError] = useState<string | null>(null);

  const handleJoinAsPlayer = async () => {
    const code = lobbyCode.trim().toUpperCase();
    if (!code) return;
    setJoinError(null);

    try {
      const res = await fetch(`/warden_dilemma/api/experiments/resolve/${code}`);
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Failed to resolve code' }));
        throw new Error(error || 'Failed to resolve code');
      }
      const data = await res.json();
      try { sessionStorage.setItem(`role:${data.experimentId}`, 'player'); } catch {}
      navigate(`/lobby/${data.experimentId}?code=${code}`);
    } catch (err) {
      const msg = (err as Error).message || 'Unable to join lobby';
      setJoinError(msg);
      console.error('[Home] join failed', { code, msg });
    }
  };

  return (
    <div className="container" style={{ maxWidth: '800px', paddingTop: '3rem' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem', color: '#2c3e50' }}>
          Welcome to Warden's Dilemma
        </h1>
        <p style={{ fontSize: '1.125rem', color: '#666', lineHeight: '1.6' }}>
          A platform for studying strategic behavior in N-player iterated prisoner's dilemma games
          with private communication.
        </p>
      </div>

      <div className="grid grid-2" style={{ gap: '2rem', marginBottom: '3rem' }}>
        {/* Experimenter Card */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>🔬 Experimenter</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            Create and configure new experiments, monitor gameplay in real-time, and analyze results.
          </p>
          <button
            className="primary"
            onClick={() => navigate('/create')}
            style={{ width: '100%' }}
          >
            Create New Experiment
          </button>
        </div>

        {/* Player Card */}
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>🎮 Player</h2>
          <p style={{ marginBottom: '1.5rem', color: '#666' }}>
            Join an existing experiment using a lobby code provided by the experimenter.
          </p>
          <div className="grid grid-2" style={{ gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter lobby code"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              style={{ width: '100%' }}
              maxLength={6}
            />
            <button
              className="secondary"
              onClick={handleJoinAsPlayer}
              disabled={!lobbyCode.trim()}
              style={{ width: '100%' }}
            >
              Join
            </button>
            {joinError && (
              <div style={{ color: '#c62828', marginTop: '0.5rem', fontSize: '0.875rem' }}>
                {joinError}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>✨ Features</h2>
        <div className="grid grid-2" style={{ gap: '1.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>🔀 Symmetric Payoffs</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              N-player symmetric payoff structure based on cooperation count.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>💬 Private Chat</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Simultaneous 1:1 communication for coalition formation and deception.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>🤖 AI Players</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Mix human and AI agents (GPT-4, Claude) for hybrid experiments.
            </p>
          </div>
          <div>
            <h3 style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>📊 Analytics</h3>
            <p style={{ fontSize: '0.875rem', color: '#666' }}>
              Real-time monitoring with post-game coalition and deception analysis.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
