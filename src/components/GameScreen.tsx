import { useGameEngine } from '../engine/useGameEngine';
import { useMultiplayerEngine } from '../engine/useMultiplayerEngine';
import GameBoard from './GameBoard';

interface GameScreenProps {
  playerName: string;
  avatar: string;
  gameMode: 'singleplayer' | 'multiplayer';
  roomCode: string;
  partyHost: string;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

// Split into two components to avoid conditional hooks

function SinglePlayerGame({ playerName, avatar, onPlayAgain }: { playerName: string; avatar: string; onPlayAgain: () => void }) {
  const engine = useGameEngine(playerName || 'Player', avatar);
  return <GameBoard engine={engine} onPlayAgain={onPlayAgain} />;
}

function MultiplayerGame({ playerName, avatar, roomCode, partyHost, onPlayAgain }: {
  playerName: string;
  avatar: string;
  roomCode: string;
  partyHost: string;
  onPlayAgain: () => void;
}) {
  const engine = useMultiplayerEngine({
    host: partyHost,
    roomCode,
    playerName: playerName || 'Player',
    avatar,
  });
  return <GameBoard engine={engine} onPlayAgain={onPlayAgain} />;
}

export default function GameScreen({
  playerName,
  avatar,
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
        avatar={avatar}
        roomCode={roomCode}
        partyHost={partyHost}
        onPlayAgain={onPlayAgain}
      />
    );
  }

  return (
    <SinglePlayerGame
      playerName={playerName}
      avatar={avatar}
      onPlayAgain={onPlayAgain}
    />
  );
}
