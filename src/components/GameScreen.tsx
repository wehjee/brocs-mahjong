import { useGameEngine } from '../engine/useGameEngine';
import GameBoard from './GameBoard';

interface GameScreenProps {
  playerName: string;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export default function GameScreen({ playerName, onPlayAgain, onBackToLobby: _onBackToLobby }: GameScreenProps) {
  void _onBackToLobby;
  const engine = useGameEngine(playerName || 'Player');

  return (
    <GameBoard
      engine={engine}
      onPlayAgain={onPlayAgain}
    />
  );
}
