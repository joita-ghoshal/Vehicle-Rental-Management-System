export function money(value) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value) || 0)
}

// Dates arrive as "YYYY-MM-DD" (or an ISO timestamp). Read them without time-zone shifts.
function parseDay(value) {
  const [y, m, d] = String(value).slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function formatDate(value) {
  if (!value) return ''
  return parseDay(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function todayISO() {
  const now = new Date()
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
}

export function rentalDays(pickup, ret) {
  return Math.round((parseDay(ret) - parseDay(pickup)) / 86400000) + 1
}

export const CATEGORIES = ['Car', 'Bike', 'Scooter']
