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

  const inferredRole = (() => {
    const stored = experimentId ? sessionStorage.getItem(`role:${experimentId}`) : null;
    return (stored as 'experimenter' | 'player') || 'player';
  })();
  const lobbyCode = searchParams.get('code') || experimentId?.slice(-6).toUpperCase();

  const [connected, setConnected] = useState(false);
  const [waitingPlayers, setWaitingPlayers] = useState<any[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [experimentName, setExperimentName] = useState('');
  const [experimenterConnected, setExperimenterConnected] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [requiredPlayers, setRequiredPlayers] = useState<number>(0);
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
        inferredRole,
        inferredRole === 'player' ? 'Player' : undefined
      );

      setConnected(true);
      setRoomId(room.id);

      // Initialize local UI state from the current room state
      console.log('[Lobby] Initial state:', {
        waitingPlayers: room.state.waitingPlayers.length,
        isReady: room.state.isReady,
        experimentName: room.state.experimentName,
        requiredPlayers: (room.state as any).requiredPlayers,
        experimenterConnected: (room.state as any).experimenterConnected,
      });

      setWaitingPlayers([...room.state.waitingPlayers]);
      setIsReady(room.state.isReady);
      setExperimentName(room.state.experimentName);
      setRequiredPlayers((room.state as any).requiredPlayers || 0);
      setExperimenterConnected(!!(room.state as any).experimenterConnected);

      // Correctly subscribe to schema change events
      // Note: onChange is a METHOD, not an assignable property
      const offRootChange = room.state.onChange(() => {
        console.log('[Lobby] state.onChange', {
          waitingCount: room.state.waitingPlayers.length,
          waitingPlayers: [...room.state.waitingPlayers],
          isReady: room.state.isReady,
          experimentName: room.state.experimentName,
          experimenterConnected: (room.state as any).experimenterConnected,
        });
        setWaitingPlayers([...room.state.waitingPlayers]);
        setIsReady(room.state.isReady);
        setExperimentName(room.state.experimentName);
        setRequiredPlayers((room.state as any).requiredPlayers || 0);
        // new field from server
        // @ts-ignore
        setExperimenterConnected(!!room.state.experimenterConnected);
      });

      // Additionally, track fine-grained changes on the waitingPlayers array
      const offAdd = room.state.waitingPlayers.onAdd?.((player: any, index: number) => {
        console.log('[Lobby] waitingPlayers.onAdd', { index, player });
        setWaitingPlayers([...room.state.waitingPlayers]);
      });
      const offRemove = room.state.waitingPlayers.onRemove?.((player: any, index: number) => {
        console.log('[Lobby] waitingPlayers.onRemove', { index, player });
        setWaitingPlayers([...room.state.waitingPlayers]);
      });

      // Clean up listeners when leaving the page/room
      room.onLeave.once(() => {
        offRootChange && offRootChange();
        offAdd && offAdd();
        offRemove && offRemove();
      });

      // Listen for game start
      room.onMessage('game_started', (message) => {
        console.log('Game started, joining game room:', message.gameRoomId);
        navigate(`/game/${message.gameRoomId}?experimentId=${experimentId}`);
      });

      room.onMessage('lobby_ready', (message) => {
        console.log('Lobby ready:', message);
      });

      // Capture assigned player id and token (for game join)
      room.onMessage('player_assigned', (msg: { playerId: string; slot: number; token?: string; experimentId?: string }) => {
        console.log('[Lobby] player_assigned', msg);
        colyseusService.setPlayerId(msg.playerId, experimentId!);
        if (msg.token) { colyseusService.setJoinToken(experimentId!, msg.token); }
        try { sessionStorage.setItem(`role:${experimentId}`, 'player'); } catch {}
      });

      // Capture experimenter join token
      room.onMessage('experimenter_token', (msg: { token: string; experimentId?: string }) => {
        console.log('[Lobby] experimenter_token');
        if (msg.token) { colyseusService.setJoinToken(experimentId!, msg.token); }
        try { sessionStorage.setItem(`role:${experimentId}`, 'experimenter'); } catch {}
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
      {/* Role Badge */}
      <div style={{
        marginBottom: '1rem',
        padding: '0.75rem 1.5rem',
        borderRadius: '8px',
        background: inferredRole === 'experimenter' ? '#4CAF50' : '#2196F3',
        color: 'white',
        fontSize: '1.1rem',
        fontWeight: 'bold',
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        {inferredRole === 'experimenter' ? '🔬 Experimenter' : '👤 Player'}
      </div>

      <div className="card" style={{ marginBottom: '2rem', background: '#e3f2fd' }}>
        <h1 style={{ marginBottom: '1rem' }}>{experimentName || 'Experiment Lobby'}</h1>

        <div className="lobby-code" style={{ marginBottom: '0.5rem' }}>Lobby Code: {lobbyCode}</div>

        <div className="grid grid-2" style={{ gap: '0.5rem' }}>
          <div style={{ fontSize: '0.9rem' }}>
            <strong>Room ID:</strong> {roomId?.substring(0, 8)}
          </div>
          <div style={{ fontSize: '0.9rem', textAlign: 'right' }}>
            <strong>Experimenter:</strong>{' '}
            <span style={{ color: experimenterConnected ? '#2e7d32' : '#c62828' }}>
              {experimenterConnected ? 'Connected' : 'Not connected'}
            </span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '2rem' }}>
        <div className="header-stats">
          <h2 style={{ marginBottom: '1rem' }}>Players</h2>
          <div style={{ fontSize: '0.95rem', color: '#333' }}>
            {waitingPlayers.length} / {requiredPlayers} joined
          </div>
        </div>

        <div style={{ marginBottom: '0.5rem', color: '#666', fontSize: '0.9rem' }}>
          Remaining: {Math.max(requiredPlayers - waitingPlayers.length, 0)}
        </div>

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

      {/* Status / Actions */}
      {inferredRole === 'experimenter' && (
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

      {inferredRole === 'player' && (
        <div className="card" style={{ background: '#fff3cd' }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            You're in the lobby. The experimenter will start the game when everyone is ready.
          </p>
        </div>
      )}

      {/* Debug panel (toggle) */}
      <div style={{ marginTop: '1rem', textAlign: 'right' }}>
        <button className="secondary" onClick={() => setShowDebug((v) => !v)}>
          {showDebug ? 'Hide' : 'Show'} Debug
        </button>
      </div>
      {showDebug && (
        <div className="card" style={{ marginTop: '0.5rem', background: '#f6f6f6' }}>
          <div style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
            <div>roomId: {roomId || '(unknown)'}</div>
            <div>isReady: {String(isReady)}</div>
            <div>experimenterConnected: {String(experimenterConnected)}</div>
            <div>waitingPlayers.length: {waitingPlayers.length}</div>
          </div>
        </div>
      )}
    </div>
  );
}
