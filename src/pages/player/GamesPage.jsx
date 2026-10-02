import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, ConfirmModal, DataState, FormField, Modal, PageTitle, Panel, Status } from '../../components/common';
import { useAuth } from '../../hooks/useAuth';
import { formatINR, games } from '../../data/mockData';
import { getPlayableGames } from '../../services/gameService';
import { createMatch as createMatchRequest, getOpenMatches, joinMatch as joinMatchRequest, subscribeToLobby } from '../../services/matchService';
import { GameTile } from '../../components/games/GameCard'

export function GamesPage() {
  const [filter, setFilter] = useState('All games')
  const [games, setGames] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  const loadGames = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      setGames(await getPlayableGames())
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load games.')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    let isCancelled = false
    queueMicrotask(() => {
      if (!isCancelled) loadGames()
    })

    return () => {
      isCancelled = true
    }
  }, [loadGames])

  const availableCategories = ['All games', ...new Set(games.map(game => game.category))]
  const visibleGames = filter === 'All games'
    ? games
    : games.filter(game => game.category === filter)

  return (
    <>
      <PageTitle
        eyebrow="GAME LOBBY"
        title="Choose your game"
        subtitle="Play for fun, compete for prizes, and keep it friendly."
      />
      <div className="filter-tabs">
        {availableCategories.map(category => (
          <button
            key={category}
            type="button"
            aria-pressed={filter === category}
            className={filter === category ? 'selected' : ''}
            onClick={() => setFilter(category)}
          >
            {category}
          </button>
        ))}
      </div>
      <DataState loading={isLoading} error={error} retry={loadGames} empty={!visibleGames.length}>
        <div className="game-grid game-grid-page">
          {visibleGames.map(game => <GameTile key={game.id} game={game} />)}
        </div>
      </DataState>
    </>
  )
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
