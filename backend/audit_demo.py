"""Read-only isolation audit. Run: python demo.py audit"""
from database import run_query
from demo_safety import require_demo_database


def audit():
    require_demo_database()
    counts = {table: run_query(f'SELECT COUNT(*) AS n FROM {table}', one=True)['n']
              for table in ('users', 'vehicles', 'bookings')}
    return counts


if __name__ == '__main__':
    print('Synthetic-only demo audit OK:', audit())
