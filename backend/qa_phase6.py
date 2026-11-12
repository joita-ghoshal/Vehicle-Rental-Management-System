"""Isolated browser-QA SQL evidence/identity-checked fixture cleanup only.

Business writes are performed by browser UI, never by this inspector.
Only the cleanup command removes individually identified QA-owned fixtures.
"""
import argparse
import json

from config import DB_CONFIG, DEMO_MODE
from database import run_query, transaction
from demo_safety import require_demo_database
from utils import JsonEncoder


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=('inspect', 'cleanup'))
    parser.add_argument('--vehicle', type=int, default=0)
    parser.add_argument('--registration', default='')
    parser.add_argument('--user', type=int, default=0)
    parser.add_argument('--email', default='')
    args = parser.parse_args()
    if not DEMO_MODE or DB_CONFIG['database'] != 'zelvora_demo_db':
        raise RuntimeError('QA helper requires the isolated demo database.')
    require_demo_database()
    if args.command == 'inspect':
        result = {'summary': run_query(
            "SELECT (SELECT COUNT(*) FROM vehicles WHERE is_archived=0) AS total_vehicles, "
            "(SELECT COUNT(*) FROM users WHERE role='customer') AS total_customers, "
            "COUNT(*) AS total_bookings, "
            "COUNT(CASE WHEN booking_status='Pending' THEN 1 END) AS pending_bookings, "
            "COUNT(CASE WHEN booking_status='Confirmed' THEN 1 END) AS confirmed_bookings, "
            "COUNT(CASE WHEN booking_status='Completed' THEN 1 END) AS completed_bookings, "
            "COALESCE(SUM(CASE WHEN booking_status='Completed' THEN total_amount ELSE 0 END),0) AS completed_revenue "
            "FROM bookings", one=True)}
        result['vehicle'] = run_query('SELECT id,name,registration_number,status,is_archived,price_per_day FROM vehicles WHERE id=%s', (args.vehicle,), one=True)
        result['bookings'] = run_query('SELECT id,user_id,vehicle_id,pickup_date,return_date,total_amount,booking_status,payment_status FROM bookings WHERE vehicle_id=%s ORDER BY id', (args.vehicle,))
        print(json.dumps(result, cls=JsonEncoder))
    else:
        with transaction() as cur:
            if args.vehicle:
                assert args.registration.startswith('P6 '), 'Only exact Phase 6 registrations may be cleaned.'
                cur.execute('SELECT registration_number FROM vehicles WHERE id=%s FOR UPDATE', (args.vehicle,))
                row = cur.fetchone()
                assert row and row['registration_number'] == args.registration, 'Fixture identity mismatch'
                cur.execute('DELETE FROM bookings WHERE vehicle_id=%s', (args.vehicle,))
                cur.execute('DELETE FROM vehicles WHERE id=%s', (args.vehicle,))
            if args.user:
                assert args.email.startswith('phase6.') and args.email.endswith('@test.local')
                cur.execute('SELECT email FROM users WHERE id=%s FOR UPDATE', (args.user,))
                row = cur.fetchone()
                assert row and row['email'] == args.email, 'Fixture identity mismatch'
                cur.execute('DELETE FROM bookings WHERE user_id=%s', (args.user,))
                cur.execute('DELETE FROM users WHERE id=%s', (args.user,))
        print('Individually identified Phase 6 fixtures cleaned.')


if __name__ == '__main__':
    main()
