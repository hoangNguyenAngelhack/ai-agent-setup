import csv
from pathlib import Path


def read_rows(path):
    """Rows of a CSV file as dictionaries of strings."""
    with Path(path).open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))
