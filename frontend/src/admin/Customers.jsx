import { useApi } from '../hooks'
import { formatDate } from '../format'
import { EmptyState, ErrorState, Loader } from '../components/Feedback'

export default function Customers() {
  const { data, loading, error, reload } = useApi('/api/admin/customers')
  return (
    <>
      <h1>Customers</h1>
      {loading && <Loader label="Loading customers" />}
      {error && <ErrorState message={error} onRetry={reload} />}
      {data && data.customers.length === 0 && <EmptyState title="No customers yet" text="Registered customers will appear here." />}
      {data && data.customers.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>ID</th><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th>Bookings</th></tr></thead>
            <tbody>
              {data.customers.map((c) => (
                <tr key={c.id}>
                  <td>#{c.id}</td><td>{c.name}</td><td>{c.email}</td><td>{c.phone}</td>
                  <td>{formatDate(c.created_at)}</td><td>{c.booking_count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
