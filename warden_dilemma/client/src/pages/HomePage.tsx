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

  const handleJoinAsPlayer = () => {
    if (lobbyCode.trim()) {
      // In a real app, we'd resolve lobby code to experiment ID
      navigate(`/lobby/${lobbyCode}`);
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

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem', marginBottom: '3rem' }}>
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
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              type="text"
              placeholder="Enter lobby code"
              value={lobbyCode}
              onChange={(e) => setLobbyCode(e.target.value.toUpperCase())}
              style={{ flex: 1 }}
              maxLength={6}
            />
            <button
              className="secondary"
              onClick={handleJoinAsPlayer}
              disabled={!lobbyCode.trim()}
            >
              Join
            </button>
          </div>
        </div>
      </div>

      {/* Features */}
      <div className="card">
        <h2 style={{ marginBottom: '1.5rem' }}>✨ Features</h2>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
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
