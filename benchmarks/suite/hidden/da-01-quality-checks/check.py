import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "runtime"))
from isolate import observe  # noqa: E402

seen = observe("""
    from pathlib import Path
    from etl.transform import read_rows
    from etl.quality import validate_rows
    rows = read_rows(Path("data") / "orders.csv")
    synthetic = [{"id": "", "date": "2026-01-01", "status": "pending", "amount": "1"}, {"id": "9", "date": "2026-01-01", "status": "pending", "amount": "abc"}]
    clean = [{"id": "1", "date": "2026-01-01", "status": "pending", "amount": "0"}]
    return {"orders": [list(item) for item in validate_rows(rows)], "synthetic": [list(item) for item in validate_rows(synthetic)], "clean": validate_rows(clean)}
""")
assert {tuple(item) for item in seen["orders"]} == {(3, "invalid_date"), (4, "duplicate_id"), (5, "invalid_date"), (6, "negative_amount")}, seen["orders"]
assert {tuple(item) for item in seen["synthetic"]} == {(0, "missing_id"), (1, "invalid_amount")}, seen["synthetic"]
assert seen["clean"] == [], seen["clean"]
