const TONES = {
  Pending: 'warn', Confirmed: 'ok', Completed: 'done', Rejected: 'bad', Cancelled: 'muted',
  Active: 'ok', Inactive: 'muted', Maintenance: 'warn', Paid: 'ok', Unpaid: 'warn',
}

export default function StatusBadge({ status }) {
  return <span className={`badge badge-${TONES[status] || 'muted'}`}>{status}</span>
}
