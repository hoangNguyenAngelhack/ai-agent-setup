import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from etl.transform import read_rows
from etl.quality import validate_rows

rows = read_rows(ROOT / "data" / "orders.csv")
assert set(validate_rows(rows)) == {(3, "invalid_date"), (4, "duplicate_id"), (5, "invalid_date"), (6, "negative_amount")}, validate_rows(rows)
synthetic = [{"id": "", "date": "2026-01-01", "status": "pending", "amount": "1"}, {"id": "9", "date": "2026-01-01", "status": "pending", "amount": "abc"}]
assert set(validate_rows(synthetic)) == {(0, "missing_id"), (1, "invalid_amount")}, validate_rows(synthetic)
assert validate_rows([{"id": "1", "date": "2026-01-01", "status": "pending", "amount": "0"}]) == []
