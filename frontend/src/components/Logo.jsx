// ZELVORA mark: a road that bends into a Z, with a dashed centre line.
export function LogoMark({ size = 38 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="#B65D79" />
      <path d="M11 12h18L11 28h18" fill="none" stroke="#38283F" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 12h18L11 28h18" fill="none" stroke="#F5EFE7" strokeWidth="1.3" strokeDasharray="1 4.6" strokeLinecap="round" />
    </svg>
  )
}

export default function Logo() {
  return (
    <span className="logo">
      <LogoMark />
      <span className="logo-word">ZELVORA</span>
    </span>
  )
}
