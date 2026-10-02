import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import { Button, ConfirmModal, CopyButton, DataState, FormField, PageTitle, Panel, Status } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { formatINR, player } from '../../data/mockData';
import { cancelMatch, getMatch, leaveMatch, submitMatchDispute, submitRoomCode, submitWinnerClaim, subscribeToMatch } from '../../services/matchService';

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
