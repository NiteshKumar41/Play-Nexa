import { useEffect, useRef, useState } from 'react'
import { Check, Copy, LoaderCircle, X } from 'lucide-react'
import { formatINR } from '../../utils/currency'

export function Button({ children, variant = 'primary', className = '', ...props }) {
  return (
    <button
      className={'btn btn-' + variant + ' transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-indigo-400 ' + className}
      {...props}
    >
      {children}
    </button>
  )
}

export function PageTitle({ eyebrow, title, subtitle, action }) {
  return (
    <div className="page-title">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function Panel({ title, subtitle, action, children, className = '' }) {
  return (
    <section className={'panel ' + className}>
      <div className="panel-head">
        <div>
          {title && <h2>{title}</h2>}
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}

export function Status({ children }) {
  const statusClass = String(children).toLowerCase().replaceAll(' ', '-')

  return (
    <span className={'status status-' + statusClass}>
      <i />
      {children}
    </span>
  )
}

export function Toast({ message, onClose }) {
  if (!message) return null

  return (
    <div className="toast" role="status">
      <span><Check size={16} /></span>
      {message}
      <button onClick={onClose} aria-label="Dismiss message">
        <X size={15} />
      </button>
    </div>
  )
}

export function Modal({ title, children, onClose, wide = false }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(onClose)

  useEffect(() => {
    closeRef.current = onClose
  }, [onClose])

  useEffect(() => {
    const previousFocus = document.activeElement
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    dialogRef.current?.querySelector('button, input, select, textarea')?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        closeRef.current()
        return
      }

      if (event.key !== 'Tab' || !dialogRef.current) return

      const focusableElements = [...dialogRef.current.querySelectorAll(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href]',
      )]
      if (!focusableElements.length) {
        event.preventDefault()
        return
      }

      const firstElement = focusableElements[0]
      const lastElement = focusableElements[focusableElements.length - 1]

      if (event.shiftKey && document.activeElement === firstElement) {
        event.preventDefault()
        lastElement.focus()
      } else if (!event.shiftKey && document.activeElement === lastElement) {
        event.preventDefault()
        firstElement.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previousFocus?.focus?.()
    }
  }, [])

  function handleBackdropMouseDown(event) {
    if (event.target === event.currentTarget) onClose()
  }

  return (
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        ref={dialogRef}
        className={'modal ' + (wide ? 'modal-wide' : '')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
      >
        <header>
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn" aria-label="Close dialog" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        {children}
      </section>
    </div>
  )
}

export function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  onConfirm,
  onClose,
  danger = false,
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="confirm-copy">{message}</p>
      <div className="modal-actions">
        <Button variant="secondary" onClick={onClose}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </div>
    </Modal>
  )
}

export function Currency({ value, signed = false }) {
  return <>{signed && value > 0 ? '+' : ''}{formatINR(value)}</>
}

export function CopyButton({ value, onCopied }) {
  const [isCopied, setIsCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      // Clipboard access can be unavailable in a preview environment.
    }

    setIsCopied(true)
    onCopied?.()
    window.setTimeout(() => setIsCopied(false), 1800)
  }

  return (
    <button className="copy-btn" onClick={handleCopy}>
      {isCopied ? <Check size={15} /> : <Copy size={15} />}
      {isCopied ? 'Copied' : 'Copy code'}
    </button>
  )
}

export function LoadingBlock({ label = 'Loading your data…' }) {
  return (
    <div className="state-block" role="status" aria-live="polite">
      <LoaderCircle size={22} className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div className="state-block empty-state">
      <span className="empty-mark">✦</span>
      <strong>{title}</strong>
      <p>{description}</p>
      {action}
    </div>
  )
}

export function ErrorState({ onRetry, message = 'Check your connection and try again.' }) {
  return (
    <div className="error-state" role="alert">
      <strong>We couldn’t load this section.</strong>
      <span>{message}</span>
      <Button variant="secondary" onClick={onRetry}>Try again</Button>
    </div>
  )
}

export function DataState({ loading, error, retry, empty, children }) {
  if (loading) return <LoadingBlock />
  if (error) {
    return <ErrorState onRetry={retry} message={typeof error === 'string' ? error : undefined} />
  }
  if (empty) {
    return <EmptyState title="Nothing here yet" description="New activity will show up here." />
  }

  return children
}

export function FormField({ label, children, hint }) {
  return (
    <label className="form-field">
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}
