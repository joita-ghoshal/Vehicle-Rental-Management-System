import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../api'
import Field from '../components/Field'
import { Alert } from '../components/Feedback'

const EMPTY = {
  name: '', brand: '', model: '', category: 'Car', registration_number: '', fuel_type: 'Petrol',
  transmission: 'Manual', seats: '5', price_per_day: '', image_url: '', description: '', status: 'Active',
}
const DEFAULT_IMAGES = { Car: '/images/car-sedan.svg', Bike: '/images/bike-sport.svg', Scooter: '/images/scooter-classic.svg' }

// Used by both the Add Vehicle and Edit Vehicle pages.
export default function VehicleForm({ vehicle, vehicleId }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(vehicle ? { ...EMPTY, ...vehicle, seats: String(vehicle.seats), price_per_day: String(vehicle.price_per_day) } : EMPTY)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  function validate() {
    const e = {}
    if (!form.name.trim()) e.name = 'Name is required.'
    if (!form.brand.trim()) e.brand = 'Brand is required.'
    if (!form.model.trim()) e.model = 'Model is required.'
    if (!form.registration_number.trim()) e.registration_number = 'Registration number is required.'
    const seats = Number(form.seats)
    if (!Number.isInteger(seats) || seats < 1 || seats > 12) e.seats = 'Seats must be a whole number from 1 to 12.'
    if (!(Number(form.price_per_day) > 0)) e.price_per_day = 'Enter a price greater than 0.'
    if (form.description.trim().length < 10) e.description = 'Write at least 10 characters.'
    const image = form.image_url.trim()
    if (image && !/^(https?:\/\/|\/images\/)/.test(image)) e.image_url = 'Use an http(s) link or a path that starts with /images/.'
    return e
  }

  async function submit(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    setMessage('')
    if (Object.keys(found).length) return
    setBusy(true)
    try {
      const path = vehicleId ? `/api/admin/vehicles/${vehicleId}` : '/api/admin/vehicles'
      await api(path, { method: vehicleId ? 'PUT' : 'POST', body: form })
      navigate('/admin/vehicles', { state: { message: vehicleId ? 'Vehicle updated.' : 'Vehicle added.' } })
    } catch (err) {
      setMessage(err.message)
      setErrors(err.fields || {})
    } finally {
      setBusy(false)
    }
  }

  const preview = form.image_url.trim() || DEFAULT_IMAGES[form.category]

  return (
    <form className="panel vehicle-form" onSubmit={submit} noValidate>
      <Alert tone="error">{message}</Alert>
      <div className="field-row">
        <Field label="Vehicle name" name="name" error={errors.name}><input id="name" value={form.name} onChange={set('name')} maxLength={100} /></Field>
        <Field label="Brand" name="brand" error={errors.brand}><input id="brand" value={form.brand} onChange={set('brand')} maxLength={60} /></Field>
      </div>
      <div className="field-row">
        <Field label="Model" name="model" error={errors.model}><input id="model" value={form.model} onChange={set('model')} maxLength={60} /></Field>
        <Field label="Category" name="category" error={errors.category}>
          <select id="category" value={form.category} onChange={set('category')}>
            <option>Car</option><option>Bike</option><option>Scooter</option>
          </select>
        </Field>
      </div>
      <div className="field-row">
        <Field label="Registration number" name="registration_number" error={errors.registration_number}>
          <input id="registration_number" value={form.registration_number} onChange={set('registration_number')} maxLength={30} />
        </Field>
        <Field label="Fuel type" name="fuel_type" error={errors.fuel_type}>
          <select id="fuel_type" value={form.fuel_type} onChange={set('fuel_type')}>
            <option>Petrol</option><option>Diesel</option><option>Electric</option><option>CNG</option><option>Hybrid</option>
          </select>
        </Field>
      </div>
      <div className="field-row field-row-3">
        <Field label="Transmission" name="transmission" error={errors.transmission}>
          <select id="transmission" value={form.transmission} onChange={set('transmission')}>
            <option>Manual</option><option>Automatic</option><option>Not applicable</option>
          </select>
        </Field>
        <Field label="Seats" name="seats" error={errors.seats}>
          <input id="seats" type="number" min="1" max="12" value={form.seats} onChange={set('seats')} />
        </Field>
        <Field label="Price per day (₹)" name="price_per_day" error={errors.price_per_day}>
          <input id="price_per_day" type="number" min="1" step="0.01" value={form.price_per_day} onChange={set('price_per_day')} />
        </Field>
      </div>
      <Field label="Status" name="status" error={errors.status} hint="Only Active vehicles can receive new bookings.">
        <select id="status" value={form.status} onChange={set('status')}>
          <option>Active</option><option>Inactive</option><option>Maintenance</option>
        </select>
      </Field>
      <Field label="Image link" name="image_url" error={errors.image_url} hint="Optional. Paste an image link, or leave empty to use the default picture for this category.">
        <input id="image_url" value={form.image_url} onChange={set('image_url')} placeholder="https://… or /images/…" maxLength={500} />
      </Field>
      <img className="form-preview" src={preview} alt="Preview of the vehicle" />
      <Field label="Description" name="description" error={errors.description}>
        <textarea id="description" rows={5} value={form.description} onChange={set('description')} maxLength={2000} />
      </Field>
      <div className="form-actions">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : vehicleId ? 'Save changes' : 'Add vehicle'}</button>
        <button type="button" className="btn btn-outline" onClick={() => navigate('/admin/vehicles')}>Cancel</button>
      </div>
    </form>
  )
}
