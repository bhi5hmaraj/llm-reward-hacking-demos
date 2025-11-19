/**
 * Lobby Page
 *
 * Waiting room where players join before game starts.
 * Shows player list and lobby code.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { colyseusService } from '../services/colyseus.service';

export default function LobbyPage() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const role = searchParams.get('role') || 'player';
  const lobbyCode = searchParams.get('code') || experimentId?.slice(-6).toUpperCase();

  const [connected, setConnected] = useState(false);
  const [waitingPlayers, setWaitingPlayers] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [experimentName, setExperimentName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    joinLobby();

    return () => {
      colyseusService.leaveRoom();
    };
  }, []);

  const joinLobby = async () => {
    try {
      const room = await colyseusService.joinLobby(
        experimentId!,
        role as 'experimenter' | 'player',
        role === 'player' ? 'Player' : undefined
      );

      setConnected(true);

      // Listen for state changes
      room.state.onChange = () => {
        setWaitingPlayers([...room.state.waitingPlayers]);
        setIsReady(room.state.isReady);
        setExperimentName(room.state.experimentName);
      };

      // Listen for game start
      room.onMessage('game_started', (message) => {
        console.log('Game started, joining game room:', message.gameRoomId);
        navigate(`/game/${message.gameRoomId}?role=${role}`);
      });

      room.onMessage('lobby_ready', (message) => {
        console.log('Lobby ready:', message);
      });

      room.onError((code, message) => {
        setError(`Error ${code}: ${message}`);
      });
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStartGame = () => {
    colyseusService.requestGameStart();
  };

  if (error) {
    return (
      <div className="container">
        <div className="card" style={{ maxWidth: '600px', margin: '3rem auto', background: '#ffebee' }}>
          <h2 style={{ color: '#c62828', marginBottom: '1rem' }}>Error</h2>
          <p>{error}</p>
          <button className="primary" onClick={() => navigate('/')} style={{ marginTop: '1rem' }}>
            Return Home
          </button>
        </div>
      </div>
    );
  }

  if (!connected) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <p>Connecting to lobby...</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: '700px', paddingTop: '2rem' }}>
      <div className="card" style={{ marginBottom: '2rem', background: '#e3f2fd' }}>
        <h1 style={{ marginBottom: '1rem' }}>{experimentName || 'Experiment Lobby'}</h1>

        <div style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.5rem' }}>
          Lobby Code: {lobbyCode}
        </div>

        <p style={{ fontSize: '0.875rem', color: '#666' }}>
          {role === 'experimenter'
            ? 'Share this code with players to let them join'
            : 'Waiting for all players to join...'}
        </p>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>
          Players ({waitingPlayers.length} joined)
        </h2>

        {waitingPlayers.length === 0 ? (
          <p style={{ color: '#666', textAlign: 'center', padding: '2rem' }}>
            Waiting for players to join...
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {waitingPlayers.map((player) => (
              <div
                key={player.sessionId}
                style={{
                  padding: '1rem',
                  background: '#f5f5f5',
                  borderRadius: '4px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div>
                  <strong>{player.name}</strong>
                  <span style={{ marginLeft: '1rem', color: '#666', fontSize: '0.875rem' }}>
                    ({player.slot})
                  </span>
                </div>
                <span style={{ color: '#4CAF50', fontSize: '0.875rem' }}>✓ Connected</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {role === 'experimenter' && (
        <div className="card">
          {isReady ? (
            <div>
              <p style={{ marginBottom: '1rem', color: '#4CAF50' }}>
                ✓ All players have joined. Ready to start!
              </p>
              <button
                className="primary"
                onClick={handleStartGame}
                style={{ width: '100%', padding: '1rem', fontSize: '1rem' }}
              >
                Start Experiment
              </button>
            </div>
          ) : (
            <p style={{ color: '#666', textAlign: 'center' }}>
              Waiting for all players to join before starting...
            </p>
          )}
        </div>
      )}

      {role === 'player' && (
        <div className="card" style={{ background: '#fff3cd' }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            You're in the lobby. The experimenter will start the game when everyone is ready.
          </p>
        </div>
      )}
    </div>
  );
}
