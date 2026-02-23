import { useState, useCallback } from 'react';
import HomePage from './components/HomePage';
import Lobby from './components/Lobby';
import GameScreen from './components/GameScreen';

type Screen = 'home' | 'lobby' | 'game';
type GameMode = 'singleplayer' | 'multiplayer';

const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [playerName, setPlayerName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [gameMode, setGameMode] = useState<GameMode>('singleplayer');
  const [gameKey, setGameKey] = useState(0);

  // ── Play Solo (skip lobby, go straight to game with AI) ──────────
  const handlePlaySolo = useCallback((name: string) => {
    setPlayerName(name);
    setGameMode('singleplayer');
    setGameKey(k => k + 1);
    setScreen('game');
  }, []);

  // ── Create multiplayer room ──────────────────────────────────────
  const handleCreateRoom = useCallback((name: string) => {
    setPlayerName(name);
    const code = generateRoomCode();
    setRoomCode(code);
    setGameMode('multiplayer');
    setScreen('lobby');
  }, []);

  // ── Join existing multiplayer room ───────────────────────────────
  const handleJoinRoom = useCallback((name: string, code: string) => {
    setPlayerName(name);
    setRoomCode(code);
    setGameMode('multiplayer');
    setScreen('lobby');
  }, []);

  // ── Start game from lobby ────────────────────────────────────────
  const handleStartGame = useCallback(() => {
    setGameKey(k => k + 1);
    setScreen('game');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameKey(k => k + 1);
  }, []);

  const handleLeave = useCallback(() => {
    setScreen('home');
    setRoomCode('');
  }, []);

  const handleBackToLobby = useCallback(() => {
    setScreen('lobby');
  }, []);

  const screenContent = (() => {
    switch (screen) {
      case 'home':
        return (
          <HomePage
            onCreateRoom={handleCreateRoom}
            onJoinRoom={handleJoinRoom}
            onPlaySolo={handlePlaySolo}
          />
        );
      case 'lobby':
        return (
          <Lobby
            roomCode={roomCode}
            playerName={playerName}
            partyHost={PARTYKIT_HOST}
            onStartGame={handleStartGame}
            onLeave={handleLeave}
          />
        );
      case 'game':
        return (
          <GameScreen
            key={gameKey}
            playerName={playerName}
            gameMode={gameMode}
            roomCode={roomCode}
            partyHost={PARTYKIT_HOST}
            onPlayAgain={handlePlayAgain}
            onBackToLobby={handleBackToLobby}
          />
        );
    }
  })();

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg-deep)',
    }}>
      {screenContent}
    </div>
  );
}

function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default App;
