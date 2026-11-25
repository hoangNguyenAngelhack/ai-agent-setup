from datetime import datetime


def _problems(row, seen):
    if not row.get("id"):
        yield "missing_id"
    elif row["id"] in seen:
        yield "duplicate_id"
    try:
        datetime.strptime(row.get("date", ""), "%Y-%m-%d")
    except ValueError:
        yield "invalid_date"
    try:
        if float(row.get("amount", "")) < 0:
            yield "negative_amount"
    except ValueError:
        yield "invalid_amount"


def validate_rows(rows):
    """(row_index, problem) for every data-quality problem in the rows."""
    issues = []
    seen = set()
    for index, row in enumerate(rows):
        issues.extend((index, problem) for problem in _problems(row, seen))
        if row.get("id"):
            seen.add(row["id"])
    return issues
