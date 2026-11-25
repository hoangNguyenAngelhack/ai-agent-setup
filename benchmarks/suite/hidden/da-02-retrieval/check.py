import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "runtime"))
from isolate import observe  # noqa: E402

seen = observe("""
    from etl.retrieval import retrieve
    docs = [
        {"id": "d1", "text": "Refund policy for damaged items"},
        {"id": "d2", "text": "Shipping times and tracking"},
        {"id": "d3", "text": "How to request a refund"},
        {"id": "d4", "text": "Tracking your order status"},
    ]
    return [retrieve("refund", docs), retrieve("Refund", docs, k=1), retrieve("order tracking", docs), retrieve("unrelated words", docs), retrieve("   ", docs)]
""")
assert seen[0] == ["d1", "d3"], seen[0]
assert seen[1] == ["d1"], seen[1]
assert seen[2] == ["d4", "d2"], seen[2]
assert seen[3] == [], seen[3]
assert seen[4] == [], seen[4]
