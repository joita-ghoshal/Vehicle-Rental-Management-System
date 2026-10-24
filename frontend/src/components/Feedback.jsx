import { Link } from 'react-router-dom'

export function Loader({ label = 'Loading' }) {
  return (
    <div className="state" role="status">
      <span className="spinner" aria-hidden="true" />
      <p>{label}…</p>
    </div>
  )
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="state state-error" role="alert">
      <h3>We could not load this</h3>
      <p>{message}</p>
      {onRetry && <button className="btn btn-dark btn-sm" onClick={onRetry}>Try again</button>}
    </div>
  )
}

export function EmptyState({ title, text, actionTo, actionLabel }) {
  return (
    <div className="state">
      <h3>{title}</h3>
      {text && <p>{text}</p>}
      {actionTo && <Link to={actionTo} className="btn btn-primary btn-sm">{actionLabel}</Link>}
    </div>
  )
}

// tone: success | error | warning | info
export function Alert({ tone = 'info', children, onClose }) {
  if (!children) return null
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && <button className="alert-close" onClick={onClose} aria-label="Dismiss message">×</button>}
    </div>
  )
}
