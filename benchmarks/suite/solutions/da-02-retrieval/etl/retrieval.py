import math
import re
from collections import Counter


def _counts(text):
    return Counter(re.findall(r"[a-z0-9]+", text.lower()))


def retrieve(query, documents, k=3):
    """Ids of the k documents most similar to the query (cosine over word counts)."""
    wanted = _counts(query)
    if not wanted:
        return []
    query_norm = math.sqrt(sum(value * value for value in wanted.values()))
    scored = []
    for document in documents:
        counts = _counts(document["text"])
        dot = sum(wanted[word] * counts[word] for word in wanted)
        if dot:
            norm = math.sqrt(sum(value * value for value in counts.values()))
            scored.append((-dot / (query_norm * norm), document["id"]))
    return [doc_id for _, doc_id in sorted(scored)[:k]]
