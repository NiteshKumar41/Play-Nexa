import { Link } from 'react-router-dom';
import { formatINR } from '../../utils/currency';
import { games as gameStyles } from '../../data/games';
import { GameImage } from './GameImage';

export function GameTile({ game }) {
  const gameCode = game.slug || String(game.gameCode ?? game.id);
  const visualFallback = gameStyles.find(item => item.name === game.name);
  const hasEntryAmount = game.minimum_entry != null || game.entry != null;
  const minimumEntry = Number(game.minimum_entry ?? game.entry);

  return (
    <article className="game-tile">
      <div className={`game-art ${visualFallback?.theme || ''}`}>
        {game.image_url
          ? <GameImage src={game.imageUrl || game.image_url} alt={`${game.name} game`} fallback={<span>{visualFallback?.symbol || '🎮'}</span>} />
          : <span>{visualFallback?.symbol || '🎮'}</span>}
        <small>{game.is_open === false ? 'Matchmaking closed' : game.category || 'Matchmaking open'}</small>
      </div>
      <div className="game-tile-info">
        <div>
          <h3>{game.name}</h3>
          <p>Game code: {gameCode}</p>
        </div>
        {hasEntryAmount && <div>
          <small>Entry from</small>
          <strong>{formatINR(minimumEntry)}</strong>
        </div>}
      </div>
      <Link className="btn btn-secondary game-play" to={`/games/${gameCode}`}>
        {game.is_open === false ? 'View game' : 'Play'} <span>→</span>
      </Link>
    </article>
  );
}
