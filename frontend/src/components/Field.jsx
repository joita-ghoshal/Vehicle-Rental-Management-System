// A label, an input and an error message, kept together.
import { cloneElement, isValidElement } from 'react'

export default function Field({ label, name, error, hint, children }) {
  const description = [children?.props?.['aria-describedby'], error ? `${name}-error` : hint ? `${name}-hint` : ''].filter(Boolean).join(' ')
  const control = isValidElement(children) ? cloneElement(children, {
    'aria-invalid': error ? true : undefined,
    'aria-describedby': description || undefined,
  }) : children
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={name}>{label}</label>
      {control}
      {hint && !error && <p className="field-hint" id={`${name}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
    </div>
  )
}
