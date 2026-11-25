import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from etl.transform import read_rows
from etl.aggregate import aggregate_monthly

result = aggregate_monthly(read_rows(ROOT / "data" / "orders.csv"))
assert result == {"2026-01": {"pending": 10.5, "shipped": 20.0}, "2026-02": {"shipped": 5.25}}, result
assert aggregate_monthly([]) == {}
