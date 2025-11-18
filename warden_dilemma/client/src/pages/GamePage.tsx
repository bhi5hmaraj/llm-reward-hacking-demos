/**
 * Game Page
 *
 * Main game interface for players and experimenter dashboard.
 * Shows current phase, payoff matrix, chat, and action selection.
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { colyseusService } from '../services/colyseus.service';
import { GamePhase, PayoffMatrix, PlayerAction, PlayerState } from '../types';

export default function GamePage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const role = searchParams.get('role') || 'player';
  const [connected, setConnected] = useState(false);

  // Game state
  const [phase, setPhase] = useState<GamePhase>('waiting');
  const [currentRound, setCurrentRound] = useState(0);
  const [totalRounds, setTotalRounds] = useState(0);
  const [phaseEndsAt, setPhaseEndsAt] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState(0);

  const [payoffMatrix, setPayoffMatrix] = useState<PayoffMatrix | null>(null);
  const [players, setPlayers] = useState<Map<string, PlayerState>>(new Map());
  const [myPlayerId, setMyPlayerId] = useState<string>('');
  const [chatMessages, setChatMessages] = useState<any[]>([]);

  // Action selection
  const [selectedAction, setSelectedAction] = useState<PlayerAction | null>(null);
  const [actionSubmitted, setActionSubmitted] = useState(false);

  // Chat
  const [chatTarget, setChatTarget] = useState<string>('');
  const [chatInput, setChatInput] = useState('');

  useEffect(() => {
    joinGame();

    return () => {
      colyseusService.leaveRoom();
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    const interval = setInterval(() => {
      if (phaseEndsAt > 0) {
        const remaining = Math.max(0, Math.floor((phaseEndsAt - Date.now()) / 1000));
        setTimeRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [phaseEndsAt]);

  const joinGame = async () => {
    try {
      const room = await colyseusService.joinGame(
        roomId!,
        role as 'experimenter' | 'player'
      );

      setConnected(true);

      // Listen for player assignment
      room.onMessage('player_connected', (message) => {
        setMyPlayerId(message.playerId);
      });

      // Listen for game state changes
      room.state.listen('phase', (value) => setPhase(value));
      room.state.listen('currentRound', (value) => setCurrentRound(value));
      room.state.listen('totalRounds', (value) => setTotalRounds(value));
      room.state.listen('phaseEndsAt', (value) => setPhaseEndsAt(value));
      room.state.listen('currentPayoffMatrix', (value) => {
        if (value) {
          setPayoffMatrix(JSON.parse(value));
        }
      });

      // Listen for player updates
      room.state.players.onAdd = (player, key) => {
        console.log('Player added:', key, player);
      };

      room.state.players.onChange = (player, key) => {
        setPlayers(new Map(room.state.players));
      };

      // Listen for chat messages
      room.onMessage('chat_message', (message) => {
        setChatMessages((prev) => [...prev, message]);
      });

      // Listen for phase start
      room.onMessage('phase_start', (message) => {
        console.log('Phase started:', message.phase);
        if (message.phase === 'action') {
          setActionSubmitted(false);
          setSelectedAction(null);
        }
      });

      // Listen for action confirmed
      room.onMessage('action_confirmed', () => {
        setActionSubmitted(true);
      });

      // Listen for game end
      room.onMessage('game_ended', (message) => {
        console.log('Game ended:', message);
        alert(`Game Over! Check results.`);
        // Could navigate to results page
      });

      room.onError((code, message) => {
        alert(`Error ${code}: ${message}`);
      });

      // Request start if experimenter and waiting
      if (role === 'experimenter') {
        setTimeout(() => {
          colyseusService.sendExperimenterStart();
        }, 1000);
      }
    } catch (err) {
      alert((err as Error).message);
      navigate('/');
    }
  };

  const handleSubmitAction = () => {
    if (selectedAction) {
      colyseusService.submitAction(selectedAction);
    }
  };

  const handleSendChat = () => {
    if (chatTarget && chatInput.trim()) {
      colyseusService.sendChat(chatTarget, chatInput);
      setChatInput('');
    }
  };

  if (!connected) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <p>Connecting to game...</p>
      </div>
    );
  }

  const myPlayer = players.get(myPlayerId);
  const otherPlayers = Array.from(players.values()).filter((p) => p.id !== myPlayerId);

  return (
    <div style={{ padding: '1rem', minHeight: '100vh', background: '#f5f5f5' }}>
      {/* Header */}
      <div className="card" style={{ marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.25rem' }}>
              Round {currentRound} / {totalRounds}
            </h2>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>
              Phase: <strong style={{ color: '#2196F3' }}>{phase.toUpperCase()}</strong>
              {timeRemaining > 0 && ` • ${timeRemaining}s remaining`}
            </div>
          </div>

          {myPlayer && (
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 'bold' }}>
                Score: {myPlayer.cumulativeScore}
              </div>
              <div style={{ fontSize: '0.875rem', color: '#666' }}>
                Opt-outs: {myPlayer.refusalsRemaining}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1rem' }}>
        {/* Main Column */}
        <div>
          {/* Payoff Matrix */}
          {payoffMatrix && (
            <div className="card" style={{ marginBottom: '1rem' }}>
              <h3 style={{ marginBottom: '1rem' }}>Payoff Matrix</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#f5f5f5' }}>
                    <th style={{ padding: '0.5rem', border: '1px solid #ddd' }}>Your Action</th>
                    {payoffMatrix.cooperate.map((_, i) => (
                      <th key={i} style={{ padding: '0.5rem', border: '1px solid #ddd' }}>
                        {i} others cooperate
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd', fontWeight: 'bold' }}>
                      Cooperate
                    </td>
                    {payoffMatrix.cooperate.map((val, i) => (
                      <td key={i} style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd', fontWeight: 'bold' }}>
                      Defect
                    </td>
                    {payoffMatrix.defect.map((val, i) => (
                      <td key={i} style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}>
                        {val}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ padding: '0.5rem', border: '1px solid #ddd', fontWeight: 'bold' }}>
                      Opt-Out
                    </td>
                    <td
                      colSpan={payoffMatrix.cooperate.length}
                      style={{ padding: '0.5rem', border: '1px solid #ddd', textAlign: 'center' }}
                    >
                      {payoffMatrix.optOut}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Chat (Communication Phase) */}
          {phase === 'communication' && role === 'player' && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Chat</h3>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                  Send message to:
                </label>
                <select
                  value={chatTarget}
                  onChange={(e) => setChatTarget(e.target.value)}
                  style={{ width: '100%', marginBottom: '0.5rem' }}
                >
                  <option value="">Select player...</option>
                  {otherPlayers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: '1rem', maxHeight: '200px', overflowY: 'auto', padding: '0.5rem', background: '#f9f9f9', borderRadius: '4px' }}>
                {chatMessages.length === 0 ? (
                  <p style={{ color: '#999', fontSize: '0.875rem', textAlign: 'center' }}>No messages yet</p>
                ) : (
                  chatMessages.map((msg, i) => (
                    <div key={i} style={{ marginBottom: '0.5rem', fontSize: '0.875rem' }}>
                      <strong>{msg.from === myPlayerId ? 'You' : players.get(msg.from)?.name}:</strong>{' '}
                      {msg.content}
                    </div>
                  ))
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendChat()}
                  placeholder="Type your message..."
                  style={{ flex: 1 }}
                  disabled={!chatTarget}
                />
                <button
                  className="secondary"
                  onClick={handleSendChat}
                  disabled={!chatTarget || !chatInput.trim()}
                >
                  Send
                </button>
              </div>
            </div>
          )}

          {/* Action Selection */}
          {phase === 'action' && role === 'player' && !actionSubmitted && (
            <div className="card">
              <h3 style={{ marginBottom: '1rem' }}>Choose Your Action</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <button
                  onClick={() => setSelectedAction('C')}
                  style={{
                    padding: '2rem 1rem',
                    background: selectedAction === 'C' ? '#4CAF50' : '#e3f2fd',
                    border: selectedAction === 'C' ? '2px solid #2e7d32' : '2px solid #90caf9',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: selectedAction === 'C' ? 'white' : '#0d47a1',
                  }}
                >
                  Cooperate
                </button>

                <button
                  onClick={() => setSelectedAction('D')}
                  style={{
                    padding: '2rem 1rem',
                    background: selectedAction === 'D' ? '#f44336' : '#ffebee',
                    border: selectedAction === 'D' ? '2px solid #c62828' : '2px solid #ef9a9a',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: selectedAction === 'D' ? 'white' : '#b71c1c',
                  }}
                >
                  Defect
                </button>

                <button
                  onClick={() => setSelectedAction('OPT_OUT')}
                  disabled={!myPlayer || myPlayer.refusalsRemaining <= 0}
                  style={{
                    padding: '2rem 1rem',
                    background: selectedAction === 'OPT_OUT' ? '#9e9e9e' : '#f5f5f5',
                    border: selectedAction === 'OPT_OUT' ? '2px solid #424242' : '2px solid #bdbdbd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '1.125rem',
                    fontWeight: 'bold',
                    color: selectedAction === 'OPT_OUT' ? 'white' : '#424242',
                  }}
                >
                  Opt-Out
                  {myPlayer && (
                    <div style={{ fontSize: '0.75rem', marginTop: '0.25rem' }}>
                      ({myPlayer.refusalsRemaining} left)
                    </div>
                  )}
                </button>
              </div>

              <button
                className="primary"
                onClick={handleSubmitAction}
                disabled={!selectedAction}
                style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
              >
                Submit Action
              </button>
            </div>
          )}

          {actionSubmitted && phase === 'action' && (
            <div className="card" style={{ background: '#e8f5e9', textAlign: 'center', padding: '2rem' }}>
              <h3 style={{ color: '#2e7d32', marginBottom: '0.5rem' }}>✓ Action Submitted</h3>
              <p style={{ color: '#666' }}>Waiting for other players...</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div>
          {/* Players */}
          <div className="card" style={{ marginBottom: '1rem' }}>
            <h3 style={{ marginBottom: '1rem' }}>Players</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {Array.from(players.values())
                .sort((a, b) => b.cumulativeScore - a.cumulativeScore)
                .map((p) => (
                  <div
                    key={p.id}
                    style={{
                      padding: '0.75rem',
                      background: p.id === myPlayerId ? '#e3f2fd' : '#f5f5f5',
                      borderRadius: '4px',
                      fontSize: '0.875rem',
                    }}
                  >
                    <div style={{ fontWeight: 'bold', marginBottom: '0.25rem' }}>
                      {p.name} {p.id === myPlayerId && '(You)'}
                    </div>
                    <div style={{ color: '#666' }}>
                      Score: <strong>{p.cumulativeScore}</strong>
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Phase Info */}
          <div className="card" style={{ background: '#fff3cd' }}>
            <h4 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>Current Phase</h4>
            <p style={{ fontSize: '0.875rem', margin: 0 }}>
              {phase === 'waiting' && 'Waiting for game to start...'}
              {phase === 'announcement' && 'Review the payoff matrix for this round.'}
              {phase === 'communication' && 'Discuss strategy with other players.'}
              {phase === 'action' && 'Choose your action: Cooperate, Defect, or Opt-Out.'}
              {phase === 'revelation' && 'Results are being revealed...'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
