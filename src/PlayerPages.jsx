import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Gamepad2, Headphones, Plus, ShieldCheck, Swords, Trophy, Wallet as WalletIcon } from 'lucide-react'
import { Button, ConfirmModal, CopyButton, DataState, FormField, Modal, PageTitle, Panel, Status } from './components'
import { useAuth } from './contexts/useAuth'
import { formatINR, games, matches, player, transactions } from './data'
import { getPlayableGames } from './services/gameService'
import { cancelMatch, createMatch as createMatchRequest, getMatch, getOpenMatches, joinMatch as joinMatchRequest, leaveMatch, submitMatchDispute, submitRoomCode, submitWinnerClaim, subscribeToLobby, subscribeToMatch } from './services/matchService'
import { createWithdrawal, getMyWalletOverview } from './services/walletService'
import { completeMockPayment, createPaymentOrder, getActiveManualUpiMethod, submitManualDeposit } from './services/paymentService'
import { createSupportTicket, getMySupportTickets } from './services/supportService'

function Stat({ icon: Icon, label, value, note, accent = '' }) {
  return <article className="stat-card"><span className={`stat-icon ${accent}`}><Icon size={18}/></span><small>{label}</small><strong>{value}</strong>{note && <span className="stat-note">{note}</span>}</article>
}

export function Dashboard() {
  return <><PageTitle eyebrow="THURSDAY, OCTOBER 2, 2026" title="Good afternoon, Aarav" subtitle="Your next great match is just around the corner." action={<Link to="/games" className="btn btn-primary"><Gamepad2 size={17}/> Find a match</Link>}/>
    <div className="stats-grid"><Stat icon={WalletIcon} accent="icon-indigo" label="Wallet balance" value={formatINR(player.balance)} note="Ready to play"/><Stat icon={Trophy} accent="icon-green" label="Today's earnings" value="₹1,240" note="↑ 18% from yesterday"/><Stat icon={Swords} accent="icon-amber" label="Matches played" value="48" note="32 wins · 67% win rate"/><Stat icon={ShieldCheck} accent="icon-blue" label="Skill rating" value="1,240" note="Gold league"/></div>
    <div className="content-grid"><Panel title="Popular games" subtitle="Find your next challenge" action={<Link className="text-link" to="/games">All games →</Link>}><div className="game-grid">{games.slice(0,3).map(game=><GameTile key={game.id} game={game}/>)}</div></Panel><Panel title="Active matches" subtitle="Pick up where you left off"><div className="compact-list">{matches.filter(match=>match.status!=='Completed').map(match=><div className="compact-row" key={match.id}><span className={`game-mini ${match.game.toLowerCase().replaceAll(' ','-')}`}>{games.find(game=>game.name===match.game)?.symbol}</span><div className="row-grow"><strong>{match.game} vs {match.opponent}</strong><small>{match.id} · Entry {formatINR(match.entry)}</small></div><Link className="text-link" to={`/match/${match.id}`}>Open →</Link></div>)}</div></Panel></div>
    <Panel title="Recent transactions" subtitle="Your latest wallet activity" action={<Link className="text-link" to="/wallet">View wallet →</Link>}><TransactionRows rows={transactions.slice(0,3)}/></Panel>
  </>
}

function GameTile({ game }) {
  const gameCode=game.slug||game.id
  const fallback=games.find(item=>item.id===gameCode)
  const minimumEntry=Number(game.minimum_entry??game.entry)||50
  return <article className="game-tile"><div className={`game-art ${fallback?.theme||''}`}>{game.image_url?<img src={game.image_url} alt={`${game.name} game`} loading="lazy"/>:<span>{fallback?.symbol||'🎮'}</span>}<small>{game.category}</small></div><div className="game-tile-info"><div><h3>{game.name}</h3><p>Game code: {gameCode}</p></div><div><small>Entry from</small><strong>{formatINR(minimumEntry)}</strong></div></div><Link className="btn btn-secondary game-play" to={`/games/${gameCode}`}>Play <span>→</span></Link></article>
}

export function GamesPage() {
  const [filter, setFilter] = useState('All games')
  const [items,setItems]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const loadGames=useCallback(async()=>{
    setLoading(true)
    setError('')
    try{setItems(await getPlayableGames())}
    catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load games.')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadGames()})
    return()=>{cancelled=true}
  },[loadGames])
  const availableCategories=['All games',...new Set(items.map(game=>game.category))]
  const visible = filter === 'All games' ? items : items.filter(game=>game.category===filter)
  return <><PageTitle eyebrow="GAME LOBBY" title="Choose your game" subtitle="Play for fun, compete for prizes, and keep it friendly."/><div className="filter-tabs">{availableCategories.map(category=><button key={category} type="button" aria-pressed={filter===category} className={filter===category?'selected':''} onClick={()=>setFilter(category)}>{category}</button>)}</div><DataState loading={loading} error={error} retry={loadGames} empty={!visible.length}><div className="game-grid game-grid-page">{visible.map(game=><GameTile key={game.id} game={game}/>)}</div></DataState></>
}

export function Lobby({ notify }) {
  const { gameId: gameCode } = useParams()
  const {user}=useAuth()
  const [game,setGame]=useState(null)
  const [openMatches,setOpenMatches]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [modal,setModal]=useState(false)
  const [confirm,setConfirm]=useState(null)
  const [submitting,setSubmitting]=useState(false)
  const navigate=useNavigate()
  const loadLobby=useCallback(async()=>{
    setLoading(true)
    setError('')
    try{
      const availableGames=await getPlayableGames()
      const currentGame=availableGames.find(item=>item.slug===gameCode)
      if(!currentGame)throw new Error('This game is not currently open for matchmaking.')
      setGame(currentGame)
      setOpenMatches(await getOpenMatches(currentGame.id))
    }catch(loadError){
      setError(loadError instanceof Error?loadError.message:'Unable to load this game lobby.')
    }finally{
      setLoading(false)
    }
  },[gameCode])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadLobby()})
    return()=>{cancelled=true}
  },[loadLobby])
  useEffect(()=>{
    if(!game?.id)return undefined
    return subscribeToLobby(game.id,change=>{
      if(change.event==='INSERT'||change.event==='UPDATE')void loadLobby()
    })
  },[game?.id,loadLobby])
  async function createMatch(entry){
    setSubmitting(true)
    try{
      await createMatchRequest({gameId:game.id,entryAmount:entry})
      setModal(false)
      await loadLobby()
      notify('Your match is open in the lobby.')
    }catch(createError){
      notify(createError instanceof Error?createError.message:'Unable to create match.')
    }finally{
      setSubmitting(false)
    }
  }
  async function joinSelectedMatch(){
    if(!confirm)return
    setSubmitting(true)
    try{
      const matchId=confirm.id
      await joinMatchRequest({matchId})
      setConfirm(null)
      notify('Match joined successfully.')
      navigate(`/match/${matchId}`)
    }catch(joinError){
      setConfirm(null)
      await loadLobby()
      notify(joinError instanceof Error?joinError.message:'Unable to join match.')
    }finally{
      setSubmitting(false)
    }
  }
  const fallback=game&&games.find(item=>item.id===game.slug)
  const rows=openMatches.map(match=>({
    id:match.id,
    game:match.game.name,
    creator:match.host_user_id===user?.id?'You':'Player waiting',
    entry:Number(match.entry_amount),
    pool:Number(match.prize_pool),
    status:'Open',
    own:match.host_user_id===user?.id,
  }))
  return (
    <>
      <PageTitle
        eyebrow="OPEN MATCHES"
        title={game ? `${game.name} lobby` : 'Game lobby'}
        subtitle="Find a player and get into the game."
        action={game && <Button onClick={() => setModal(true)}><Plus size={16}/> Create match</Button>}
      />
      {game && (
        <div className="lobby-hero">
          <div className={`lobby-badge ${fallback?.theme || ''}`}>
            {game.image_url ? <img src={game.image_url} alt="" /> : fallback?.symbol || '🎮'}
          </div>
          <div className="lobby-hero-copy">
            <h2>{game.name}</h2>
            <p>Game code: {game.slug} · Entry from {formatINR(Number(game.minimum_entry) || 50)}</p>
          </div>
          <Status>Open</Status>
        </div>
      )}
      <DataState loading={loading} error={error} retry={loadLobby} empty={!rows.length}>
        <Panel className="admin-table-lobby" title="Open matches" subtitle="Join a player waiting for an opponent">
          <div className="table-wrap">
            <table>
              <thead><tr><th>Match</th><th>Creator</th><th>Entry fee</th><th>Prize pool</th><th>Status</th><th/></tr></thead>
              <tbody>
                {rows.map(match => (
                  <tr key={match.id}>
                    <td><Link className="text-link" to={`/match/${match.id}`}>{match.id.slice(0, 8)}</Link><small>{match.game}</small></td>
                    <td>{match.creator}</td>
                    <td>{formatINR(match.entry)}</td>
                    <td className="positive-text">{formatINR(match.pool || match.entry * 2)}</td>
                    <td><Status>{match.status}</Status></td>
                    <td>{match.own?<Link className="text-link" to={`/match/${match.id}`}>Manage →</Link>:<Button variant="secondary" onClick={() => setConfirm(match)}>Join</Button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </DataState>
      {modal && game && (
        <CreateMatchModal
          game={game}
          onClose={() => setModal(false)}
          onCreate={createMatch}
          submitting={submitting}
        />
      )}
      {confirm && (
        <ConfirmModal
          title="Join this match?"
          message={`${formatINR(confirm.entry)} will be reserved from your wallet. The final prize and fee are calculated when the match starts.`}
          confirmLabel={submitting ? 'Joining…' : 'Join match'}
          onClose={() => setConfirm(null)}
          onConfirm={joinSelectedMatch}
        />
      )}
    </>
  )
}

function CreateMatchModal({game,onClose,onCreate,submitting}) {
  const minimumEntry=Number(game.minimum_entry)>0?Number(game.minimum_entry):50
  const availableEntries=[50,100,500,1000].filter(amount=>amount>=minimumEntry&&(game.maximum_entry==null||amount<=Number(game.maximum_entry)))
  const entries=availableEntries.length?availableEntries:[minimumEntry]
  const [entry,setEntry]=useState(entries[0])
  return <Modal title="Create a match" onClose={onClose}><p className="modal-intro">Set up a {game.name} match and wait for an opponent.</p><form className="form-stack" onSubmit={event=>{event.preventDefault();onCreate(entry)}}><FormField label="Entry fee"><select value={entry} onChange={event=>setEntry(Number(event.target.value))}>{entries.map(amount=><option key={amount} value={amount}>{formatINR(amount)}</option>)}</select></FormField><p className="form-disclaimer">Your entry fee will be reserved from your wallet. The prize and platform fee are calculated when an opponent joins.</p><div className="modal-actions"><Button variant="secondary" type="button" onClick={onClose}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting?'Creating…':'Create match'}</Button></div></form></Modal>
}

export function MatchPage({notify}) {
  const {id}=useParams()
  const navigate=useNavigate()
  const {user,profile}=useAuth()
  const [match,setMatch]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [action,setAction]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [roomError,setRoomError]=useState('')
  const [evidenceSubmitting,setEvidenceSubmitting]=useState(false)
  const [evidenceError,setEvidenceError]=useState('')
  const matchRef=useRef(null)
  const notifyRef=useRef(notify)
  useEffect(()=>{matchRef.current=match},[match])
  useEffect(()=>{notifyRef.current=notify},[notify])
  const loadMatch=useCallback(async()=>{
    setLoading(true)
    setError('')
    try{setMatch(await getMatch(id))}
    catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load match details.')}
    finally{setLoading(false)}
  },[id])
  const refreshMatch=useCallback(async()=>{
    try{
      const updatedMatch=await getMatch(id)
      const previousMatch=matchRef.current
      setMatch(updatedMatch)
      if(!previousMatch?.room_code&&updatedMatch.room_code)notifyRef.current('Room code is ready.')
      if(previousMatch?.status!==updatedMatch.status)notifyRef.current(`Match status updated: ${updatedMatch.status.replaceAll('_',' ')}.`)
    }catch(refreshError){
      notifyRef.current(refreshError instanceof Error?refreshError.message:'Unable to refresh match details.')
    }
  },[id])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadMatch()})
    return()=>{cancelled=true}
  },[loadMatch])
  useEffect(()=>{
    return subscribeToMatch(id,refreshMatch)
  },[id,refreshMatch])
  async function handleRoomCodeSubmit(event){
    event.preventDefault()
    const form=new FormData(event.currentTarget)
    setSubmitting(true)
    setRoomError('')
    try{
      await submitRoomCode({matchId:id,roomCode:form.get('roomCode')})
      await refreshMatch()
    }catch(submitError){
      setRoomError(submitError instanceof Error?submitError.message:'Unable to submit the room code.')
    }finally{
      setSubmitting(false)
    }
  }
  async function handleWinnerClaim(event){
    event.preventDefault()
    setEvidenceSubmitting(true)
    setEvidenceError('')
    try{
      await submitWinnerClaim({
        matchId:id,
        proofFile:new FormData(event.currentTarget).get('winnerScreenshot'),
      })
      await refreshMatch()
      notify('Winner claim submitted for admin review. No prize was paid.')
    }catch(claimError){
      setEvidenceError(claimError instanceof Error?claimError.message:'Unable to submit winner claim.')
    }finally{
      setEvidenceSubmitting(false)
    }
  }
  async function handleDisputeSubmit(event){
    event.preventDefault()
    setEvidenceSubmitting(true)
    setEvidenceError('')
    try{
      const values=new FormData(event.currentTarget)
      await submitMatchDispute({
        matchId:id,
        reason:values.get('reason'),
        proofFile:values.get('disputeScreenshot'),
      })
      await refreshMatch()
      notify('Dispute submitted for admin review.')
    }catch(disputeError){
      setEvidenceError(disputeError instanceof Error?disputeError.message:'Unable to submit dispute.')
    }finally{
      setEvidenceSubmitting(false)
    }
  }
  async function confirmMatchAction(){
    setSubmitting(true)
    try{
      if(action==='leave')await leaveMatch({matchId:id})
      else await cancelMatch({matchId:id})
      setAction('')
      notify(action==='leave'?'You left the match. Your entry fee was refunded.':'Match cancelled. Your entry fee was refunded.')
      navigate(`/games/${match.game.slug}`)
    }catch(actionError){
      notify(actionError instanceof Error?actionError.message:'Unable to update this match.')
      setAction('')
      await refreshMatch()
    }finally{
      setSubmitting(false)
    }
  }
  if(loading)return <DataState loading error={false}/>
  if(error||!match)return <DataState loading={false} error={error||'Match could not be found.'} retry={loadMatch} empty={false}><span/></DataState>
  const creator=match.host_user_id===user?.id
  const opponentJoined=Boolean(match.opponent_user_id)
  const isOpponent=match.opponent_user_id===user?.id
  const hasRoomCode=Boolean(match.room_code?.trim())
  const canLeave=isOpponent&&!hasRoomCode&&match.status==='in_progress'
  const canCancel=creator&&!opponentJoined&&!hasRoomCode&&match.status==='active'
  const canSubmitRoom=creator&&opponentJoined&&!hasRoomCode&&match.status==='in_progress'
  const isParticipant=creator||isOpponent
  const canClaimWinner=isParticipant&&opponentJoined&&match.status==='in_progress'&&!match.winner_claim_status
  const canDispute=isParticipant&&opponentJoined&&['in_progress','completed'].includes(match.status)
    &&!match.dispute_reason&&match.winner_claimed_by!==user?.id
  const name=profile?.full_name||player.name
  return (
    <>
      <PageTitle eyebrow={`MATCH ${match.id.slice(0,8)}`} title={`${match.game.name} match`} subtitle="Match details and current status."/>
      <Panel className="match-panel" title="Match details" subtitle={opponentJoined?'Your opponent has joined the match.':'Waiting for an opponent to join.'}>
        <div className="match-versus">
          <div className="match-player">
            <span className="player-avatar">{creator?name.split(/\s+/).map(part=>part[0]).join('').slice(0,2).toUpperCase():'🎮'}</span>
            <strong>{creator?name:'Match creator'}</strong>
            <small>{creator?'You · Match creator':'Match creator'}</small>
          </div>
          <span className="versus">VS</span>
          <div className="match-player">
            <span className="player-avatar opponent">{opponentJoined?'🎮':'?'}</span>
            <strong>{opponentJoined?(isOpponent?'You':'Opponent joined'):'Waiting for opponent'}</strong>
            <small>{isOpponent?'You · Player 2':creator?'Player 2':'Player 2'}</small>
          </div>
        </div>
        <div className="financial-grid">
          <div><small>Entry amount</small><strong>{formatINR(Number(match.entry_amount))} each</strong></div>
          <div><small>Prize pool</small><strong>{formatINR(Number(match.prize_pool))}</strong></div>
          <div><small>Platform fee</small><strong>{formatINR(Number(match.platform_fee))}</strong></div>
          <div><small>Winner amount</small><strong className="positive-text">{formatINR(Number(match.winner_amount))}</strong></div>
        </div>
        {hasRoomCode&&<div className="room-code"><div><small>ROOM CODE</small><strong>{match.room_code}</strong></div><CopyButton value={match.room_code} onCopied={()=>notify('Room code copied')}/></div>}
        {canSubmitRoom&&<form className="form-stack room-code-form" onSubmit={handleRoomCodeSubmit}><FormField label="Room code"><input name="roomCode" maxLength="64" required placeholder="Enter the game room code"/></FormField>{roomError&&<p className="auth-error" role="alert">{roomError}</p>}<Button type="submit" disabled={submitting}>{submitting?'Submitting…':'Share room code'}</Button></form>}
        <div className="match-status-line"><Status>{match.status.replaceAll('_',' ')}</Status><span>Game code: {match.game.slug}</span></div>
        {(canLeave||canCancel)&&<div className="button-row match-management-actions">{canLeave&&<Button variant="danger-outline" onClick={()=>setAction('leave')}>Leave and refund</Button>}{canCancel&&<Button variant="danger-outline" onClick={()=>setAction('cancel')}>Cancel and refund</Button>}</div>}
      </Panel>
      <div className="content-grid match-actions">
        <Panel title="Match result & evidence" subtitle="Submit your result or raise a dispute for admin review.">
          {match.winner_claimed_by&&<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Winner claim {match.winner_claim_status?.toLowerCase()} · Claimed by {match.winner_claimed_by===user?.id?'you':`player ${match.winner_claimed_by.slice(0,8)}`}. No prize is paid until an administrator settles the match.</p></div>{match.winner_claim_image_url&&<img src={match.winner_claim_image_url} alt="Winner claim screenshot" style={{maxWidth:'100%',maxHeight:320,objectFit:'contain'}}/>}</div>}
          {canClaimWinner&&<form className="form-stack" onSubmit={handleWinnerClaim}><FormField label="Winner screenshot"><input name="winnerScreenshot" type="file" accept="image/jpeg,image/png,image/webp" required/></FormField><p className="form-disclaimer">Your screenshot will be stored privately and reviewed by an administrator. Submitting a claim does not automatically pay the prize.</p><Button type="submit" disabled={evidenceSubmitting}>{evidenceSubmitting?'Submitting…':'Claim winner'}</Button></form>}
          {match.dispute_reason&&<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Match dispute submitted for admin review: {match.dispute_reason}</p></div>{match.dispute_screenshot_url&&<img src={match.dispute_screenshot_url} alt="Match dispute screenshot" style={{maxWidth:'100%',maxHeight:320,objectFit:'contain'}}/>}</div>}
          {canDispute&&<form className="form-stack" onSubmit={handleDisputeSubmit}><FormField label="Dispute reason"><textarea name="reason" minLength="10" maxLength="2000" rows="3" placeholder="Explain what happened" required/></FormField><FormField label="Dispute screenshot"><input name="disputeScreenshot" type="file" accept="image/jpeg,image/png,image/webp" required/></FormField><Button variant="secondary" type="submit" disabled={evidenceSubmitting}>{evidenceSubmitting?'Submitting…':'Submit dispute'}</Button></form>}
          {evidenceError&&<p className="auth-error" role="alert">{evidenceError}</p>}
          {!canClaimWinner&&!canDispute&&!match.winner_claimed_by&&!match.dispute_reason&&<div className="notice"><ShieldCheck size={18}/><p>Match result submissions become available once both players are in the match. Winnings are not paid automatically.</p></div>}
        </Panel>
        <Panel title="Game" subtitle={match.game.category}>
          <div className="lobby-hero"><div className="lobby-badge">{match.game.image_url?<img src={match.game.image_url} alt=""/>:'🎮'}</div><div className="lobby-hero-copy"><h2>{match.game.name}</h2><p>Game code: {match.game.slug}</p></div></div>
        </Panel>
      </div>
      {action&&<ConfirmModal title={action==='leave'?'Leave this match?':'Cancel this match?'} message={`Your ${formatINR(Number(match.entry_amount))} entry fee will be refunded. This can only be done before a room code is set.`} confirmLabel={submitting?'Processing…':'Confirm and refund'} danger onClose={()=>setAction('')} onConfirm={confirmMatchAction}/>}
    </>
  )
}

function TransactionRows({rows}) {
  return <div className="transaction-list">{rows.map(transaction=><div className="transaction-row" key={transaction.id}><span className={`transaction-icon ${transaction.amount>0?'credit':''}`}>{transaction.amount>0?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</span><div className="row-grow"><strong>{transaction.title}</strong><small>{transaction.date} · {transaction.id}</small></div><strong className={transaction.amount>0?'positive-text':''}>{transaction.amount>0?'+':''}{formatINR(transaction.amount)}</strong><Status>{transaction.status}</Status></div>)}</div>
}

export function WalletPage({notify}) {
  const [filter,setFilter]=useState('All')
  const [showAddMoney,setShowAddMoney]=useState(false)
  const [showWithdrawal,setShowWithdrawal]=useState(false)
  const [withdrawalBusy,setWithdrawalBusy]=useState(false)
  const [withdrawalError,setWithdrawalError]=useState('')
  const [withdrawalResult,setWithdrawalResult]=useState(null)
  const [paymentOrder,setPaymentOrder]=useState(null)
  const [paymentBusy,setPaymentBusy]=useState(false)
  const [paymentError,setPaymentError]=useState('')
  const [paymentResult,setPaymentResult]=useState(null)
  const [depositMethod,setDepositMethod]=useState('gateway')
  const [manualMethod,setManualMethod]=useState(null)
  const [manualMethodLoading,setManualMethodLoading]=useState(false)
  const [manualDeposit,setManualDeposit]=useState(null)
  const [wallet,setWallet]=useState(null)
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const loadWallet=useCallback(async()=>{
    setLoading(true)
    setError('')
    try{
      const overview=await getMyWalletOverview()
      setWallet(overview.wallet)
      setRows(overview.transactions.map(transaction=>{
        const isDebit=['debit','withdrawal','WITHDRAW','match_entry','GAME_CREATE','GAME_JOIN'].includes(transaction.transaction_type)
        return {
          id:transaction.id,
          title:transaction.description||transaction.transaction_type.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase()),
          date:new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(transaction.created_at)),
          amount:Number(transaction.amount)*(isDebit?-1:1),
          kind:isDebit?'debit':'credit',
          status:transaction.status.replaceAll('_',' ').replace(/\b\w/g,letter=>letter.toUpperCase()),
        }
      }))
    }catch(loadError){
      setError(loadError instanceof Error?loadError.message:'Unable to load wallet data.')
    }finally{
      setLoading(false)
    }
  },[])
  async function createWalletTopUp(event){
    event.preventDefault()
    setPaymentBusy(true)
    setPaymentError('')
    try{
      const amount=new FormData(event.currentTarget).get('amount')
      const result=await createPaymentOrder(amount)
      setPaymentOrder(result)
    }catch(paymentFailure){
      setPaymentError(paymentFailure instanceof Error?paymentFailure.message:'Unable to create a payment order.')
    }finally{
      setPaymentBusy(false)
    }
  }
  async function submitWithdrawal(event){
    event.preventDefault()
    setWithdrawalBusy(true)
    setWithdrawalError('')
    try{
      const values=new FormData(event.currentTarget)
      const withdrawalId=await createWithdrawal({
        amount:Number(values.get('amount')).toFixed(2),
        upiId:values.get('upiId'),
      })
      setWithdrawalResult(withdrawalId)
      await loadWallet()
      notify('Withdrawal initiated. Your wallet has been debited and the payout is pending admin processing.')
    }catch(withdrawalFailure){
      setWithdrawalError(withdrawalFailure instanceof Error?withdrawalFailure.message:'Unable to initiate withdrawal.')
    }finally{
      setWithdrawalBusy(false)
    }
  }
  function closeWithdrawal(){
    if(withdrawalBusy)return
    setShowWithdrawal(false)
    setWithdrawalError('')
    setWithdrawalResult(null)
  }
  const loadManualMethod=useCallback(async()=>{
    setManualMethodLoading(true)
    setPaymentError('')
    try{
      setManualMethod(await getActiveManualUpiMethod())
    }catch(methodError){
      setPaymentError(methodError instanceof Error?methodError.message:'Unable to load the active UPI payment method.')
    }finally{
      setManualMethodLoading(false)
    }
  },[])
  async function createManualDeposit(event){
    event.preventDefault()
    if(!manualMethod)return
    setPaymentBusy(true)
    setPaymentError('')
    try{
      const form=new FormData(event.currentTarget)
      const deposit=await submitManualDeposit({
        amount:form.get('amount'),
        paymentMethodId:manualMethod.id,
        proofFile:form.get('proof'),
      })
      setManualDeposit(deposit)
      notify('Manual deposit submitted for admin review. Wallet not credited.')
    }catch(depositError){
      setPaymentError(depositError instanceof Error?depositError.message:'Unable to submit manual deposit.')
    }finally{
      setPaymentBusy(false)
    }
  }
  async function simulateDevelopmentPayment(status){
    if(!paymentOrder?.order?.id)return
    setPaymentBusy(true)
    setPaymentError('')
    try{
      const result=await completeMockPayment({orderId:paymentOrder.order.id,status})
      setPaymentResult(result)
      if(status==='SUCCESS')await loadWallet()
      notify(result.message)
    }catch(paymentFailure){
      setPaymentError(paymentFailure instanceof Error?paymentFailure.message:'Development payment simulation failed.')
    }finally{
      setPaymentBusy(false)
    }
  }
  function closePaymentModal(){
    if(paymentBusy)return
    setShowAddMoney(false)
    setPaymentOrder(null)
    setPaymentError('')
    setPaymentResult(null)
    setDepositMethod('gateway')
    setManualMethod(null)
    setManualDeposit(null)
  }
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadWallet()})
    return()=>{cancelled=true}
  },[loadWallet])
  const visible=rows.filter(row=>filter==='All'||(filter==='Credits'?row.amount>0:row.amount<0))
  return <>
    <PageTitle eyebrow="WALLET & PAYMENTS" title="Your wallet" subtitle="Manage funds securely and review every transaction."/>
    <div className="wallet-hero">
      <div><small>AVAILABLE BALANCE</small><strong>{loading?'Loading…':wallet?formatINR(Number(wallet.balance)):'—'}</strong><span><i/> Wallet protected and ready</span></div>
      <div className="button-row"><Button onClick={()=>setShowAddMoney(true)}><ArrowDownLeft size={16}/> Add money</Button><Button variant="secondary" onClick={()=>{setWithdrawalError('');setWithdrawalResult(null);setShowWithdrawal(true)}}>Withdraw <ArrowUpRight size={16}/></Button></div>
    </div>
    <Panel title="Transaction history" subtitle="Track deposits, match entries, and winnings" action={<div className="filter-tabs compact">{['All','Credits','Debits'].map(item=><button type="button" aria-pressed={filter===item} className={filter===item?'selected':''} key={item} onClick={()=>setFilter(item)}>{item}</button>)}</div>}>
      <DataState loading={loading} error={error} retry={loadWallet} empty={!visible.length}><TransactionRows rows={visible}/></DataState>
    </Panel>
    {showAddMoney&&<Modal title={paymentOrder?'Development checkout':'Add money'} onClose={closePaymentModal}>
      {paymentError&&<p className="auth-error" role="alert">{paymentError}</p>}
      {!paymentOrder&&!manualDeposit&&<form className="form-stack" onSubmit={depositMethod==='gateway'?createWalletTopUp:createManualDeposit}>
        <FormField label="Deposit method"><select value={depositMethod} onChange={event=>{const method=event.target.value;setDepositMethod(method);setPaymentError('');if(method==='manual'){setManualMethod(null);loadManualMethod()}}}><option value="gateway">Payment gateway</option><option value="manual">Manual UPI</option></select></FormField>
        <FormField label="Amount (₹)"><input name="amount" type="number" min="100" max="100000" step="0.01" defaultValue="500" required/></FormField>
        {depositMethod==='gateway'&&<p className="form-disclaimer">The wallet is credited only after server-side payment verification. Development checkout is a simulation, not a real payment.</p>}
        {depositMethod==='manual'&&<>{manualMethodLoading?<div role="status">Loading active UPI method…</div>:manualMethod?<div className="manual-upi-details"><strong>{manualMethod.display_name}</strong><span>Payee: {manualMethod.payee_name}</span><span>UPI ID: <strong>{manualMethod.upi_id}</strong></span>{manualMethod.qrUrl&&<img src={manualMethod.qrUrl} alt="Active UPI payment QR code" style={{width:180,maxHeight:180,objectFit:'contain',alignSelf:'center'}}/>}<p className="form-disclaimer">Pay the amount above using your UPI app, then upload the payment screenshot. Your deposit remains pending until admin review; it will not credit your wallet automatically.</p><FormField label="Payment screenshot"><input name="proof" type="file" accept="image/jpeg,image/png,image/webp" required/></FormField></div>:<p role="status">No active manual UPI payment method is available. Choose gateway or contact support.</p>}</>}
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={closePaymentModal}>Cancel</Button><Button type="submit" disabled={paymentBusy||(depositMethod==='manual'&&(!manualMethod||manualMethodLoading))}>{paymentBusy?'Submitting…':depositMethod==='manual'?'I have paid — submit for review':'Continue to checkout'}</Button></div>
      </form>}
      {manualDeposit&&<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Deposit submitted for review. No wallet credit has been made.</p></div><p>Request {manualDeposit.id.slice(0,8)} · {formatINR(Number(manualDeposit.amount))}</p><Status>{manualDeposit.status}</Status><div className="modal-actions"><Button variant="secondary" onClick={closePaymentModal}>Close</Button></div></div>}
      {paymentOrder&&<div className="form-stack">
        <div className="notice"><ShieldCheck size={18}/><p>{paymentOrder.checkout?.message||'Continue using the payment method provided by the payment service.'}</p></div>
        <p>Order {paymentOrder.order.id.slice(0,8)} · {formatINR(Number(paymentOrder.order.amount))} {paymentOrder.order.currency}</p>
        {paymentResult?<><Status>{paymentResult.status}</Status><p>{paymentResult.message}</p></>:paymentOrder.checkout?.mode==='mock'&&<div className="button-row"><Button disabled={paymentBusy} onClick={()=>simulateDevelopmentPayment('SUCCESS')}>{paymentBusy?'Processing…':'Simulate successful payment'}</Button><Button variant="secondary" disabled={paymentBusy} onClick={()=>simulateDevelopmentPayment('FAILED')}>Simulate failed payment</Button><Button variant="ghost" disabled={paymentBusy} onClick={()=>simulateDevelopmentPayment('CANCELLED')}>Cancel checkout</Button></div>}
        {paymentResult&&<div className="modal-actions"><Button variant="secondary" onClick={closePaymentModal}>Close</Button></div>}
      </div>}
    </Modal>}
    {showWithdrawal&&<Modal title="Withdraw to UPI" onClose={closeWithdrawal}>
      {withdrawalError&&<p className="auth-error" role="alert">{withdrawalError}</p>}
      {withdrawalResult?<div className="form-stack"><div className="notice"><ShieldCheck size={18}/><p>Your withdrawal request is initiated. The amount has been deducted from your wallet and will be processed by an administrator.</p></div><p>Withdrawal {withdrawalResult.slice(0,8)} · Status: INITIATED</p><div className="modal-actions"><Button variant="secondary" onClick={closeWithdrawal}>Close</Button></div></div>:<form className="form-stack" onSubmit={submitWithdrawal}>
        <FormField label="Amount (₹)" hint={wallet?`Available balance: ${formatINR(Number(wallet.balance))}`:'Wallet balance unavailable'}><input name="amount" type="number" min="0.01" max={wallet?.balance||undefined} step="0.01" placeholder="Enter amount" required disabled={!wallet||Number(wallet.balance)<=0}/></FormField>
        <FormField label="UPI ID"><input name="upiId" type="text" autoComplete="off" placeholder="name@bank" maxLength="255" pattern="[A-Za-z0-9][A-Za-z0-9._-]{0,254}@[A-Za-z0-9][A-Za-z0-9.-]{0,63}" required/></FormField>
        <p className="form-disclaimer">The requested amount is deducted immediately. An administrator will process the UPI payout; rejected requests are refunded to your wallet.</p>
        <div className="modal-actions"><Button variant="secondary" type="button" onClick={closeWithdrawal}>Cancel</Button><Button type="submit" disabled={withdrawalBusy||!wallet||Number(wallet.balance)<=0}>{withdrawalBusy?'Submitting…':'Request withdrawal'}</Button></div>
      </form>}
    </Modal>}
  </>
}

export function SupportPage({notify}) {
  const [modal,setModal]=useState(false)
  const [items,setItems]=useState([])
  const [selected,setSelected]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [formError,setFormError]=useState('')
  const loadTickets=useCallback(async()=>{
    setLoading(true)
    setError('')
    try{setItems(await getMySupportTickets())}
    catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load your support tickets.')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadTickets()})
    return()=>{cancelled=true}
  },[loadTickets])
  async function submitTicket(event){
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try{
      const values=new FormData(event.currentTarget)
      await createSupportTicket({
        subject:values.get('subject'),
        category:values.get('category'),
        description:values.get('details'),
        imageFile:values.get('image'),
      })
      setModal(false)
      notify('Support ticket created.')
      await loadTickets()
    }catch(createError){
      setFormError(createError instanceof Error?createError.message:'Unable to create support ticket.')
    }finally{
      setSubmitting(false)
    }
  }
  const statusLabel=status=>status.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase())
  return <>
    <PageTitle eyebrow="PLAYER CARE" title="Support" subtitle="We’re here to help with your account, matches, and payments." action={<Button onClick={()=>{setFormError('');setModal(true)}}><Plus size={16}/> Create ticket</Button>}/>
    <div className="support-banner"><span><Headphones size={20}/></span><div><strong>Need a quick answer?</strong><p>Our player care team usually replies within 15 minutes.</p></div><span className="online-label"><i/> Online now</span></div>
    <Panel title="Your tickets" subtitle="Follow the progress of your support requests">
      <DataState loading={loading} error={error} retry={loadTickets} empty={!items.length}>
        <div className="ticket-list">{items.map(ticket=><article className="ticket-row" key={ticket.id}><span className="ticket-icon"><Headphones size={17}/></span><div className="row-grow"><strong>{ticket.subject}</strong><small>{ticket.id.slice(0,8)} · {ticket.category} · {new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(ticket.created_at))}</small></div><Status>{statusLabel(ticket.status)}</Status><button className="text-link" onClick={()=>setSelected(ticket)}>View ticket →</button></article>)}</div>
      </DataState>
    </Panel>
    {modal&&<Modal title="Create a support ticket" onClose={()=>!submitting&&setModal(false)}><form className="form-stack" onSubmit={submitTicket}>
      {formError&&<p className="auth-error" role="alert">{formError}</p>}
      <FormField label="Topic"><select name="category"><option>Match issue</option><option>Payments</option><option>Account</option><option>Other</option></select></FormField>
      <FormField label="Subject"><input name="subject" maxLength="160" placeholder="Briefly describe the issue" required/></FormField>
      <FormField label="Details"><textarea name="details" minLength="10" maxLength="4000" rows="4" placeholder="Include any details that could help us" required/></FormField>
      <FormField label="Image (optional)"><input name="image" type="file" accept="image/jpeg,image/png,image/webp"/></FormField>
      <div className="modal-actions"><Button variant="secondary" type="button" disabled={submitting} onClick={()=>setModal(false)}>Cancel</Button><Button type="submit" disabled={submitting}>{submitting?'Submitting…':'Submit ticket'}</Button></div>
    </form></Modal>}
    {selected&&<Modal title={`Ticket ${selected.id.slice(0,8)}`} onClose={()=>setSelected(null)}><div className="ticket-detail"><Status>{statusLabel(selected.status)}</Status><h3>{selected.subject}</h3><p>{selected.description}</p><small>{selected.category} · {new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(selected.created_at))}</small>{selected.image_url&&<img src={selected.image_url} alt="Support ticket attachment" style={{maxWidth:'100%',maxHeight:360,objectFit:'contain',marginTop:16}}/>}{selected.resolution&&<div className="notice"><ShieldCheck size={18}/><p>Support resolution: {selected.resolution}</p></div>}</div><div className="modal-actions"><Button variant="secondary" onClick={()=>setSelected(null)}>Close</Button></div></Modal>}
  </>
}

export function AuthPage({mode,onSuccess}) {
  const navigate=useNavigate(); const location=useLocation(); const {login,signup:register,verifyPhone,authError}=useAuth(); const signup=mode==='signup'; const forgot=mode==='forgot-password'; const [sent,setSent]=useState(false); const [submitting,setSubmitting]=useState(false); const [formError,setFormError]=useState(''); const [sentMessage,setSentMessage]=useState(''); const [pendingPhone,setPendingPhone]=useState(''); const [verificationCode,setVerificationCode]=useState('')
  const title=signup?'Create your account':forgot?'Reset your passcode':'Welcome back'
  async function submit(event){
    event.preventDefault()
    if(signup){const values=new FormData(event.currentTarget);if(values.get('passcode')!==values.get('confirmPasscode')){event.currentTarget.elements.confirmPasscode.setCustomValidity('Passcodes do not match.');event.currentTarget.elements.confirmPasscode.reportValidity();return}}
    setFormError('')
    if(forgot){setSent(true);setSentMessage('Passcode reset is not connected yet. Contact support to recover your account.');return}
    setSubmitting(true)
    try {
      if(signup){
        const values=new FormData(event.currentTarget)
        const result=await register({phone:values.get('phone'),passcode:values.get('passcode'),fullName:values.get('fullName'),email:values.get('email'),dob:values.get('dob'),gender:values.get('gender'),upiId:values.get('upi')})
        if(!result.session){setPendingPhone(values.get('phone'));setSent(true);setSentMessage('Enter the verification code sent to your phone to finish creating your account.');return}
        onSuccess?.('Your account is ready.')
      }else{
        await login({phone:new FormData(event.currentTarget).get('phone'),passcode:new FormData(event.currentTarget).get('passcode')})
        onSuccess?.('Signed in successfully.')
      }
      const destination=location.state?.from
      navigate(destination?`${destination.pathname||'/dashboard'}${destination.search||''}${destination.hash||''}`:'/dashboard',{replace:true})
    }catch(error){
      setFormError(error instanceof Error?error.message:'Unable to authenticate. Please try again.')
    }finally{
      setSubmitting(false)
    }
  }
  async function verifySignup(event){
    event.preventDefault()
    setSubmitting(true)
    setFormError('')
    try{
      await verifyPhone({phone:pendingPhone,token:verificationCode})
      onSuccess?.('Your account is ready.')
      navigate('/dashboard',{replace:true})
    }catch(error){
      setFormError(error instanceof Error?error.message:'Phone verification failed. Please try again.')
    }finally{
      setSubmitting(false)
    }
  }
  return <div className="auth-layout"><Link to="/login" className="brand"><span className="brand-mark">✦</span><span>play<span>nexa</span></span></Link><div className="auth-card"><div className="eyebrow">PLAY NEXA · SKILL GAMING</div><h1>{title}</h1><p>{forgot?'We’ll help you securely get back into your account.':signup?'Join the community and put your skills to the test.':'Sign in securely with your registered phone number.'}</p>{(formError||(!sent&&!signup&&!forgot&&authError))&&<p className="auth-error" role="alert">{formError||authError}</p>}{sent?<><div className="notice"><ShieldCheck size={18}/><p>{sentMessage}</p></div>{pendingPhone&&<form className="form-stack" onSubmit={verifySignup}><FormField label="6-digit verification code"><input name="verificationCode" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={verificationCode} onChange={event=>setVerificationCode(event.target.value)} placeholder="••••••" required/></FormField><Button type="submit" disabled={submitting} className="auth-submit">{submitting?'Please wait…':'Verify phone'} →</Button></form>}</>:<form className="form-stack" onSubmit={submit}>{signup&&<FormField label="Full name"><input name="fullName" placeholder="e.g. Aarav Mehta" required/></FormField>}<FormField label="Phone number"><div className="phone-input"><span>🇮🇳 +91</span><input name="phone" type="tel" inputMode="numeric" pattern="[0-9]{10}" placeholder="98765 43210" required/></div></FormField>{signup&&<><FormField label="Email address"><input name="email" type="email" placeholder="you@example.com" required/></FormField><div className="form-grid"><FormField label="Date of birth"><input name="dob" type="date" required/></FormField><FormField label="Gender"><select name="gender" defaultValue=""><option value="" disabled>Select</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Prefer not to say</option></select></FormField></div><FormField label="UPI ID"><input name="upi" placeholder="name@bank" required/></FormField></>}{!forgot&&<FormField label="6-digit passcode"><input name="passcode" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="••••••" required/></FormField>}{signup&&<FormField label="Confirm passcode"><input name="confirmPasscode" inputMode="numeric" pattern="[0-9]{6}" maxLength="6" placeholder="••••••" required onInput={event=>event.currentTarget.setCustomValidity('')}/></FormField>}<Button type="submit" disabled={submitting} className="auth-submit">{submitting?'Please wait…':forgot?'Send reset instructions':signup?'Create account':'Sign in'} →</Button></form>}{!signup&&!forgot&&<Link className="auth-help" to="/forgot-password">Forgot passcode?</Link>}{!forgot&&<div className="auth-switch">{signup?'Already have an account?':'New to Play Nexa?'} <Link to={signup?'/login':'/signup'}>{signup?'Sign in':'Create account'}</Link></div>}{forgot&&!sent&&<div className="auth-switch"><Link to="/login">← Back to sign in</Link></div>}<small className="auth-safe"><ShieldCheck size={14}/> {forgot?'Passcode recovery is not connected yet.':'Protected by Supabase Auth.'}</small></div><span className="auth-footer">© 2026 Play Nexa · Play fair. Play smart.</span></div>
}
