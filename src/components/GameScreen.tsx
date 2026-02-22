import { useGameEngine } from '../engine/useGameEngine';
import GameBoard from './GameBoard';

interface GameScreenProps {
  playerName: string;
  onPlayAgain: () => void;
  onBackToLobby: () => void;
}

export default function GameScreen({ playerName, onPlayAgain, onBackToLobby }: GameScreenProps) {
  const engine = useGameEngine(playerName || 'Player');

  return (
    <GameBoard
      engine={engine}
      onPlayAgain={onPlayAgain}
    />
  );
}
