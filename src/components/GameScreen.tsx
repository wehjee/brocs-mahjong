import { useGameEngine } from '../engine/useGameEngine';
import { useMultiplayerEngine } from '../engine/useMultiplayerEngine';
import GameBoard from './GameBoard';

interface GameScreenProps {
  playerName: string;
  gameMode: 'singleplayer' | 'multiplayer';
  roomCode: string;
  partyHost: string;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

// Split into two components to avoid conditional hooks

function SinglePlayerGame({ playerName, onPlayAgain }: { playerName: string; onPlayAgain: () => void }) {
  const engine = useGameEngine(playerName || 'Player');
  return <GameBoard engine={engine} onPlayAgain={onPlayAgain} />;
}

function MultiplayerGame({ playerName, roomCode, partyHost, onPlayAgain }: {
  playerName: string;
  roomCode: string;
  partyHost: string;
  onPlayAgain: () => void;
}) {
  const engine = useMultiplayerEngine({
    host: partyHost,
    roomCode,
    playerName: playerName || 'Player',
  });
  return <GameBoard engine={engine} onPlayAgain={onPlayAgain} />;
}

export default function GameScreen({
  playerName,
  gameMode,
  roomCode,
  partyHost,
  onPlayAgain,
  onBackToLobby: _onBackToLobby,
}: GameScreenProps) {
  void _onBackToLobby;

  if (gameMode === 'multiplayer') {
    return (
      <MultiplayerGame
        playerName={playerName}
        roomCode={roomCode}
        partyHost={partyHost}
        onPlayAgain={onPlayAgain}
      />
    );
  }

  return (
    <SinglePlayerGame
      playerName={playerName}
      onPlayAgain={onPlayAgain}
    />
  );
}
