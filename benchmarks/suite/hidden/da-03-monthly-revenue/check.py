import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "runtime"))
from isolate import observe  # noqa: E402

seen = observe("""
    from pathlib import Path
    from etl.transform import read_rows
    from etl.aggregate import aggregate_monthly
    return {"orders": aggregate_monthly(read_rows(Path("data") / "orders.csv")), "empty": aggregate_monthly([])}
""")
assert seen["orders"] == {"2026-01": {"pending": 10.5, "shipped": 20.0}, "2026-02": {"shipped": 5.25}}, seen["orders"]
assert seen["empty"] == {}, seen["empty"]
