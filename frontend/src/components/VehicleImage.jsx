import { useState } from 'react'
import { assetUrl, CATEGORY_IMAGES, EMERGENCY_IMAGE } from '../assets'

function ResilientImage({ sources, alt, className = '', priority, ...props }) {
  const [index, setIndex] = useState(0)
  return (
    <span className={`vehicle-image ${className}`} data-fallback={index > 0 ? 'true' : undefined}>
      <img {...props} src={sources[index]} alt={alt} width="800" height="600"
        loading={priority ? 'eager' : 'lazy'} decoding="async" fetchpriority={priority ? 'high' : 'auto'}
        onError={() => setIndex((current) => Math.min(current + 1, sources.length - 1))} />
      {index > 0 && <span className="image-fallback-note" aria-hidden="true">Illustration preview</span>}
    </span>
  )
}

export default function VehicleImage({ src, category = 'Car', alt = '', ...props }) {
  const fallback = assetUrl(CATEGORY_IMAGES[category] || CATEGORY_IMAGES.Car)
  const requested = assetUrl(src) || fallback
  return <ResilientImage key={`${requested}|${fallback}`} sources={[...new Set([requested, fallback, EMERGENCY_IMAGE])]} alt={alt} {...props} />
}
