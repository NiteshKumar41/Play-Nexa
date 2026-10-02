import { useCallback, useEffect, useState } from 'react';
import { Headphones, Plus, ShieldCheck } from 'lucide-react';
import { Button, DataState, FormField, Modal, PageTitle, Panel, Status } from '../../components/common';
import { createSupportTicket, getMySupportTickets } from '../../services/supportService';

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
