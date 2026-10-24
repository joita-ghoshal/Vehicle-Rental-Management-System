import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useApi } from '../hooks'
import { CATEGORIES, todayISO } from '../format'
import Field from '../components/Field'
import VehicleCard from '../components/VehicleCard'
import { Alert, EmptyState, ErrorState, Loader } from '../components/Feedback'

const FILTER_KEYS = ['q', 'category', 'min_price', 'max_price', 'pickup', 'return', 'available', 'sort']

export default function Vehicles() {
  const [params, setParams] = useSearchParams()
  const [form, setForm] = useState(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])))
  const [errors, setErrors] = useState({})

  // Keep the form in step with the address bar (back button, category tabs).
  useEffect(() => {
    setForm(Object.fromEntries(FILTER_KEYS.map((k) => [k, params.get(k) || ''])))
  }, [params])

  const queryString = params.toString()
  const { data, loading, error, reload } = useApi(`/api/vehicles${queryString ? `?${queryString}` : ''}`)
  const vehicles = data?.vehicles || []
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? (e.target.checked ? '1' : '') : e.target.value })

  function validate() {
    const e = {}
    if (form.min_price && (Number(form.min_price) < 0 || Number.isNaN(Number(form.min_price)))) e.min_price = 'Enter a number of 0 or more.'
    if (form.max_price && (Number(form.max_price) < 0 || Number.isNaN(Number(form.max_price)))) e.max_price = 'Enter a number of 0 or more.'
    if (!e.min_price && !e.max_price && form.min_price && form.max_price && Number(form.min_price) > Number(form.max_price)) e.max_price = 'Maximum must be above the minimum.'
    if (form.pickup || form.return || form.available) {
      if (!form.pickup) e.pickup = 'Choose a pickup date.'
      else if (form.pickup < todayISO()) e.pickup = 'Pickup cannot be in the past.'
      if (!form.return) e.return = 'Choose a return date.'
      else if (form.pickup && form.return < form.pickup) e.return = 'Return must be on or after pickup.'
    }
    return e
  }

  function apply(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return
    const next = new URLSearchParams()
    FILTER_KEYS.forEach((k) => form[k] && next.set(k, form[k]))
    setParams(next)
  }

  function chooseCategory(category) {
    const next = new URLSearchParams(params)
    category ? next.set('category', category) : next.delete('category')
    setParams(next)
  }

  function clearAll() {
    setErrors({})
    setParams(new URLSearchParams())
  }

  const activeCategory = params.get('category') || ''
  const hasFilters = queryString.length > 0

  return (
    <div className="container page">
      <div className="page-head-inline">
        <h1>Our vehicles</h1>
        <p className="lead">Choose a car, bike or scooter. Prices are per day.</p>
      </div>

      <div className="tabs" role="group" aria-label="Vehicle type">
        {['', ...CATEGORIES].map((c) => (
          <button key={c || 'all'} className={activeCategory === c ? 'tab active' : 'tab'} aria-pressed={activeCategory === c} onClick={() => chooseCategory(c)}>
            {c ? `${c}s` : 'All'}
          </button>
        ))}
      </div>

      <div className="listing">
        <form className="filters panel" onSubmit={apply} noValidate>
          <h2 className="filters-title">Search and filter</h2>
          <Field label="Name or brand" name="q">
            <input id="q" value={form.q} onChange={set('q')} placeholder="e.g. Honda" maxLength={100} />
          </Field>
          <Field label="Sort by" name="sort">
            <select id="sort" value={form.sort} onChange={set('sort')}>
              <option value="">Newest first</option>
              <option value="price_asc">Price: low to high</option>
              <option value="price_desc">Price: high to low</option>
            </select>
          </Field>
          <div className="field-row">
            <Field label="Min price (₹/day)" name="min_price" error={errors.min_price}>
              <input id="min_price" type="number" min="0" inputMode="numeric" value={form.min_price} onChange={set('min_price')} />
            </Field>
            <Field label="Max price (₹/day)" name="max_price" error={errors.max_price}>
              <input id="max_price" type="number" min="0" inputMode="numeric" value={form.max_price} onChange={set('max_price')} />
            </Field>
          </div>
          <div className="field-row">
            <Field label="Pickup date" name="pickup" error={errors.pickup}>
              <input id="pickup" type="date" min={todayISO()} value={form.pickup} onChange={set('pickup')} />
            </Field>
            <Field label="Return date" name="return" error={errors.return}>
              <input id="return" type="date" min={form.pickup || todayISO()} value={form.return} onChange={set('return')} />
            </Field>
          </div>
          <label className="check">
            <input type="checkbox" checked={form.available === '1'} onChange={set('available')} />
            <span>Only show vehicles free on these dates</span>
          </label>
          <div className="filters-actions">
            <button className="btn btn-primary" type="submit">Apply filters</button>
            {hasFilters && <button type="button" className="btn btn-outline" onClick={clearAll}>Clear all</button>}
          </div>
        </form>

        <div className="listing-results">
          {loading && <Loader label="Finding vehicles" />}
          {error && (error.includes('date') || error.includes('Pickup') || error.includes('Return')
            ? <Alert tone="error">{error}</Alert>
            : <ErrorState message={error} onRetry={reload} />)}
          {!loading && !error && (
            <>
              <p className="result-count" aria-live="polite">{vehicles.length} {vehicles.length === 1 ? 'vehicle' : 'vehicles'} found</p>
              {vehicles.length === 0 ? (
                <EmptyState title="No vehicles match" text="Try a different name, a wider price range or other dates." />
              ) : (
                <div className="vehicle-grid">{vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)}</div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
