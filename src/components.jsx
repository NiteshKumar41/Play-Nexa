import { useEffect, useRef, useState } from 'react'
import { Check, Copy, LoaderCircle, X } from 'lucide-react'
import { formatINR } from './data'

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return <button className={`btn btn-${variant} transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 ${className}`} {...props}>{children}</button>
}

export function PageTitle({ eyebrow, title, subtitle, action }) {
  return <div className="page-title"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return <section className={`panel ${className}`}><div className="panel-head"><div>{title && <h2>{title}</h2>}{subtitle && <p>{subtitle}</p>}</div>{action}</div>{children}</section>
}

export function Status({ children }) {
  const variant = String(children).toLowerCase().replaceAll(' ', '-')
  return <span className={`status status-${variant}`}><i />{children}</span>
}

export function Toast({ message, onClose }) {
  if (!message) return null
  return <div className="toast" role="status"><span><Check size={16}/></span>{message}<button onClick={onClose} aria-label="Dismiss message"><X size={15}/></button></div>
}

export function Modal({ title, children, onClose, wide = false }) {
  const dialog=useRef(null)
  const onCloseRef=useRef(onClose)
  useEffect(()=>{onCloseRef.current=onClose},[onClose])
  useEffect(()=>{const previous=document.activeElement;const oldOverflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.querySelector('button,input,select,textarea')?.focus();function onKey(event){if(event.key==='Escape'){onCloseRef.current();return}if(event.key==='Tab'){const focusable=[...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];if(!focusable.length){event.preventDefault();return}const first=focusable[0],last=focusable[focusable.length-1];if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus()}}}document.addEventListener('keydown',onKey);return()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=oldOverflow;previous?.focus?.()}},[])
  return <div className="modal-backdrop" onMouseDown={event => event.target === event.currentTarget && onClose()}><section ref={dialog} className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" tabIndex={-1}><header><h2 id="modal-title">{title}</h2><button className="icon-btn" aria-label="Close dialog" onClick={onClose}><X size={18}/></button></header>{children}</section></div>
}

export function ConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm, onClose, danger = false }) {
  return <Modal title={title} onClose={onClose}><p className="confirm-copy">{message}</p><div className="modal-actions"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>{confirmLabel}</Button></div></Modal>
}

export function Currency({ value, signed = false }) {
  return <>{signed && value > 0 ? '+' : ''}{formatINR(value)}</>
}

export function CopyButton({ value, onCopied }) {
  const [copied, setCopied] = useState(false)
  async function copy() {
    try { await navigator.clipboard.writeText(value) } catch { /* clipboard can be unavailable in preview */ }
    setCopied(true); onCopied?.(); window.setTimeout(() => setCopied(false), 1800)
  }
  return <button className="copy-btn" onClick={copy}>{copied ? <Check size={15}/> : <Copy size={15}/>} {copied ? 'Copied' : 'Copy code'}</button>
}

export function LoadingBlock({ label = 'Loading your data…' }) {
  return <div className="state-block" role="status" aria-live="polite"><LoaderCircle size={22} className="spinner" aria-hidden="true"/><span>{label}</span></div>
}

export function EmptyState({ title, description, action }) {
  return <div className="state-block empty-state"><span className="empty-mark">✦</span><strong>{title}</strong><p>{description}</p>{action}</div>
}

export function ErrorState({ onRetry }) {
  return <div className="error-state" role="alert"><strong>We couldn’t load this section.</strong><span>Check your connection and try again.</span><Button variant="secondary" onClick={onRetry}>Try again</Button></div>
}

export function DataState({ loading, error, retry, empty, children }) {
  if (loading) return <LoadingBlock/>
  if (error) return <ErrorState onRetry={retry}/>
  if (empty) return <EmptyState title="Nothing here yet" description="New activity will show up here."/>
  return children
}

export function FormField({ label, children, hint }) {
  return <label className="form-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>
}
