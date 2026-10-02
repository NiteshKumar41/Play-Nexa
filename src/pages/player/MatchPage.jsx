import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button, ConfirmModal, CopyButton, DataState, FormField, Modal, PageTitle, Panel, Status } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { formatINR, player } from '../../data/mockData';
import { cancelMatch, getMatch, leaveMatch, updateRoomCode, subscribeToMatch } from '../../services/matchService';
import { SOCKET_EVENTS } from '../../services/socketService';
import { getResult, releaseResultEvidence, submitDispute, submitWinnerClaim } from '../../services/resultService';

const MAX_SCREENSHOT_SIZE = 5 * 1024 * 1024
const SCREENSHOT_EXTENSIONS = {
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'image/webp': ['.webp'],
}

function getScreenshotError(file) {
  if (!(file instanceof File) || file.size === 0) return 'Choose a screenshot to continue.'
  if (file.size > MAX_SCREENSHOT_SIZE) return 'Screenshot must be 5 MB or smaller.'

  const allowedExtensions = SCREENSHOT_EXTENSIONS[file.type]
  const hasAllowedExtension = allowedExtensions?.some(extension =>
    file.name.toLowerCase().endsWith(extension),
  )
  if (!hasAllowedExtension) return 'Choose a JPG, PNG, or WEBP image.'

  return ''
}

function getResultMessage(status, claimStatus) {
  if (status === 'disputed') return 'Match under review. No further result changes are available while the dispute is active.'
  if (status === 'settled') return 'Match settled. The winner claim was approved.'
  if (claimStatus === 'APPROVED') return 'Winner claim approved.'
  if (claimStatus === 'REJECTED' || status === 'rejected') return 'Winner claim rejected.'
  return 'Winner claim submitted. Status: pending review. No prize has been paid.'
}

async function loadMatchResult(matchId, status) {
  if (!['completed', 'disputed', 'settled', 'rejected'].includes(status)) return null

  try{
    return await getResult(matchId)
  }catch(error){
    if(error.status===403)return null
    throw error
  }
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
  const [result,setResult]=useState(null)
  const [resultAction,setResultAction]=useState('')
  const [resultSubmitting,setResultSubmitting]=useState(false)
  const [resultError,setResultError]=useState('')
  const matchRef=useRef(null)
  const notifyRef=useRef(notify)
  const refreshRevision=useRef(0)
  useEffect(()=>{matchRef.current=match},[match])
  useEffect(()=>{notifyRef.current=notify},[notify])
  useEffect(()=>()=>releaseResultEvidence(result),[result])
  const loadMatch=useCallback(async()=>{
    const requestRevision=++refreshRevision.current
    setLoading(true)
    setError('')
    try{
      const loadedMatch=await getMatch(id)
      if(requestRevision===refreshRevision.current)setMatch(loadedMatch)
      if(requestRevision===refreshRevision.current){
        const loadedResult=await loadMatchResult(id,loadedMatch.status)
        if(requestRevision===refreshRevision.current)setResult(loadedResult)
        else releaseResultEvidence(loadedResult)
      }
    }catch(loadError){
      if(requestRevision===refreshRevision.current)setError(loadError instanceof Error?loadError.message:'Unable to load match details.')
    }finally{
      if(requestRevision===refreshRevision.current)setLoading(false)
    }
  },[id])
  const refreshMatch=useCallback(async()=>{
    const requestRevision=++refreshRevision.current
    try{
      const updatedMatch=await getMatch(id)
      if(requestRevision!==refreshRevision.current)return
      const updatedResult=await loadMatchResult(id,updatedMatch.status)
      if(requestRevision!==refreshRevision.current){
        releaseResultEvidence(updatedResult)
        return
      }
      const previousMatch=matchRef.current
      setMatch(updatedMatch)
      setResult(updatedResult)
      if(!previousMatch?.room_code&&updatedMatch.room_code)notifyRef.current('Room code is ready.')
      if(previousMatch?.status!==updatedMatch.status)notifyRef.current(`Match status updated: ${updatedMatch.status.replaceAll('_',' ')}.`)
    }catch(refreshError){
      if(requestRevision!==refreshRevision.current)return
      notifyRef.current(refreshError instanceof Error?refreshError.message:'Unable to refresh match details.')
    }
  },[id])
  useEffect(()=>{
    let cancelled=false
    queueMicrotask(()=>{if(!cancelled)loadMatch()})
    return()=>{cancelled=true}
  },[loadMatch])
  useEffect(()=>{
    return subscribeToMatch(id,(event,payload)=>{
      if(payload?.matchId&&payload.matchId!==id)return
      if(event===SOCKET_EVENTS.ROOM_CODE_UPDATED){
        const currentMatch=matchRef.current
        if(currentMatch?.room_code===payload.roomCode)return
        refreshRevision.current+=1
        if(currentMatch){
          const updatedMatch={...currentMatch,room_code:payload.roomCode}
          matchRef.current=updatedMatch
          setMatch(updatedMatch)
        }
        notifyRef.current('Room code is ready.')
        return
      }
      void refreshMatch()
    },message=>notifyRef.current(message))
  },[id,refreshMatch])
  async function handleRoomCodeSubmit(event){
    event.preventDefault()
    const form=new FormData(event.currentTarget)
    setSubmitting(true)
    setRoomError('')
    try{
      await updateRoomCode(id,form.get('roomCode'))
      await refreshMatch()
    }catch(submitError){
      setRoomError(submitError instanceof Error?submitError.message:'Unable to submit the room code.')
    }finally{
      setSubmitting(false)
    }
  }
  async function handleResultSubmit(event){
    event.preventDefault()
    const formData=new FormData(event.currentTarget)
    const screenshot=formData.get('screenshot')
    const screenshotError=getScreenshotError(screenshot)
    if(screenshotError){
      setResultError(screenshotError)
      return
    }

    const reason=String(formData.get('reason')||'').trim()
    if(resultAction==='dispute'&&(!reason||reason.length>2000)){
      setResultError('Enter a dispute reason of 1 to 2,000 characters.')
      return
    }
    const remarks=String(formData.get('remarks')||'').trim()
    if(resultAction==='claim'&&remarks.length>1000){
      setResultError('Remarks must be 1,000 characters or fewer.')
      return
    }

    setResultSubmitting(true)
    setResultError('')
    try{
      if(resultAction==='claim'){
        await submitWinnerClaim(id,{screenshot,remarks})
        notify('Result submitted. Waiting for review.')
      }else{
        await submitDispute(id,{reason,screenshot})
        notify('Dispute submitted. The match is under review.')
      }
      setResultAction('')
      await refreshMatch()
    }catch(submitError){
      setResultError(submitError instanceof Error?submitError.message:'Unable to submit match result.')
    }finally{
      setResultSubmitting(false)
    }
  }
  async function confirmMatchAction(){
    setSubmitting(true)
    try{
      if(action==='leave')await leaveMatch(id)
      else await cancelMatch(id)
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
  const canSubmitRoom=creator&&opponentJoined&&match.status==='in_progress'
  const isParticipant=creator||isOpponent
  const canClaimResult=isParticipant&&opponentJoined&&match.status==='in_progress'
  const canDisputeResult=isParticipant&&match.status==='completed'
    &&result?.winnerClaimStatus==='PENDING'&&result.winnerClaimedBy!==user?.id
  const resultWinnerName=result?.winnerPlayer===result?.player1
    ?result.player1Name
    :result?.winnerPlayer===result?.player2?result.player2Name:null
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
        <div className="room-code"><div><small>ROOM CODE</small><strong>{hasRoomCode?match.room_code:'Room code not available yet.'}</strong></div>{hasRoomCode&&<CopyButton value={match.room_code} onCopied={()=>notify('Room code copied')}/>}</div>
        {canSubmitRoom&&<form className="form-stack room-code-form" onSubmit={handleRoomCodeSubmit}><FormField label={hasRoomCode?'Update room code':'Room code'}><input name="roomCode" maxLength="64" defaultValue={match.room_code||''} required placeholder="Enter the game room code"/></FormField>{roomError&&<p className="auth-error" role="alert">{roomError}</p>}<Button type="submit" disabled={submitting}>{submitting?'Submitting…':hasRoomCode?'Update room code':'Share room code'}</Button></form>}
        <div className="match-status-line"><Status>{match.status.replaceAll('_',' ')}</Status><span>Game code: {match.game.slug}</span></div>
        {['completed','disputed','settled','rejected'].includes(match.status)&&<div className="notice"><p>{getResultMessage(match.status,result?.winnerClaimStatus)}</p></div>}
        {canClaimResult&&<Button onClick={()=>{setResultError('');setResultAction('claim')}}>Submit Result</Button>}
        {canDisputeResult&&<Button variant="secondary" onClick={()=>{setResultError('');setResultAction('dispute')}}>Dispute Result</Button>}
        {(canLeave||canCancel)&&<div className="button-row match-management-actions">{canLeave&&<Button variant="danger-outline" onClick={()=>setAction('leave')}>Leave and refund</Button>}{canCancel&&<Button variant="danger-outline" onClick={()=>setAction('cancel')}>Cancel and refund</Button>}</div>}
      </Panel>
      {result&&<Panel title="Match result" subtitle={getResultMessage(match.status,result.winnerClaimStatus)}>
        <div className="form-stack">
          <p>Winner claim status: {result.winnerClaimStatus?.toLowerCase()||'pending'}</p>
          {result.winnerPlayer&&<p>Winner: {resultWinnerName||'Match player'}</p>}
          {result.winnerClaimRemarks&&<p>{result.winnerClaimRemarks}</p>}
          {result.disputeReason&&<p>Dispute reason: {result.disputeReason}</p>}
          {result.player1ScreenshotUrl&&<div><small>Player 1 evidence</small><img src={result.player1ScreenshotUrl} alt="Player 1 match evidence" style={{display:'block',maxWidth:'100%',maxHeight:320,objectFit:'contain'}}/></div>}
          {result.player2ScreenshotUrl&&<div><small>Player 2 evidence</small><img src={result.player2ScreenshotUrl} alt="Player 2 match evidence" style={{display:'block',maxWidth:'100%',maxHeight:320,objectFit:'contain'}}/></div>}
        </div>
      </Panel>}
      <div className="content-grid match-actions">
        <Panel title="Game" subtitle={match.game.category}>
          <div className="lobby-hero"><div className="lobby-badge">{match.game.image_url?<img src={match.game.image_url} alt=""/>:'🎮'}</div><div className="lobby-hero-copy"><h2>{match.game.name}</h2><p>Game code: {match.game.slug}</p></div></div>
        </Panel>
      </div>
      {action&&<ConfirmModal title={action==='leave'?'Leave this match?':'Cancel this match?'} message={`Your ${formatINR(Number(match.entry_amount))} entry fee will be refunded. This can only be done before a room code is set.`} confirmLabel={submitting?'Processing…':'Confirm and refund'} danger onClose={()=>setAction('')} onConfirm={confirmMatchAction}/>}
      {resultAction&&<Modal title={resultAction==='claim'?'Submit match result':'Dispute result'} onClose={()=>setResultAction('')}>
        <form className="form-stack" onSubmit={handleResultSubmit}>
          {resultAction==='claim'
            ?<FormField label="Screenshot"><input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" required/></FormField>
            :<>
              <FormField label="Reason"><textarea name="reason" maxLength="2000" rows="3" required placeholder="Explain why you dispute the winner claim"/></FormField>
              <FormField label="Screenshot"><input name="screenshot" type="file" accept="image/png,image/jpeg,image/webp" required/></FormField>
            </>}
          {resultAction==='claim'&&<FormField label="Remarks (optional)"><textarea name="remarks" maxLength="1000" rows="2"/></FormField>}
          <p className="form-disclaimer">PNG, JPG, JPEG, or WEBP only; maximum 5 MB. A result claim is evidence for review and does not pay the prize.</p>
          {resultError&&<p className="auth-error" role="alert">{resultError}</p>}
          <div className="modal-actions"><Button variant="secondary" type="button" onClick={()=>setResultAction('')}>Cancel</Button><Button type="submit" disabled={resultSubmitting}>{resultSubmitting?'Submitting…':resultAction==='claim'?'Submit result':'Submit dispute'}</Button></div>
        </form>
      </Modal>}
    </>
  )
}
