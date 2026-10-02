import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, ShieldCheck, Wallet, Swords, CircleHelp } from 'lucide-react'
import { Button, ConfirmModal, DataState, FormField, Modal, PageTitle, Panel, Status } from '../../components/common'
import { formatINR } from '../../data/mockData'
import { declareWinner, getPendingSettlements, getSettlement, refundBothPlayers, rejectWinnerClaim, releaseSettlementEvidence } from '../../services/adminSettlementService'
import { getAdminSupportTickets, updateSupportTicket } from '../../services/supportService'
import { getAdminDashboardSummary, getAdminDeposits, getAdminPaymentMethods, getAdminUsers, getAdminWithdrawals, processManualDeposit, saveAdminPaymentMethod, updateAdminUser, uploadPaymentQr } from '../../services/adminService'
import { createGame, getAdminGames, toggleGameOpenStatus, toggleGameStatus, updateGame } from '../../services/gameService'
import { GameImage } from '../../components/games/GameImage'
import { approveWithdrawal, rejectWithdrawal } from '../../services/walletService'
import { formatIndiaDateTime } from '../../utils/formatDate'

export function AdminPage({section,notify}) {
  if(section==='summary') return <AdminSummary/>
  if(section==='deposits') return <Deposits notify={notify}/>
  if(section==='payouts') return <Payouts notify={notify}/>
  if(section==='settlements') return <Settlements notify={notify}/>
  if(section==='games') return <GamesAdmin notify={notify}/>
  if(section==='payments') return <PaymentsAdmin notify={notify}/>
  if(section==='users') return <UsersAdmin notify={notify}/>
  return <SupportAdmin notify={notify}/>
}

function AdminSummary() {
  const [summary,setSummary]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const load=useCallback(async()=>{setLoading(true);setError('');try{setSummary(await getAdminDashboardSummary())}catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load admin summary.')}finally{setLoading(false)}},[])
  useEffect(()=>{queueMicrotask(load)},[load])
  const metrics=summary?[
    ['Total deposits',formatINR(Number(summary.deposits_total)),Wallet,'icon-indigo'],
    ['Total withdrawals',formatINR(Number(summary.withdrawals_total)),Wallet,'icon-blue'],
    ['Matches played',Number(summary.completed_matches).toLocaleString('en-IN'),Swords,'icon-green'],
    ['Platform earnings',formatINR(Number(summary.platform_earnings)),ShieldCheck,'icon-amber'],
    ['Pending deposits',formatINR(Number(summary.pending_deposits)),Wallet,'icon-amber'],
    ['Pending withdrawals',formatINR(Number(summary.pending_withdrawals)),Wallet,'icon-blue'],
    ['Pending disputes',Number(summary.pending_disputes).toLocaleString('en-IN'),CircleHelp,'icon-red'],
  ]:[]
  return <><PageTitle eyebrow="ADMINISTRATION" title="Platform summary" subtitle="Monitor operations, payments, and player activity."/><DataState loading={loading} error={error} retry={load} empty={false}>{summary&&<><div className="admin-kpi-grid">{metrics.map(([label,value,Icon,accent])=><article className="stat-card" key={label}><span className={`stat-icon ${accent}`}><Icon size={18}/></span><small>{label}</small><strong>{value}</strong><span className="stat-note">Mock preview data</span></article>)}</div><div className="content-grid"><Panel title="Operations at a glance" subtitle="Platform totals"><div className="overview-bars">{[['Players',summary.players],['Completed matches',summary.completed_matches],['Pending support tickets',summary.pending_tickets],['Pending disputes',summary.pending_disputes]].map(([label,value])=><div className="overview-bar" key={label}><span>{label}<strong>{Number(value).toLocaleString('en-IN')}</strong></span><i><b style={{width:`${Math.min(100,Number(value))}%`}}/></i></div>)}</div></Panel><Panel title="Needs attention" subtitle="Items waiting for admin review"><div className="attention-list">{[['Deposits awaiting approval',formatINR(Number(summary.pending_deposits)),'/admin/deposits'],['Payouts to process',formatINR(Number(summary.pending_withdrawals)),'/admin/payouts'],['Match disputes',`${summary.pending_disputes} matches`,'/admin/settlements'],['Support tickets',`${summary.pending_tickets} tickets`,'/admin/support']].map(([label,detail,path])=><Link to={path} className="attention-item" key={path}><span><strong>{label}</strong><small>{detail}</small></span><b>→</b></Link>)}</div></Panel></div></>}</DataState></>
}

function AdminTabs({items,value,onChange}) { return <div className="filter-tabs">{items.map(item=><button key={item} type="button" aria-pressed={value===item} className={value===item?'selected':''} onClick={()=>onChange(item)}>{item}</button>)}</div> }

function Deposits({notify}) {
  const [tab,setTab]=useState('PENDING'),[rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[confirm,setConfirm]=useState(null),[proof,setProof]=useState(null)
  const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(await getAdminDeposits())}catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load deposits.')}finally{setLoading(false)}},[])
  useEffect(()=>{queueMicrotask(load)},[load])
  const visible=rows.filter(row=>row.status===tab),labels={PENDING:'Pending',APPROVED:'Approved',REJECTED:'Rejected'}
  async function act(approve){try{await processManualDeposit({depositId:confirm.row.id,approve});notify(`Deposit ${approve?'approved':'rejected'}.`);setConfirm(null);await load()}catch(actionError){setError(actionError instanceof Error?actionError.message:'Unable to process deposit.');setConfirm(null)}}
  return <><PageTitle eyebrow="PAYMENT OPERATIONS" title="Deposits" subtitle="Review player payment proofs and confirm wallet credits."/><AdminTabs items={Object.keys(labels)} value={tab} onChange={setTab}/><Panel className="admin-table-deposits" title={`${labels[tab]} deposits`} subtitle={`${visible.length} requests in this queue`}><DataState loading={loading} error={error} retry={load} empty={!visible.length}><div className="table-wrap"><table><thead><tr><th>Request</th><th>Player</th><th>Amount</th><th>Method</th><th>Requested</th><th>Status</th><th>Actions</th></tr></thead><tbody>{visible.map(row=><tr key={row.id}><td><strong>{row.id.slice(0,8)}</strong></td><td>{row.user?.full_name||row.user_id}<small>{row.user?.phone||''}</small></td><td><strong>{formatINR(Number(row.amount))}</strong></td><td>{row.payment_method?.display_name||row.payment_method?.provider}</td><td>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(row.created_at))}</td><td><Status>{labels[row.status]}</Status></td><td><div className="table-actions"><Button variant="ghost" onClick={()=>setProof(row)}>View proof</Button>{row.status==='PENDING'&&<><Button variant="success" onClick={()=>setConfirm({row,approve:true})}>Approve</Button><Button variant="danger-outline" onClick={()=>setConfirm({row,approve:false})}>Reject</Button></>}</div></td></tr>)}</tbody></table></div></DataState></Panel>{confirm&&<ConfirmModal title={`${confirm.approve?'Approve':'Reject'} deposit?`} message={`${confirm.approve?'Approve and credit':'Reject'} ${formatINR(Number(confirm.row.amount))} for ${confirm.row.user?.full_name||'this player'}?`} confirmLabel={confirm.approve?'Approve':'Reject'} danger={!confirm.approve} onClose={()=>setConfirm(null)} onConfirm={()=>act(confirm.approve)}/ >}{proof&&<Modal title={`Payment proof · ${proof.id.slice(0,8)}`} onClose={()=>setProof(null)}><div className="proof-preview"><strong>{formatINR(Number(proof.amount))}</strong><small>{proof.user?.full_name||proof.user_id} · {proof.payment_method?.display_name}</small><img src={proof.proof_url} alt="Manual deposit proof" style={{maxWidth:'100%',maxHeight:420,objectFit:'contain'}}/></div><div className="modal-actions"><Button variant="secondary" onClick={()=>setProof(null)}>Close</Button></div></Modal>}</>
}

function Payouts({notify}) {
  const [rows,setRows]=useState([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[confirm,setConfirm]=useState(null),[busy,setBusy]=useState(false),[actionError,setActionError]=useState('')
  const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(await getAdminWithdrawals())}catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load payouts.')}finally{setLoading(false)}},[])
  useEffect(()=>{queueMicrotask(load)},[load])
  async function process(event){event.preventDefault();setBusy(true);setActionError('');try{const values=new FormData(event.currentTarget);if(confirm.action==='approve')await approveWithdrawal({withdrawalId:confirm.row.id,utr:values.get('utr'),payoutTransactionId:values.get('transactionId')});else await rejectWithdrawal(confirm.row.id);notify(confirm.action==='approve'?'Withdrawal payout marked successful.':'Withdrawal rejected and refunded.');setConfirm(null);await load()}catch(processError){setActionError(processError instanceof Error?processError.message:'Unable to process withdrawal.')}finally{setBusy(false)}}
  return <><PageTitle eyebrow="PAYMENT OPERATIONS" title="Payouts" subtitle="Review withdrawal requests and keep payouts moving securely."/><Panel className="admin-table-payouts" title="Withdrawal requests" subtitle={`${rows.filter(row=>row.status==='INITIATED').length} requests need attention`}><DataState loading={loading} error={error} retry={load} empty={!rows.length}><div className="table-wrap"><table><thead><tr><th>User</th><th>Phone</th><th>Amount</th><th>UPI ID</th><th>Requested date</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.wallet?.user?.full_name||'Player'}</strong><small>{row.id.slice(0,8)}</small></td><td>{row.wallet?.user?.phone||'—'}</td><td><strong>{formatINR(Number(row.amount))}</strong></td><td>{row.payout_upi_id}</td><td>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(row.created_at))}</td><td><Status>{row.status.replaceAll('_',' ')}</Status></td><td>{row.status==='INITIATED'&&<div className="table-actions"><Button variant="success" onClick={()=>{setActionError('');setConfirm({row,action:'approve'})}}>Approve payout</Button><Button variant="danger-outline" onClick={()=>{setActionError('');setConfirm({row,action:'reject'})}}>Reject</Button></div>}</td></tr>)}</tbody></table></div></DataState></Panel>{confirm&&<Modal title={confirm.action==='approve'?'Approve payout?':'Reject payout?'} onClose={()=>!busy&&setConfirm(null)}><form className="form-stack" onSubmit={process}><p>{formatINR(Number(confirm.row.amount))} payout to {confirm.row.payout_upi_id}</p>{confirm.action==='approve'&&<><FormField label="UTR"><input name="utr" maxLength="255" required/></FormField><FormField label="Payout transaction ID"><input name="transactionId" maxLength="255" required/></FormField></>}{actionError&&<p className="auth-error" role="alert">{actionError}</p>}<div className="modal-actions"><Button variant="secondary" type="button" disabled={busy} onClick={()=>setConfirm(null)}>Cancel</Button><Button variant={confirm.action==='reject'?'danger':'primary'} type="submit" disabled={busy}>{busy?'Processing…':confirm.action==='approve'?'Mark successful':'Reject and refund'}</Button></div></form></Modal>}</>
}

function Settlements({notify}) {
  const [decision,setDecision]=useState(null)
  const [selectedMatchId,setSelectedMatchId]=useState('')
  const [settlementDetail,setSettlementDetail]=useState(null)
  const [detailLoading,setDetailLoading]=useState(false)
  const [detailError,setDetailError]=useState('')
  const [rows,setRows]=useState([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [busy,setBusy]=useState(false)
  const [decisionError,setDecisionError]=useState('')
  const detailRevision=useRef(0)
  const loadQueue=useCallback(async()=>{
    setLoading(true)
    setError('')
    try{setRows(await getPendingSettlements())}
    catch(queueError){setError(queueError instanceof Error?queueError.message:'Unable to load match settlements.')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadQueue()})
    return()=>{cancelled=true}
  },[loadQueue])
  useEffect(()=>()=>releaseSettlementEvidence(settlementDetail),[settlementDetail])
  const loadDetail=useCallback(async()=>{
    if(!selectedMatchId)return
    const revision=++detailRevision.current
    setDetailLoading(true)
    setDetailError('')
    try{
      const detail=await getSettlement(selectedMatchId)
      if(revision===detailRevision.current)setSettlementDetail(detail)
      else releaseSettlementEvidence(detail)
    }catch(detailLoadError){
      if(revision===detailRevision.current)setDetailError(detailLoadError instanceof Error?detailLoadError.message:'Unable to load settlement details.')
    }finally{
      if(revision===detailRevision.current)setDetailLoading(false)
    }
  },[selectedMatchId])
  useEffect(()=>{
    if(selectedMatchId)queueMicrotask(loadDetail)
  },[loadDetail,selectedMatchId])
  function closeDetail(){
    detailRevision.current+=1
    setSelectedMatchId('')
    setSettlementDetail(null)
    setDetailError('')
  }
  async function completeDecision(event){
    event?.preventDefault()
    if(!decision)return
    setBusy(true)
    setDecisionError('')
    try{
      let response
      if(decision.action==='Declare Winner'){
        const winnerUserId=new FormData(event.currentTarget).get('winnerUserId')
        response=await declareWinner(decision.row.id,winnerUserId)
      }else if(decision.action==='Refund Both'){
        response=await refundBothPlayers(decision.row.id)
      }else{
        const reason=String(new FormData(event.currentTarget).get('reason')||'').trim()
        if(reason.length<5||reason.length>500){
          setDecisionError('Enter a rejection reason between 5 and 500 characters.')
          setBusy(false)
          return
        }
        response=await rejectWinnerClaim(decision.row.id,reason)
      }
      const payoutMessage=decision.action==='Declare Winner'&&response.data?.winnerAmount!==undefined
        ?` Winner payout ${formatINR(Number(response.data.winnerAmount))}; platform fee ${formatINR(Number(response.data.platformFee))}.`
        :''
      notify(`${response.message||`${decision.action} completed for match ${decision.row.id.slice(0,8)}.`}${payoutMessage}`)
      setDecision(null)
      await loadQueue()
    }catch(actionError){
      setDecisionError(actionError instanceof Error?actionError.message:'Unable to settle this match.')
    }finally{
      setBusy(false)
    }
  }
  function playerLabel(player,label){
    return player?`${label}: ${player.name} · ${player.id.slice(0,8)}`:`${label}: Not joined`
  }
  function claimLabel(row){
    if(!row.winnerClaimedBy)return 'No claim'
    const claimant=row.player1?.id===row.winnerClaimedBy?row.player1:row.player2
    return claimant?.name||row.winnerClaimedBy.slice(0,8)
  }
  function eligibleWinners(row){
    const players=[row.player1,row.player2].filter(Boolean)
    return row.status==='DISPUTED'
      ?players
      :players.filter(player=>player.id===row.winnerClaimedBy)
  }
  return <>
    <PageTitle eyebrow="MATCH OPERATIONS" title="Settlements" subtitle="Review winner claims, screenshots, and match disputes."/>
    <Panel className="admin-table-settlements" title="Match settlements" subtitle="Review claims and resolve matches atomically">
      <DataState loading={loading} error={error} retry={loadQueue} empty={!rows.length}>
        <div className="table-wrap"><table><thead><tr><th>Match</th><th>Players</th><th>Entry</th><th>Prize pool</th><th>Winner claim</th><th>Evidence</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}>
          <td><strong>{row.game?.name||'Match'}</strong><small>{row.id.slice(0,8)}</small></td>
          <td><small>{playerLabel(row.player1,'Player 1')}</small><small>{playerLabel(row.player2,'Player 2')}</small></td>
          <td>{formatINR(Number(row.player1?.amount||0))}</td><td>{formatINR(Number(row.prizePool||0))}</td>
          <td>{claimLabel(row)}<small>{row.winnerClaimStatus||''}</small></td>
          <td><button className="text-link" type="button" onClick={()=>{setSettlementDetail(null);setSelectedMatchId(row.id)}}>View evidence</button></td>
          <td><Status>{row.status}</Status></td>
          <td><div className="table-actions">
            {row.winnerClaimStatus==='PENDING'&&<Button variant="success" onClick={()=>{setDecisionError('');setDecision({row,action:'Declare Winner'})}}>Declare winner</Button>}
            {['COMPLETED','DISPUTED'].includes(row.status)&&row.player2&&<Button variant="secondary" onClick={()=>{setDecisionError('');setDecision({row,action:'Refund Both'})}}>Refund both</Button>}
            {row.winnerClaimStatus==='PENDING'&&<Button variant="danger-outline" onClick={()=>{setDecisionError('');setDecision({row,action:'Reject Claim'})}}>Reject claim</Button>}
          </div></td>
        </tr>)}</tbody></table></div>
      </DataState>
    </Panel>
    {decision&&<Modal title={`${decision.action}?`} onClose={()=>!busy&&setDecision(null)}>
      <form className="form-stack" onSubmit={completeDecision}>
        {decision.action==='Declare Winner'&&<p>Choose the match winner. The backend will calculate the final fee and wallet payout.</p>}
        {decision.action==='Refund Both'&&<p>Refund each player’s original entry amount and cancel this match.</p>}
        {decision.action==='Reject Claim'&&<p>Rejecting this claim will refund both players’ original entry amounts and cancel this match.</p>}
        {decision.action==='Declare Winner'&&<FormField label="Select winner"><select name="winnerUserId" required defaultValue={decision.row.winnerClaimedBy}>{eligibleWinners(decision.row).map(player=><option key={player.id} value={player.id}>{playerLabel(player,player.id===decision.row.player1.id?'Player 1':'Player 2')}</option>)}</select></FormField>}
        {decision.action==='Reject Claim'&&<FormField label="Rejection reason" hint="Enter between 5 and 500 characters."><textarea name="reason" rows="3" minLength="5" maxLength="500" required/></FormField>}
        {decisionError&&<p className="auth-error" role="alert">{decisionError}</p>}
        <div className="modal-actions"><Button variant="secondary" type="button" disabled={busy} onClick={()=>setDecision(null)}>Cancel</Button><Button variant={decision.action==='Reject Claim'?'danger':'primary'} type="submit" disabled={busy}>{busy?'Processing…':decision.action}</Button></div>
      </form>
    </Modal>}
    {selectedMatchId&&<Modal title={`Settlement details · ${selectedMatchId.slice(0,8)}`} onClose={closeDetail}>
      <DataState loading={detailLoading} error={detailError} retry={loadDetail} empty={false}>
        {settlementDetail&&(()=>{
          const match=settlementDetail.match
          const player1=match.player1
          const player2=match.player2
          const claimant=player1?.id===match.winnerClaimedBy?player1:player2
          const disputer=player1?.id===match.disputeClaimedBy?player1:player2
          return <div className="form-stack">
            <div className="match-status-line"><Status>{match.status}</Status><span>{match.game?.name||'Match'}</span></div>
            <p><strong>Match ID:</strong> {match.id}</p>
            <p><strong>Player 1:</strong> {player1?.name||'—'} · {player1?.phone||'—'} · {formatINR(Number(player1?.amount||0))}</p>
            <p><strong>Player 2:</strong> {player2?.name||'—'} · {player2?.phone||'—'} · {player2?formatINR(Number(player2.amount)): 'Not joined'}</p>
            <div className="financial-grid">
              <div><small>Prize pool</small><strong>{formatINR(Number(match.financials.prizePool||0))}</strong></div>
              <div><small>Platform fee</small><strong>{formatINR(Number(match.financials.platformFee||0))}</strong></div>
              <div><small>Winner amount</small><strong>{formatINR(Number(match.financials.winnerAmount||0))}</strong></div>
              {match.financials.refundAmountPerPlayer!==null&&<div><small>Refund per player</small><strong>{formatINR(Number(match.financials.refundAmountPerPlayer))}</strong></div>}
            </div>
            <p><strong>Room code:</strong> {match.roomCode||'Not set'}</p>
            <p><strong>Winner claim:</strong> {claimant?.name||'No claimant'} · {match.winnerClaimStatus||'—'}</p>
            {match.winnerClaimRemarks&&<p><strong>Claim remarks:</strong> {match.winnerClaimRemarks}</p>}
            <p><strong>Winner:</strong> {match.winnerPlayer?.name||'Not settled'}</p>
            <p><strong>Disputer:</strong> {disputer?.name||'—'}</p>
            {match.disputeReason&&<p><strong>Dispute reason:</strong> {match.disputeReason}</p>}
            <p><strong>Created:</strong> {formatIndiaDateTime(match.createdAt)}</p>
            <p><strong>Players joined:</strong> {match.joinedAt?formatIndiaDateTime(match.joinedAt):'—'}</p>
            {match.completedAt&&<p><strong>Completed:</strong> {formatIndiaDateTime(match.completedAt)}</p>}
            {match.settlement.settledAt&&<p><strong>Finalized:</strong> {formatIndiaDateTime(match.settlement.settledAt)} · by {match.settlement.settledBy?.name||'admin'}</p>}
            {match.settlement.settlementReason&&<p><strong>Settlement note:</strong> {match.settlement.settlementReason}</p>}
            {match.player1ScreenshotUrl&&<div><small>Player 1 screenshot</small><img src={match.player1ScreenshotUrl} alt="Player 1 match evidence" style={{maxWidth:'100%',maxHeight:360,objectFit:'contain'}}/></div>}
            {match.player2ScreenshotUrl&&<div><small>Player 2 screenshot</small><img src={match.player2ScreenshotUrl} alt="Player 2 match evidence" style={{maxWidth:'100%',maxHeight:360,objectFit:'contain'}}/></div>}
            {settlementDetail.walletTransactions.length>0&&<div className="form-stack"><strong>Wallet transactions</strong>{settlementDetail.walletTransactions.map(transaction=><p key={transaction.id}>{transaction.transactionType} · {formatINR(Number(transaction.amount))} · {transaction.status} · {transaction.id.slice(0,8)}</p>)}</div>}
            <div className="modal-actions"><Button variant="secondary" onClick={closeDetail}>Close</Button></div>
          </div>
        })()}
      </DataState>
    </Modal>}
  </>
}

function GamesAdmin({notify}) {
  const [rows,setRows]=useState([]),[editing,setEditing]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(await getAdminGames())}catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load games.')}finally{setLoading(false)}},[])
  useEffect(()=>{queueMicrotask(load)},[load])
  async function saveGame(event){
    event.preventDefault();setSaving(true);setError('')
    try{
      const form=new FormData(event.currentTarget)
      const gameData={gameCode:Number(form.get('gameCode')),name:String(form.get('name')).trim(),imageUrl:String(form.get('imageUrl')||'').trim(),isActive:form.get('isActive')==='on',isOpen:form.get('isOpen')==='on'}
      if(!gameData.imageUrl&&editing==='new')delete gameData.imageUrl
      if(editing==='new')await createGame(gameData)
      else await updateGame(editing.id,gameData)
      notify(`Game ${editing==='new'?'added':'updated'}.`);setEditing(null);await load()
    }catch(saveError){setError(saveError instanceof Error?saveError.message:'Unable to save game.')}
    finally{setSaving(false)}
  }
  async function toggleGame(game,key){
    setError('')
    try{
      if(key==='active')await toggleGameStatus(game.id,!game.isActive)
      else await toggleGameOpenStatus(game.id,!game.isOpen)
      notify(`${game.name} availability updated.`);await load()
    }
    catch(toggleError){setError(toggleError instanceof Error?toggleError.message:'Unable to update game.')}
  }
  return <><PageTitle eyebrow="CATALOG MANAGEMENT" title="Games" subtitle="Manage the games available to players." action={<Button onClick={()=>setEditing('new')}><Plus size={16}/> Add game</Button>}/><Panel title="Game catalog" subtitle="Edit listing details or switch game availability."><DataState loading={loading} error={error} retry={load} empty={!rows.length}><div className="admin-game-list">{rows.map(game=><article className="admin-game-row" key={game.id}>{game.imageUrl?<GameImage className="game-mini" src={game.imageUrl} alt="" fallback={<div className="game-mini">🎮</div>}/>:<div className="game-mini">🎮</div>}<div className="row-grow"><strong>{game.name}</strong><small>Code {game.gameCode} · Matchmaking {game.isOpen?'open':'closed'}</small></div><Status>{game.isActive?'Active':'Inactive'}</Status><Button variant="ghost" onClick={()=>setEditing(game)}>Edit</Button><Button variant="secondary" onClick={()=>toggleGame(game,'active')}>{game.isActive?'Deactivate':'Activate'}</Button><Button variant="secondary" onClick={()=>toggleGame(game,'open')}>{game.isOpen?'Close lobby':'Open lobby'}</Button></article>)}</div></DataState></Panel>{editing&&<Modal title={editing==='new'?'Add a game':`Edit ${editing.name}`} onClose={()=>!saving&&setEditing(null)}><form className="form-stack" onSubmit={saveGame}><FormField label="Game name"><input name="name" required maxLength="120" defaultValue={editing==='new'?'':editing.name} placeholder="e.g. Table Tennis"/></FormField><FormField label="Game code"><input name="gameCode" type="number" min="1" step="1" required defaultValue={editing==='new'?'':editing.gameCode} placeholder="Enter a positive number"/></FormField><FormField label="Game image URL"><input name="imageUrl" type="text" defaultValue={editing==='new'?'':editing.imageUrl||''} placeholder="https://example.com/game-image.png"/></FormField><label className="check-field"><input name="isActive" type="checkbox" defaultChecked={editing==='new'||editing.isActive}/> Active</label><label className="check-field"><input name="isOpen" type="checkbox" defaultChecked={editing==='new'||editing.isOpen}/> Open for matchmaking</label>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="modal-actions"><Button variant="secondary" type="button" disabled={saving} onClick={()=>setEditing(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Saving…':editing==='new'?'Add game':'Save changes'}</Button></div></form></Modal>}</>
}

function PaymentsAdmin({notify}) {
  const [methods,setMethods]=useState([]),[editingMethod,setEditingMethod]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[saving,setSaving]=useState(false)
  const isEditing=typeof editingMethod==='object'&&editingMethod!==null
  const load=useCallback(async()=>{setLoading(true);setError('');try{setMethods(await getAdminPaymentMethods())}catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load payment methods.')}finally{setLoading(false)}},[])
  useEffect(()=>{queueMicrotask(load)},[load])
  async function saveMethod(event){
    event.preventDefault();setSaving(true);setError('')
    try{
      const form=new FormData(event.currentTarget),file=form.get('qr')
      const qrStoragePath=file instanceof File&&file.size?await uploadPaymentQr(file):isEditing?editingMethod.qr_storage_path:null
      await saveAdminPaymentMethod({id:editingMethod?.id,displayName:form.get('displayName'),provider:form.get('provider'),upiId:form.get('upi'),payeeName:form.get('payee'),qrStoragePath,isActive:form.get('isActive')==='on'})
      notify(`Payment method ${isEditing?'updated':'added'}.`);setEditingMethod(null);await load()
    }catch(saveError){setError(saveError instanceof Error?saveError.message:'Unable to save payment method.')}
    finally{setSaving(false)}
  }
  async function activate(method){
    try{await saveAdminPaymentMethod({id:method.id,displayName:method.display_name,provider:method.provider,upiId:method.upi_id,payeeName:method.payee_name,qrStoragePath:method.qr_storage_path,isActive:true});notify('Payment method activated.');await load()}
    catch(activateError){setError(activateError instanceof Error?activateError.message:'Unable to activate payment method.')}
  }
  return <><PageTitle eyebrow="PAYMENT CONFIGURATION" title="Payment methods" subtitle="Configure collection accounts and QR codes. Only one method can be active." action={<Button onClick={()=>{setError('');setEditingMethod('new')}}><Plus size={16}/> Add payment method</Button>}/><div className="info-banner"><ShieldCheck size={18}/><span>Exactly one payment method should remain active so deposits are routed consistently.</span></div><DataState loading={loading} error={error} retry={load} empty={!methods.length}><div className="payment-method-grid">{methods.map(method=><article className={`payment-method ${method.is_active?'method-active':''}`} key={method.id}><div className="payment-method-head"><span className="upi-mark">{method.provider==='manual_upi'?'UPI':'GATEWAY'}</span><Status>{method.is_active?'Active':'Inactive'}</Status></div><small>{method.provider==='manual_upi'?'COLLECTION UPI ID':'PAYMENT GATEWAY'}</small><strong className="upi-value">{method.upi_id||method.display_name}</strong><p>{method.payee_name||method.display_name}</p><div className="qr-box">{method.qr_url?<img src={method.qr_url} alt="Payment QR code" style={{width:88,height:88,objectFit:'contain'}}/>:<span className="qr-mock">▦</span>}<span><strong>{method.qr_storage_path?'Collection QR code':'No QR image'}</strong><small>{method.display_name}</small></span></div><div className="table-actions"><Button variant="ghost" onClick={()=>{setError('');setEditingMethod(method)}}>Edit</Button><Button variant={method.is_active?'secondary':'primary'} disabled={method.is_active} onClick={()=>activate(method)}>{method.is_active?'Currently active':'Make active'}</Button></div></article>)}</div></DataState>{editingMethod!==null&&<Modal title={isEditing?'Edit payment method':'Add payment method'} onClose={()=>!saving&&setEditingMethod(null)}><form className="form-stack" onSubmit={saveMethod}><FormField label="Display name"><input name="displayName" maxLength="160" required defaultValue={editingMethod?.display_name||''} placeholder="Primary UPI collection"/></FormField><FormField label="Provider"><select name="provider" defaultValue={editingMethod?.provider||'manual_upi'}><option value="manual_upi">Manual UPI</option><option value="gateway">Payment gateway</option></select></FormField><FormField label="UPI ID"><input name="upi" defaultValue={editingMethod?.upi_id||''} placeholder="payments@bank"/></FormField><FormField label="Payee name"><input name="payee" defaultValue={editingMethod?.payee_name||''} placeholder="Registered business name"/></FormField><FormField label="QR image"><input name="qr" type="file" accept="image/jpeg,image/png,image/webp"/></FormField><label className="check-field"><input name="isActive" type="checkbox" defaultChecked={Boolean(editingMethod?.is_active)}/> Make active (deactivates the previous method)</label>{error&&<p className="auth-error" role="alert">{error}</p>}<div className="modal-actions"><Button variant="secondary" type="button" disabled={saving} onClick={()=>setEditingMethod(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Saving…':'Save method'}</Button></div></form></Modal>}</>
}

function UsersAdmin({notify}) {
  const [rows,setRows]=useState([]),[query,setQuery]=useState(''),[filter,setFilter]=useState('All users'),[loading,setLoading]=useState(true),[error,setError]=useState('')
  const load=useCallback(async()=>{setLoading(true);setError('');try{setRows(await getAdminUsers())}catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load users.')}finally{setLoading(false)}},[])
  useEffect(()=>{queueMicrotask(load)},[load])
  const visible=rows.filter(user=>`${user.full_name||''} ${user.phone||''} ${user.id}`.toLowerCase().includes(query.toLowerCase())&&(filter==='All users'||(filter==='Active users'?user.active&&!user.is_blocked:filter==='Blocked users'?user.is_blocked:true)))
  async function update(user,action){
    const updateData={userId:user.id}
    if(action==='Block')updateData.blocked=true
    else if(action==='Unblock')updateData.blocked=false
    else if(action==='Activate')updateData.active=true
    else if(action==='Deactivate')updateData.active=false
    else if(action==='Promote')updateData.userType='admin'
    else updateData.userType='player'
    try{await updateAdminUser(updateData);notify(`${user.full_name||user.phone}: ${action.toLowerCase()} action applied.`);await load()}
    catch(updateError){setError(updateError instanceof Error?updateError.message:'Unable to update user.')}
  }
  return <><PageTitle eyebrow="PLAYER MANAGEMENT" title="Users" subtitle="Search player accounts and manage access or roles."/><div className="toolbar"><label className="search-field"><Search size={16}/><input aria-label="Search players" value={query} onChange={event=>setQuery(event.target.value)} placeholder="Search by name, phone, or ID"/></label><AdminTabs items={['All users','Active users','Blocked users']} value={filter} onChange={setFilter}/></div><Panel className="admin-table-users" title="Player accounts" subtitle={`${visible.length} accounts shown`}><DataState loading={loading} error={error} retry={load} empty={!visible.length}><div className="table-wrap"><table><thead><tr><th>User</th><th>Phone</th><th>Joined</th><th>Matches</th><th>Balance</th><th>Status / role</th><th>Actions</th></tr></thead><tbody>{visible.map(user=><tr key={user.id}><td><strong>{user.full_name||'Unnamed player'}</strong><small>{user.id}</small></td><td>{user.phone||'—'}</td><td>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeZone:'Asia/Kolkata'}).format(new Date(user.created_at))}</td><td>{user.matches}</td><td>{formatINR(user.balance)}</td><td><Status>{user.is_blocked?'Blocked':user.active?'Active':'Inactive'}</Status><small>{user.user_type}</small></td><td><select className="action-select" value="" aria-label={`Actions for ${user.full_name||user.phone}`} onChange={event=>event.target.value&&update(user,event.target.value)}><option value="" disabled>Choose action</option>{user.is_blocked?<option>Unblock</option>:<><option>Block</option>{user.active?<option>Deactivate</option>:<option>Activate</option>}</>}{user.user_type==='admin'?<option>Demote</option>:<option>Promote</option>}</select></td></tr>)}</tbody></table></div></DataState></Panel></>
}

function SupportAdmin({notify}) {
  const [tab,setTab]=useState('OPEN')
  const [rows,setRows]=useState([])
  const [selected,setSelected]=useState(null)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const [saving,setSaving]=useState(false)
  const [saveError,setSaveError]=useState('')
  const loadTickets=useCallback(async()=>{
    setLoading(true)
    setError('')
    try{setRows(await getAdminSupportTickets())}
    catch(loadError){setError(loadError instanceof Error?loadError.message:'Unable to load support tickets.')}
    finally{setLoading(false)}
  },[])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadTickets()})
    return()=>{cancelled=true}
  },[loadTickets])
  const visible=rows.filter(ticket=>ticket.status===tab)
  async function saveTicket(event){
    event.preventDefault()
    if(!selected)return
    setSaving(true)
    setSaveError('')
    try{
      const values=new FormData(event.currentTarget)
      await updateSupportTicket({
        ticketId:selected.id,
        status:values.get('status'),
        resolution:values.get('resolution'),
      })
      notify(`Ticket ${selected.id.slice(0,8)} updated.`)
      setSelected(null)
      await loadTickets()
    }catch(updateError){
      setSaveError(updateError instanceof Error?updateError.message:'Unable to update support ticket.')
    }finally{
      setSaving(false)
    }
  }
  const statusLabel=status=>status.replaceAll('_',' ').toLowerCase().replace(/\b\w/g,letter=>letter.toUpperCase())
  return <>
    <PageTitle eyebrow="PLAYER CARE" title="Support tickets" subtitle="Review player requests, add resolutions, and close tickets."/>
    <AdminTabs items={['OPEN','IN_PROGRESS','RESOLVED','CLOSED']} value={tab} onChange={setTab}/>
    <Panel className="admin-table-support" title={`${statusLabel(tab)} tickets`} subtitle={`${visible.length} tickets in this queue`}>
      <DataState loading={loading} error={error} retry={loadTickets} empty={!visible.length}>
        <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Player</th><th>Topic</th><th>Created</th><th>Status</th><th>Action</th></tr></thead><tbody>{visible.map(ticket=><tr key={ticket.id}>
          <td><strong>{ticket.id.slice(0,8)}</strong></td><td>{ticket.user?.full_name||ticket.user_id}<small>{ticket.user?.phone||''}</small></td><td>{ticket.subject}</td>
          <td>{new Intl.DateTimeFormat('en-IN',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Kolkata'}).format(new Date(ticket.created_at))}</td>
          <td><Status>{statusLabel(ticket.status)}</Status></td>
          <td><Button variant="secondary" onClick={()=>{setSaveError('');setSelected(ticket)}}>Review</Button></td>
        </tr>)}</tbody></table></div>
      </DataState>
    </Panel>
    {selected&&<Modal title={`Ticket ${selected.id.slice(0,8)}`} onClose={()=>!saving&&setSelected(null)}><form className="form-stack" onSubmit={saveTicket}>
      <p><strong>{selected.subject}</strong><br/>{selected.category} · {selected.user?.full_name||selected.user_id}</p>
      <p>{selected.description}</p>
      {selected.image_url&&<img src={selected.image_url} alt="Support ticket attachment" style={{maxWidth:'100%',maxHeight:360,objectFit:'contain'}}/>}
      <FormField label="Status"><select name="status" defaultValue={selected.status}>{['OPEN','IN_PROGRESS','RESOLVED','CLOSED'].map(status=><option key={status} value={status}>{statusLabel(status)}</option>)}</select></FormField>
      <FormField label="Resolution" hint="Required when resolving or closing the ticket"><textarea name="resolution" rows="4" maxLength="4000" defaultValue={selected.resolution||''}/></FormField>
      {saveError&&<p className="auth-error" role="alert">{saveError}</p>}
      <div className="modal-actions"><Button variant="secondary" type="button" disabled={saving} onClick={()=>setSelected(null)}>Cancel</Button><Button type="submit" disabled={saving}>{saving?'Saving…':'Save ticket'}</Button></div>
    </form></Modal>}
  </>
}
