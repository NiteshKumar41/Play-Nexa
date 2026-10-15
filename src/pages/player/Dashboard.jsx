import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Check, Copy, Gamepad2, ShieldCheck, Swords, Trophy, Wallet as WalletIcon } from 'lucide-react'
import { DataState, PageTitle, Panel, Status } from '../../components/common'
import { GameTile } from '../../components/games/GameCard'
import { games as gameStyles } from '../../data/games'
import { useAuth } from '../../hooks/useAuth'
import { getDashboardSummary } from '../../services/dashboardService'
import { getGames } from '../../services/gameService'
import { formatINR } from '../../utils/currency'
import { formatIndiaDateTime } from '../../utils/formatDate'

const CREDIT_TYPES = new Set(['ADD_MONEY', 'GAME_WIN', 'GAME_REFUND', 'REFERRAL_REWARD'])
const TRANSACTION_LABELS = {
  ADD_MONEY: 'Wallet top-up',
  WITHDRAW: 'Withdrawal',
  GAME_CREATE: 'Match entry',
  GAME_JOIN: 'Match entry',
  GAME_WIN: 'Match winnings',
  GAME_REFUND: 'Match refund',
  REFERRAL_REWARD: 'Referral reward',
}
const MATCH_STATUSES = new Set(['ACTIVE', 'JOINED'])

function Stat({ icon: Icon, label, value, note, accent = '' }) {
  return (
    <article className="stat-card">
      <span className={`stat-icon ${accent}`}><Icon size={18} /></span>
      <small>{label}</small>
      <strong>{value}</strong>
      {note && <span className="stat-note">{note}</span>}
    </article>
  )
}

function ActivityRows({ activities, userId }) {
  return (
    <div className="transaction-list">
      {activities.map(activity => {
        if (activity.kind === 'MATCH') {
          const match = activity.match
          const gameName = match.game?.name || 'Match'
          const payout = match.status === 'SETTLED' && String(match.winnerPlayer) === String(userId)
            ? ` · Net payout ${formatINR(match.winnerNetPayout)}`
            : ''
          return (
            <div className="transaction-row" key={activity.activityId}>
              <span className="transaction-icon"><Swords size={16} /></span>
              <div className="row-grow">
                <strong>{gameName} match</strong>
                <small>{formatIndiaDateTime(activity.createdAt)} · {match.opponentName || 'Opponent pending'}{payout}</small>
              </div>
              <Status>{match.status}</Status>
            </div>
          )
        }

        const transaction = activity.transaction
        const isCredit = CREDIT_TYPES.has(transaction.transactionType)
        const amount = Number(transaction.amount || 0)
        const AmountIcon = isCredit ? ArrowDownLeft : ArrowUpRight
        return (
          <div className="transaction-row" key={activity.activityId}>
            <span className={`transaction-icon ${isCredit ? 'credit' : ''}`}><AmountIcon size={16} /></span>
            <div className="row-grow">
              <strong>{TRANSACTION_LABELS[transaction.transactionType] || transaction.transactionType}</strong>
              <small>{formatIndiaDateTime(transaction.createdAt)} · {transaction.id}</small>
            </div>
            <strong className={isCredit ? 'positive-text' : ''}>{isCredit ? '+' : '-'}{formatINR(amount)}</strong>
            <Status>{transaction.status}</Status>
          </div>
        )
      })}
    </div>
  )
}

export function Dashboard() {
  const { user, profile } = useAuth()
  const requestVersion = useRef(0)
  const [summary, setSummary] = useState(null)
  const [summaryLoading, setSummaryLoading] = useState(true)
  const [summaryError, setSummaryError] = useState('')
  const [games, setGames] = useState([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [gamesError, setGamesError] = useState('')
  const [referralCopied, setReferralCopied] = useState(false)
  const [referralCopyError, setReferralCopyError] = useState('')

  const loadSummary = useCallback(async () => {
    const version = ++requestVersion.current
    setSummaryLoading(true)
    setSummaryError('')
    try {
      const dashboard = await getDashboardSummary()
      if (version === requestVersion.current) setSummary(dashboard)
    } catch (loadError) {
      if (version === requestVersion.current) {
        setSummaryError(loadError instanceof Error ? loadError.message : 'Unable to load your dashboard.')
      }
    } finally {
      if (version === requestVersion.current) setSummaryLoading(false)
    }
  }, [])

  const loadGames = useCallback(async () => {
    setGamesLoading(true)
    setGamesError('')
    try {
      const availableGames = await getGames()
      setGames(availableGames.filter(game => game.is_active ?? game.isActive))
    } catch {
      setGamesError('Unable to load games. Please try again.')
    } finally {
      setGamesLoading(false)
    }
  }, [])

  useEffect(() => {
    queueMicrotask(() => {
      loadSummary()
      loadGames()
    })
    return () => { requestVersion.current += 1 }
  }, [loadGames, loadSummary])

  const referralCode = summary?.referrals.code || summary?.profile?.referralCode || profile?.referral_code || user?.referralCode || ''
  const dashboard = summary || {
    profile: null,
    wallet: {
      walletAvailable: false,
      availableBalance: 0,
      pendingDeposits: 0,
      pendingWithdrawals: 0,
      totalDeposits: 0,
      totalWithdrawals: 0,
    },
    matches: {
      netWinnings: 0,
      grossWinnings: 0,
      totalPlayed: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
      active: 0,
      pendingSettlement: 0,
      activeRecent: [],
    },
    referrals: { referredUsers: 0, rewardsCredited: 0 },
    recentActivity: [],
  }
  const activeMatches = dashboard.matches.activeRecent.filter(match => MATCH_STATUSES.has(match.status))
  const popularGames = games.slice(0, 3)
  const displayName = summary?.profile?.fullName || user?.fullName || 'Player'

  async function copyReferralCode() {
    if (!referralCode) return
    setReferralCopyError('')
    try {
      await navigator.clipboard.writeText(referralCode)
      setReferralCopied(true)
      window.setTimeout(() => setReferralCopied(false), 1800)
    } catch {
      setReferralCopyError('Copy was unavailable. Select the code manually.')
    }
  }

  return (
    <>
      <PageTitle
        eyebrow="PLAYER DASHBOARD"
        title={`Welcome back, ${displayName}`}
        subtitle="Your latest account, wallet, match, and referral activity."
        action={<Link to="/games" className="btn btn-primary"><Gamepad2 size={17} /> Find a match</Link>}
      />

      <DataState loading={summaryLoading} error={summaryError} retry={loadSummary} empty={!summary}>
        <div className="stats-grid">
          <Stat
            icon={WalletIcon}
            accent="icon-indigo"
            label="Wallet balance"
            value={dashboard.wallet.walletAvailable ? formatINR(dashboard.wallet.availableBalance) : '—'}
            note={dashboard.wallet.walletAvailable ? 'Available to play' : 'Wallet unavailable'}
          />
          <Stat
            icon={Trophy}
            accent="icon-green"
            label="Net winnings"
            value={formatINR(dashboard.matches.netWinnings)}
            note={`${formatINR(dashboard.matches.grossWinnings)} gross settled`}
          />
          <Stat
            icon={Swords}
            accent="icon-amber"
            label="Matches played"
            value={dashboard.matches.totalPlayed}
            note={`${dashboard.matches.wins} wins · ${dashboard.matches.losses} losses`}
          />
          <Stat
            icon={ShieldCheck}
            accent="icon-blue"
            label="Win rate"
            value={`${dashboard.matches.winRate}%`}
            note={`${dashboard.matches.active} active · ${dashboard.matches.pendingSettlement} awaiting settlement`}
          />
        </div>

        <Panel title="Your referral code" subtitle="Invite friends and earn when an eligible referral wins.">
          <div className="compact-row">
            <div className="row-grow">
              <strong>{referralCode || 'Unavailable'}</strong>
              <small>{dashboard.referrals.referredUsers} referred users · {formatINR(dashboard.referrals.rewardsCredited)} rewards credited</small>
            </div>
            <button type="button" className="btn btn-secondary" onClick={copyReferralCode} disabled={!referralCode}>
              {referralCopied ? <Check size={16} /> : <Copy size={16} />}
              {referralCopied ? 'Copied' : 'Copy code'}
            </button>
          </div>
          {referralCopyError && <p className="form-disclaimer" role="alert">{referralCopyError}</p>}
        </Panel>

        <Panel title="Wallet summary" subtitle="Ledger-backed totals and requests in progress.">
          <div className="content-grid">
            <div className="compact-list">
              <div className="compact-row"><div className="row-grow"><strong>Pending deposits</strong></div><strong>{formatINR(dashboard.wallet.pendingDeposits)}</strong></div>
              <div className="compact-row"><div className="row-grow"><strong>Pending withdrawals</strong></div><strong>{formatINR(dashboard.wallet.pendingWithdrawals)}</strong></div>
            </div>
            <div className="compact-list">
              <div className="compact-row"><div className="row-grow"><strong>Total deposits</strong></div><strong>{formatINR(dashboard.wallet.totalDeposits)}</strong></div>
              <div className="compact-row"><div className="row-grow"><strong>Total withdrawals</strong></div><strong>{formatINR(dashboard.wallet.totalWithdrawals)}</strong></div>
            </div>
          </div>
        </Panel>

        <div className="content-grid">
          <Panel title="Popular games" subtitle="Find your next challenge" action={<Link className="text-link" to="/games">All games →</Link>}>
            <DataState loading={gamesLoading} error={gamesError} retry={loadGames} empty={!popularGames.length}>
              <div className="game-grid">
                {popularGames.map(game => <GameTile key={game.id} game={game} />)}
              </div>
            </DataState>
          </Panel>

          <Panel title="Active matches" subtitle="Pick up where you left off">
            <DataState loading={false} error={null} retry={loadSummary} empty={!activeMatches.length}>
              <div className="compact-list">
                {activeMatches.map(match => {
                  const gameName = match.game?.name || 'Match'
                  const style = gameStyles.find(game => game.name.toLowerCase() === gameName.toLowerCase())
                  return (
                    <div className="compact-row" key={match.id}>
                      <span className={`game-mini ${gameName.toLowerCase().replaceAll(' ', '-')}`}>{style?.symbol || '🎮'}</span>
                      <div className="row-grow">
                        <strong>{gameName} vs {match.opponentName || 'Waiting for opponent'}</strong>
                        <small>{match.id} · Entry {formatINR(match.entryAmount)}</small>
                      </div>
                      <Link className="text-link" to={`/match/${match.id}`}>Open →</Link>
                    </div>
                  )
                })}
              </div>
            </DataState>
          </Panel>
        </div>

        <Panel title="Recent activity" subtitle="Your latest wallet and match events" action={<Link className="text-link" to="/wallet">View wallet →</Link>}>
          <DataState loading={false} error={null} retry={loadSummary} empty={!dashboard.recentActivity.length}>
            <ActivityRows activities={dashboard.recentActivity} userId={dashboard.profile?.id} />
          </DataState>
        </Panel>
      </DataState>
    </>
  )
}
