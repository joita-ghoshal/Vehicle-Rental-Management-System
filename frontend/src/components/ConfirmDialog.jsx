import { useEffect, useId, useRef } from 'react'

export default function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  const ref = useRef(null)
  const id = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={`${id}-title`} aria-describedby={`${id}-message`} onCancel={(e) => { e.preventDefault(); onCancel() }}>
      <h3 id={`${id}-title`}>{title}</h3>
      <p id={`${id}-message`}>{message}</p>
      <div className="dialog-actions">
        <button className="btn btn-outline btn-sm" onClick={onCancel} disabled={busy}>Keep as it is</button>
        <button className={danger ? 'btn btn-danger btn-sm' : 'btn btn-primary btn-sm'} onClick={onConfirm} disabled={busy}>
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}
