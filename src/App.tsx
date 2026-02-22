import { useState, useCallback } from 'react';
import HomePage from './components/HomePage';
import Lobby from './components/Lobby';
import GameScreen from './components/GameScreen';
import type { LobbyPlayer } from './types/game';

type Screen = 'home' | 'lobby' | 'game';

function App() {
  const [screen, setScreen] = useState<Screen>('home');
  const [playerName, setPlayerName] = useState('');
  const [playerId] = useState('player-0');
  const [roomCode, setRoomCode] = useState('');
  const [lobbyPlayers, setLobbyPlayers] = useState<LobbyPlayer[]>([]);
  const [gameKey, setGameKey] = useState(0); // forces re-mount for new game

  const handleCreateRoom = useCallback((name: string) => {
    setPlayerName(name);
    const code = generateRoomCode();
    setRoomCode(code);
    setLobbyPlayers([
      { id: 'player-0', name, avatar: '🥦', isReady: false, isHost: true },
      { id: 'player-1', name: 'BrocBot', avatar: '🍄', isReady: true, isHost: false },
      { id: 'player-2', name: 'TileKing', avatar: '🌽', isReady: true, isHost: false },
      { id: 'player-3', name: 'MahJane', avatar: '🥕', isReady: true, isHost: false },
    ]);
    setScreen('lobby');
  }, []);

  const handleJoinRoom = useCallback((name: string, code: string) => {
    setPlayerName(name);
    setRoomCode(code);
    setLobbyPlayers([
      { id: 'host-1', name: 'HostPlayer', avatar: '🥦', isReady: true, isHost: true },
      { id: 'player-0', name, avatar: '🍄', isReady: false, isHost: false },
      { id: 'player-2', name: 'TileKing', avatar: '🌽', isReady: true, isHost: false },
    ]);
    setScreen('lobby');
  }, []);

  const handleToggleReady = useCallback(() => {
    setLobbyPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, isReady: !p.isReady } : p
    ));
  }, [playerId]);

  const handleStartGame = useCallback(() => {
    setGameKey(k => k + 1);
    setScreen('game');
  }, []);

  const handlePlayAgain = useCallback(() => {
    setGameKey(k => k + 1);
  }, []);

  const handleLeave = useCallback(() => {
    setScreen('home');
    setLobbyPlayers([]);
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
          />
        );
      case 'lobby':
        return (
          <Lobby
            roomCode={roomCode}
            players={lobbyPlayers}
            isHost={lobbyPlayers.find(p => p.id === playerId)?.isHost ?? false}
            onStartGame={handleStartGame}
            onLeave={handleLeave}
            onToggleReady={handleToggleReady}
            currentPlayerId={playerId}
          />
        );
      case 'game':
        return (
          <GameScreen
            key={gameKey}
            playerName={playerName}
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
