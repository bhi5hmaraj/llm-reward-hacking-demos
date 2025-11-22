/**
 * Main App Component
 *
 * Handles routing and top-level layout.
 */

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import HomePage from './pages/HomePage';
import CreateExperimentPage from './pages/CreateExperimentPage';
import LobbyPage from './pages/LobbyPage';
import GamePage from './pages/GamePage';
import ResultsPage from './pages/ResultsPage';
import CustomScenarioPage from './pages/CustomScenarioPage';

function App() {
  return (
    <BrowserRouter basename="/warden_dilemma">
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <header style={{
          background: '#2c3e50',
          color: 'white',
          padding: '1rem 2rem',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        }}>
          <div style={{ maxWidth: '1200px', margin: '0 auto', display: 'flex', alignItems: 'center', gap: '2rem' }}>
            <Link to="/" style={{ textDecoration: 'none', color: 'white' }}>
              <h1 style={{ margin: 0, fontSize: '1.5rem' }}>🎮 Warden's Dilemma</h1>
            </Link>
            <nav style={{ display: 'flex', gap: '1.5rem' }}>
              <Link to="/" style={{ color: 'white', textDecoration: 'none' }}>Home</Link>
              <Link to="/create" style={{ color: 'white', textDecoration: 'none' }}>New Experiment</Link>
              <Link to="/custom" style={{ color: 'white', textDecoration: 'none' }}>Custom Scenario</Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main style={{ flex: 1 }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/create" element={<CreateExperimentPage />} />
            <Route path="/custom" element={<CustomScenarioPage />} />
            <Route path="/lobby/:experimentId" element={<LobbyPage />} />
            <Route path="/game/:roomId" element={<GamePage />} />
            <Route path="/results/:experimentId" element={<ResultsPage />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer style={{
          background: '#34495e',
          color: '#ecf0f1',
          padding: '1rem',
          textAlign: 'center',
          marginTop: 'auto',
        }}>
          <p style={{ margin: 0, fontSize: '0.875rem' }}>
            Warden's Dilemma - Symmetric N-Player Prisoner's Dilemma Platform
          </p>
        </footer>
      </div>
    </BrowserRouter>
  );
}

export default App;
