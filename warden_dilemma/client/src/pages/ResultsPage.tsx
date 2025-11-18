/**
 * Results Page
 *
 * Displays experiment results and analytics.
 */

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiService } from '../services/api.service';

export default function ResultsPage() {
  const { experimentId } = useParams<{ experimentId: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [experiment, setExperiment] = useState<any>(null);
  const [metrics, setMetrics] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadResults();
  }, []);

  const loadResults = async () => {
    try {
      const data = await apiService.getExperimentResults(experimentId!);
      setExperiment(data.experiment);
      setMetrics(data.metrics);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="container" style={{ textAlign: 'center', paddingTop: '3rem' }}>
        <p>Loading results...</p>
      </div>
    );
  }

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

  return (
    <div className="container" style={{ maxWidth: '900px', paddingTop: '2rem' }}>
      <h1 style={{ marginBottom: '0.5rem' }}>{experiment.name}</h1>
      <p style={{ color: '#666', marginBottom: '2rem' }}>
        Status: <strong>{experiment.status}</strong>
      </p>

      {/* Summary */}
      <div className="card" style={{ marginBottom: '2rem' }}>
        <h2 style={{ marginBottom: '1rem' }}>Summary</h2>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1.5rem' }}>
          <div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#2196F3' }}>
              {metrics?.totalRounds || 0}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Total Rounds</div>
          </div>

          <div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#4CAF50' }}>
              {((metrics?.overallCooperationRate || 0) * 100).toFixed(1)}%
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Cooperation Rate</div>
          </div>

          <div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', color: '#FF9800' }}>
              {metrics?.averagePayoffPerRound?.toFixed(1) || 0}
            </div>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>Avg Payoff/Round</div>
          </div>
        </div>
      </div>

      {/* Cooperation Over Time */}
      {metrics?.cooperationByRound && metrics.cooperationByRound.length > 0 && (
        <div className="card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ marginBottom: '1rem' }}>Cooperation Rate by Round</h2>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '4px', height: '200px' }}>
            {metrics.cooperationByRound.map((rate: number, i: number) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: `${rate * 100}%`,
                  background: '#4CAF50',
                  borderRadius: '2px 2px 0 0',
                  minHeight: '2px',
                }}
                title={`Round ${i + 1}: ${(rate * 100).toFixed(0)}%`}
              />
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.5rem', fontSize: '0.75rem', color: '#666' }}>
            <span>Round 1</span>
            <span>Round {metrics.cooperationByRound.length}</span>
          </div>
        </div>
      )}

      {/* Round Details */}
      {experiment.rounds && experiment.rounds.length > 0 && (
        <div className="card">
          <h2 style={{ marginBottom: '1rem' }}>Round History</h2>

          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead style={{ background: '#f5f5f5', position: 'sticky', top: 0 }}>
                <tr>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>
                    Round
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>
                    Actions
                  </th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', border: '1px solid #ddd' }}>
                    Payoffs
                  </th>
                </tr>
              </thead>
              <tbody>
                {experiment.rounds.map((round: any) => {
                  const actions = round.actions as Record<string, string>;
                  const payoffs = round.payoffs as Record<string, number>;

                  return (
                    <tr key={round.roundNumber}>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {round.roundNumber}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {Object.entries(actions)
                          .map(([id, action]) => `${id}: ${action}`)
                          .join(', ')}
                      </td>
                      <td style={{ padding: '0.75rem', border: '1px solid #ddd' }}>
                        {Object.entries(payoffs)
                          .map(([id, payoff]) => `${id}: ${payoff}`)
                          .join(', ')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div style={{ marginTop: '2rem', textAlign: 'center' }}>
        <button className="secondary" onClick={() => navigate('/')}>
          Back to Home
        </button>
      </div>
    </div>
  );
}
