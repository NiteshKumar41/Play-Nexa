import { Link } from 'react-router-dom';
import { Gamepad2, ShieldCheck, Swords, Trophy, Wallet as WalletIcon } from 'lucide-react';
import { PageTitle, Panel } from '../../components/common';
import { formatINR, games, matches, player, transactions } from '../../data/mockData';
import { GameTile } from '../../components/games/GameCard'
import { TransactionRows } from '../../components/wallet/TransactionList'

function Stat({ icon: Icon, label, value, note, accent = '' }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${accent}`}><Icon size={18} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </article>
  );
}

export function Dashboard() {
  const activeMatches = matches.filter(match => match.status !== 'Completed');
  const popularGames = games.slice(0, 3);
  const recentTransactions = transactions.slice(0, 3);

  return (
    <>
      <PageTitle
        eyebrow="THURSDAY, OCTOBER 2, 2026"
        title="Good afternoon, Aarav"
        subtitle="Your next great match is just around the corner."
        action={(
          <Link to="/games" className="btn btn-primary">
            <Gamepad2 size={17} /> Find a match
          </Link>
        )}
      />

      <div className="stats-grid">
        <Stat icon={WalletIcon} accent="icon-indigo" label="Wallet balance" value={formatINR(player.balance)} note="Ready to play" />
        <Stat icon={Trophy} accent="icon-green" label="Today's earnings" value="₹1,240" note="↑ 18% from yesterday" />
        <Stat icon={Swords} accent="icon-amber" label="Matches played" value="48" note="32 wins · 67% win rate" />
        <Stat icon={ShieldCheck} accent="icon-blue" label="Skill rating" value="1,240" note="Gold league" />
      </div>

      <div className="content-grid">
        <Panel
          title="Popular games"
          subtitle="Find your next challenge"
          action={<Link className="text-link" to="/games">All games →</Link>}
        >
          <div className="game-grid">
            {popularGames.map(game => <GameTile key={game.id} game={game} />)}
          </div>
        </Panel>

        <Panel title="Active matches" subtitle="Pick up where you left off">
          <div className="compact-list">
            {activeMatches.map(match => (
              <div className="compact-row" key={match.id}>
                <span className={`game-mini ${match.game.toLowerCase().replaceAll(' ', '-')}`}>
                  {games.find(game => game.name === match.game)?.symbol}
                </span>
                <div className="row-grow">
                  <strong>{match.game} vs {match.opponent}</strong>
                  <small>{match.id} · Entry {formatINR(match.entry)}</small>
                </div>
                <Link className="text-link" to={`/match/${match.id}`}>Open →</Link>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel
        title="Recent transactions"
        subtitle="Your latest wallet activity"
        action={<Link className="text-link" to="/wallet">View wallet →</Link>}
      >
        <TransactionRows rows={recentTransactions} />
      </Panel>
    </>
  );
}
