import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, ShieldCheck, Swords, Trophy, Wallet as WalletIcon } from 'lucide-react';
import { DataState, PageTitle, Panel } from '../../components/common';
import { matches } from '../../data/mockData';
import { GameTile } from '../../components/games/GameCard'
import { games as gameStyles } from '../../data/games';
import { TransactionRows } from '../../components/wallet/TransactionList'
import { useAuth } from '../../hooks/useAuth';
import { getTransactions, getWallet } from '../../services/walletService';
import { getGames } from '../../services/gameService';
import { formatINR } from '../../utils/currency';

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
  const { user } = useAuth();
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState('');
  const [transactionsLoading, setTransactionsLoading] = useState(true);
  const [transactionsError, setTransactionsError] = useState('');
  const [games, setGames] = useState([]);
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState('');

  const loadWalletSummary = useCallback(async () => {
    setWalletLoading(true);
    setTransactionsLoading(true);
    setWalletError('');
    setTransactionsError('');

    const [walletResult, transactionResult] = await Promise.allSettled([
      getWallet(),
      getTransactions({ page: 1, limit: 3 }),
    ]);

    if (walletResult.status === 'fulfilled') setWallet(walletResult.value);
    else setWalletError('Unable to load wallet balance. Please try again.');
    if (transactionResult.status === 'fulfilled') {
      setTransactions(transactionResult.value.transactions || []);
    } else {
      setTransactionsError('Unable to load transactions. Please try again.');
    }
    setWalletLoading(false);
    setTransactionsLoading(false);
  }, []);

  const loadGames = useCallback(async () => {
    setGamesLoading(true);
    setGamesError('');
    try {
      const availableGames = await getGames();
      setGames(availableGames.filter(game => game.is_active));
    } catch {
      setGamesError('Unable to load games. Please try again.');
    } finally {
      setGamesLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadWalletSummary();
    });
    return () => { cancelled = true; };
  }, [loadWalletSummary]);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) loadGames();
    });
    return () => { cancelled = true; };
  }, [loadGames]);

  const activeMatches = matches.filter(match => match.status !== 'Completed');
  const popularGames = games.slice(0, 3);

  return (
    <>
      <PageTitle
        eyebrow="THURSDAY, OCTOBER 2, 2026"
        title={`Good afternoon, ${user?.fullName || 'Player'}`}
        subtitle="Your next great match is just around the corner."
        action={(
          <Link to="/games" className="btn btn-primary">
            <Gamepad2 size={17} /> Find a match
          </Link>
        )}
      />

      <div className="stats-grid">
        <Stat icon={WalletIcon} accent="icon-indigo" label="Wallet balance" value={walletLoading ? 'Loading…' : wallet ? formatINR(Number(wallet.balance)) : '—'} note={walletError || 'Ready to play'} />
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
          <DataState loading={gamesLoading} error={gamesError} retry={loadGames} empty={!popularGames.length}>
            <div className="game-grid">
              {popularGames.map(game => <GameTile key={game.id} game={game} />)}
            </div>
          </DataState>
        </Panel>

        <Panel title="Active matches" subtitle="Pick up where you left off">
          <div className="compact-list">
            {activeMatches.map(match => (
              <div className="compact-row" key={match.id}>
                <span className={`game-mini ${match.game.toLowerCase().replaceAll(' ', '-')}`}>
                  {gameStyles.find(game => game.name === match.game)?.symbol || '🎮'}
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
        <DataState
          loading={transactionsLoading}
          error={transactionsError}
          retry={loadWalletSummary}
          empty={!transactions.length}
        >
          <TransactionRows rows={transactions} />
        </DataState>
      </Panel>
    </>
  );
}
