// Database paths stay portable. Resolve them only at the browser boundary.
export const ASSETS = {
  sedan: 'images/car-sedan.svg', suv: 'images/car-suv.svg', hatchback: 'images/car-hatchback.svg',
  sport: 'images/bike-sport.svg', cruiser: 'images/bike-cruiser.svg',
  classic: 'images/scooter-classic.svg', electric: 'images/scooter-electric.svg',
}
export const CATEGORY_IMAGES = { Car: ASSETS.suv, Bike: ASSETS.sport, Scooter: ASSETS.classic }

export function assetUrl(value, base = import.meta.env?.BASE_URL || '/') {
  if (typeof value !== 'string' || !value.trim()) return ''
  const source = value.trim()
  if (/^https?:\/\//i.test(source)) {
    try {
      const url = new URL(source)
      return url.username || url.password ? '' : url.href
    } catch { return '' }
  }
  if (/^[a-z][a-z\d+.-]*:/i.test(source) || source.startsWith('//') || source.includes('\\')) return ''
  const prefix = `/${base.replace(/^\/+|\/+$/g, '')}/`.replace(/^\/\//, '/')
  let path = source.startsWith(prefix) ? source.slice(prefix.length) : source.replace(/^\/+/, '')
  path = path.replace(/^\.\//, '')
  if (!path.startsWith('images/') || /(?:^|\/)\.\.(?:\/|$)|%2e|%2f|%5c/i.test(path)) return ''
  return prefix + path
}

// Embedded last resort: a missing fallback file cannot cause an error loop.
export const EMERGENCY_IMAGE = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#E8D8CC"/><path d="M180 340h440l-40-90H280l-60 90v65h400v-65M260 405v20m280-20v20" fill="none" stroke="#66546C" stroke-width="12" stroke-linejoin="round"/><text x="400" y="495" text-anchor="middle" font-family="sans-serif" font-size="24" fill="#38283F">Vehicle image unavailable</text></svg>'
)
