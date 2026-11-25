import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from etl.retrieval import retrieve

docs = [
    {"id": "d1", "text": "Refund policy for damaged items"},
    {"id": "d2", "text": "Shipping times and tracking"},
    {"id": "d3", "text": "How to request a refund"},
    {"id": "d4", "text": "Tracking your order status"},
]
assert retrieve("refund", docs) == ["d1", "d3"], retrieve("refund", docs)
assert retrieve("Refund", docs, k=1) == ["d1"]
assert retrieve("order tracking", docs) == ["d4", "d2"], retrieve("order tracking", docs)
assert retrieve("unrelated words", docs) == []
assert retrieve("   ", docs) == []
