from collections import defaultdict
from datetime import datetime


def _valid(row, seen):
    if not row.get("id") or row["id"] in seen:
        return False
    try:
        datetime.strptime(row.get("date", ""), "%Y-%m-%d")
        return float(row.get("amount", "")) >= 0
    except ValueError:
        return False


def aggregate_monthly(rows):
    """Revenue per month and status from valid rows."""
    totals = defaultdict(lambda: defaultdict(float))
    seen = set()
    for row in rows:
        valid = _valid(row, seen)
        if row.get("id"):
            seen.add(row["id"])
        if valid:
            totals[row["date"][:7]][row["status"]] += float(row["amount"])
    return {month: {status: round(value, 2) for status, value in statuses.items()} for month, statuses in totals.items()}
