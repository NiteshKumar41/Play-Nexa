import { Link } from 'react-router-dom';
import { formatINR, games } from '../../data/mockData';

export function GameTile({ game }) {
  const gameCode = game.slug || game.id;
  const fallbackGame = games.find(item => item.id === gameCode);
  const minimumEntry = Number(game.minimum_entry ?? game.entry) || 50;

  return (
    <article className="game-tile">
      <div className={`game-art ${fallbackGame?.theme || ''}`}>
        {game.image_url
          ? <img src={game.image_url} alt={`${game.name} game`} loading="lazy" />
          : <span>{fallbackGame?.symbol || '🎮'}</span>}
        <small>{game.category}</small>
      </div>
      <div className="game-tile-info">
        <div>
          <h3>{game.name}</h3>
          <p>Game code: {gameCode}</p>
        </div>
        <div>
          <small>Entry from</small>
          <strong>{formatINR(minimumEntry)}</strong>
        </div>
      </div>
      <Link className="btn btn-secondary game-play" to={`/games/${gameCode}`}>
        Play <span>→</span>
      </Link>
    </article>
  );
}
