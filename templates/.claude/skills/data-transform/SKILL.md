---
name: Data Transformation & Analysis
description: Master skill for parsing, validating, converting, and analyzing data between formats with zero data loss and production-grade safety
---

# Data Transformation & Analysis Skill

## Philosophy

> "Data is the lifeblood of the system. Handle it with the same care as handling production credentials."

**Zero tolerance for data loss.** Every row counts. Every field matters.

---

## Core Principles

1. **Validate First** — Never process data without schema validation
2. **Preserve Everything** — No silent drops, no implicit conversions
3. **Audit Always** — Count in = Count out, or explain the difference
4. **Fail Loudly** — Errors must be visible, never hidden
5. **Backup Before Transform** — Always preserve original data

---

## Supported Format Matrix

### Tabular Data
| Source | Target | Notes |
|--------|--------|-------|
| CSV | JSON, Excel, Markdown, SQL | Detect delimiter automatically |
| Excel (XLSX) | CSV, JSON, Markdown | Support multi-sheet |
| TSV | CSV, JSON | Tab-delimited handling |
| Markdown Tables | CSV, JSON | Parse pipe-delimited |

### Hierarchical / Structured
| Source | Target | Notes |
|--------|--------|-------|
| JSON | YAML, XML, CSV, TOML | Flatten nested objects for CSV |
| YAML | JSON, XML, TOML | Preserve anchors/aliases |
| XML | JSON, YAML | Handle attributes and namespaces |
| TOML | JSON, YAML | Config file transformations |

### Database Structures
| Source | Target | Notes |
|--------|--------|-------|
| JSON | SQL INSERT | Batch inserts with parameterization |
| CSV | SQL INSERT | Type inference for columns |
| JSON | BSON | MongoDB-compatible |
| JSON | GraphQL Schema | Type generation |

### Documents
| Source | Target | Notes |
|--------|--------|-------|
| PDF | Text, JSON (structured) | OCR fallback for scanned |
| HTML | Markdown, Plain Text | Preserve semantic structure |
| Markdown | HTML, Plain Text | Standard CommonMark |

---

## Strict Execution Pipeline

### Phase 1: Ingestion & Validation

```
┌─────────────────────────────────────────────────────────┐
│  1.1 Receive Input                                      │
│       ↓                                                 │
│  1.2 Detect Format (extension, magic bytes, content)    │
│       ↓                                                 │
│  1.3 Detect Encoding (UTF-8, UTF-16, ISO-8859-1)       │
│       ↓                                                 │
│  1.4 Schema Discovery                                   │
│       ↓                                                 │
│  1.5 Structural Validation                              │
│       ↓                                                 │
│  1.6 Generate Input Metrics                             │
└─────────────────────────────────────────────────────────┘
```

**Required Input Metrics:**
- Total row/object count
- Total field/column count
- Data types per field
- Null/empty value count per field
- Unique value counts (for categorical)
- File size and encoding

**Validation Checks:**
- [ ] Valid syntax (JSON parseable, CSV delimiters consistent)
- [ ] No truncated records
- [ ] Consistent column count across rows (CSV)
- [ ] Valid nesting depth (JSON/XML max 50 levels)
- [ ] No binary data in text fields

### Phase 2: Transformation Mapping

```
┌─────────────────────────────────────────────────────────┐
│  2.1 Build Source Schema                                │
│       ↓                                                 │
│  2.2 Define Target Schema                               │
│       ↓                                                 │
│  2.3 Create Field Mapping (1-to-1)                      │
│       ↓                                                 │
│  2.4 Define Type Conversions                            │
│       ↓                                                 │
│  2.5 Plan Structural Changes (flatten/nest)             │
│       ↓                                                 │
│  2.6 Document All Transformations                       │
└─────────────────────────────────────────────────────────┘
```

**Mapping Documentation Format:**
```
Source Field     | Target Field    | Transformation
-----------------|-----------------|------------------
created_at       | createdAt       | camelCase rename
date_string      | created_date    | Parse to ISO-8601
price            | price           | String → Float
is_active        | isActive        | "yes"/"no" → Boolean
user.profile.name| userName        | Flatten nested
```

### Phase 3: Encoding & Formatting

```
┌─────────────────────────────────────────────────────────┐
│  3.1 Apply Field Mappings                               │
│       ↓                                                 │
│  3.2 Execute Type Conversions                           │
│       ↓                                                 │
│  3.3 Handle Special Characters                          │
│       ↓                                                 │
│  3.4 Apply Target Format Rules                          │
│       ↓                                                 │
│  3.5 Validate Output Syntax                             │
└─────────────────────────────────────────────────────────┘
```

**Format-Specific Rules:**

| Format | Rules |
|--------|-------|
| CSV | Wrap fields with commas in double quotes; escape internal quotes; CRLF line endings |
| JSON | 2-space indentation; UTF-8 encoding; escape special chars; no trailing commas |
| YAML | 2-space indentation; quote strings with colons; use block style for multiline |
| XML | Self-closing empty tags; escape <, >, &, ', "; proper nesting |
| SQL | Parameterized queries ONLY; escape single quotes; batch 1000 rows max |

### Phase 4: Verification & Audit

```
┌─────────────────────────────────────────────────────────┐
│  4.1 Parse Output (validate syntax)                     │
│       ↓                                                 │
│  4.2 Count Output Records                               │
│       ↓                                                 │
│  4.3 Compare Input vs Output Counts                     │
│       ↓                                                 │
│  4.4 Spot-check Sample Records                          │
│       ↓                                                 │
│  4.5 Generate Audit Report                              │
└─────────────────────────────────────────────────────────┘
```

**Audit Report Format:**
```
═══════════════════════════════════════════════════════════
DATA TRANSFORMATION AUDIT REPORT
═══════════════════════════════════════════════════════════
Timestamp:        2026-09-18T10:30:00Z
Source Format:    CSV (UTF-8)
Target Format:    JSON

INPUT METRICS:
  - Records:      10,542
  - Fields:       15
  - File Size:    2.4 MB
  - Encoding:     UTF-8

OUTPUT METRICS:
  - Records:      10,542
  - Fields:       15
  - File Size:    3.1 MB
  - Encoding:     UTF-8

VERIFICATION:
  ✅ Record count match: 10,542 = 10,542
  ✅ All fields mapped
  ✅ Syntax validation passed
  ✅ Sample records verified (5 random)

TRANSFORMATIONS APPLIED:
  - 3 fields renamed (camelCase)
  - 2 fields type-converted (String → Date)
  - 1 field normalized (Boolean)

WARNINGS: None
ERRORS: None
═══════════════════════════════════════════════════════════
```

---

## Data Cleaning & Standardization

### Text Normalization

| Operation | Input | Output |
|-----------|-------|--------|
| Trim whitespace | "  hello  " | "hello" |
| Remove control chars | "hello\x00world" | "helloworld" |
| Normalize unicode | "café" (NFD) | "café" (NFC) |
| Remove Vietnamese accents | "Việt Nam" | "Viet Nam" |
| Lowercase | "HeLLo" | "hello" |
| Uppercase | "hello" | "HELLO" |

### Deduplication Strategies

| Strategy | Description | Use When |
|----------|-------------|----------|
| **Keep First** | Keep first occurrence | Import logs, events |
| **Keep Last** | Keep last occurrence | Updates, upserts |
| **Merge** | Combine non-null fields | Partial records |
| **Hash-based** | SHA256 of key fields | Large datasets |

**Deduplication Report:**
```
Duplicates Found:    142
Strategy Applied:    Keep Last
Records Removed:     142
Final Count:         10,400 (was 10,542)
Duplicate Keys:      [list of duplicate identifiers]
```

### Type Coercion Rules

| Source Type | Target Type | Rules |
|-------------|-------------|-------|
| String → Date | ISO-8601 | Parse: YYYY-MM-DD, DD/MM/YYYY, MM-DD-YYYY |
| String → Integer | int | Remove commas, handle negatives |
| String → Float | float | Handle comma/period decimals |
| String → Boolean | bool | true/false, yes/no, 1/0, on/off |
| Null handling | configurable | Keep null, default value, or error |

**Coercion Failure Handling:**
1. Log the failed record with field and value
2. Apply fallback (null, default, or skip)
3. Continue processing
4. Report all failures at end

### Anomaly Detection & Handling

| Anomaly | Detection | Handling |
|---------|-----------|----------|
| Missing required field | Schema check | Error + skip record |
| Invalid type | Coercion failure | Warning + null/default |
| Outlier value | Statistical (3σ) | Flag for review |
| Corrupted syntax | Parse error | Error + log raw data |
| Encoding issues | Invalid sequences | Replace with ? or skip |

---

## Large Dataset Handling

### Memory Management

```python
# For large files (>100MB), use streaming
def process_large_csv(input_path, output_path, chunk_size=10000):
    """Stream process large CSV without loading into memory."""
    total_rows = 0
    
    for chunk in pd.read_csv(input_path, chunksize=chunk_size):
        # Process chunk
        processed = transform_chunk(chunk)
        
        # Append to output
        mode = 'w' if total_rows == 0 else 'a'
        header = total_rows == 0
        processed.to_csv(output_path, mode=mode, header=header, index=False)
        
        total_rows += len(chunk)
        print(f"Processed {total_rows:,} rows...")
    
    return total_rows
```

### Batch Processing Guidelines

| Dataset Size | Strategy | Chunk Size |
|--------------|----------|------------|
| < 10 MB | In-memory | Full load |
| 10-100 MB | Chunked | 50,000 rows |
| 100 MB - 1 GB | Streaming | 10,000 rows |
| > 1 GB | Distributed | Use Spark/Dask |

### Progress Reporting

```
Processing: large_dataset.csv
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 45% (450,000 / 1,000,000 rows)
Elapsed: 2m 30s | ETA: 3m 05s | Speed: 3,000 rows/sec
```

---

## Programmatic Automation (Python)

### Core Libraries

```python
import pandas as pd          # Tabular data
import json                  # JSON serialization
import yaml                  # YAML serialization
import xml.etree.ElementTree as ET  # XML parsing
from openpyxl import load_workbook  # Excel files
import csv                   # CSV handling
from typing import Dict, List, Any, Optional
```

### Production-Ready Converters

```python
import pandas as pd
import json
from typing import Any, Dict, List

def csv_to_json(
    csv_path: str,
    json_path: str,
    orient: str = 'records',
    encoding: str = 'utf-8',
    date_columns: List[str] = None
) -> Dict[str, Any]:
    """Convert CSV to JSON with validation."""
    
    # Read with type detection
    df = pd.read_csv(
        csv_path,
        encoding=encoding,
        parse_dates=date_columns or [],
        na_values=['', 'NULL', 'null', 'N/A', 'n/a']
    )
    
    input_count = len(df)
    
    # Convert dates to ISO format
    for col in df.select_dtypes(include=['datetime64']).columns:
        df[col] = df[col].dt.strftime('%Y-%m-%dT%H:%M:%SZ')
    
    # Export
    df.to_json(
        json_path,
        orient=orient,
        force_ascii=False,
        indent=2,
        date_format='iso'
    )
    
    # Verify
    with open(json_path, 'r', encoding='utf-8') as f:
        output_data = json.load(f)
    output_count = len(output_data)
    
    return {
        'status': 'success' if input_count == output_count else 'warning',
        'input_count': input_count,
        'output_count': output_count,
        'match': input_count == output_count
    }


def json_to_csv(
    json_path: str,
    csv_path: str,
    encoding: str = 'utf-8',
    flatten_nested: bool = True
) -> Dict[str, Any]:
    """Convert JSON to CSV with nested object flattening."""
    
    with open(json_path, 'r', encoding=encoding) as f:
        data = json.load(f)
    
    input_count = len(data)
    
    df = pd.json_normalize(data) if flatten_nested else pd.DataFrame(data)
    
    df.to_csv(csv_path, index=False, encoding=encoding)
    
    # Verify
    df_verify = pd.read_csv(csv_path, encoding=encoding)
    output_count = len(df_verify)
    
    return {
        'status': 'success' if input_count == output_count else 'warning',
        'input_count': input_count,
        'output_count': output_count,
        'columns': list(df.columns)
    }


def excel_to_json(
    excel_path: str,
    json_path: str,
    sheet_name: str = None
) -> Dict[str, Any]:
    """Convert Excel to JSON with multi-sheet support."""
    
    if sheet_name:
        df = pd.read_excel(excel_path, sheet_name=sheet_name)
        data = df.to_dict(orient='records')
    else:
        # All sheets
        xls = pd.ExcelFile(excel_path)
        data = {}
        for sheet in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet)
            data[sheet] = df.to_dict(orient='records')
    
    with open(json_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False, default=str)
    
    return {'status': 'success', 'sheets_processed': len(data) if isinstance(data, dict) else 1}


def validate_json_schema(data: Any, schema: Dict) -> List[str]:
    """Validate data against JSON Schema."""
    from jsonschema import validate, ValidationError
    
    errors = []
    for i, record in enumerate(data):
        try:
            validate(instance=record, schema=schema)
        except ValidationError as e:
            errors.append(f"Record {i}: {e.message}")
    
    return errors
```

### Data Cleaning Utilities

```python
import re
import unicodedata
from typing import Optional

def normalize_text(text: str, options: Dict[str, bool] = None) -> str:
    """Comprehensive text normalization."""
    
    options = options or {}
    
    if text is None:
        return None
    
    # Trim whitespace
    if options.get('trim', True):
        text = text.strip()
    
    # Remove control characters
    if options.get('remove_control_chars', True):
        text = ''.join(c for c in text if unicodedata.category(c) != 'Cc')
    
    # Normalize unicode
    if options.get('normalize_unicode', True):
        text = unicodedata.normalize('NFC', text)
    
    # Collapse whitespace
    if options.get('collapse_whitespace', False):
        text = re.sub(r'\s+', ' ', text)
    
    # Case conversion
    if options.get('lowercase', False):
        text = text.lower()
    elif options.get('uppercase', False):
        text = text.upper()
    
    return text


def remove_vietnamese_accents(text: str) -> str:
    """Remove Vietnamese diacritics."""
    
    vietnamese_map = {
        'à': 'a', 'á': 'a', 'ả': 'a', 'ã': 'a', 'ạ': 'a',
        'ă': 'a', 'ằ': 'a', 'ắ': 'a', 'ẳ': 'a', 'ẵ': 'a', 'ặ': 'a',
        'â': 'a', 'ầ': 'a', 'ấ': 'a', 'ẩ': 'a', 'ẫ': 'a', 'ậ': 'a',
        'è': 'e', 'é': 'e', 'ẻ': 'e', 'ẽ': 'e', 'ẹ': 'e',
        'ê': 'e', 'ề': 'e', 'ế': 'e', 'ể': 'e', 'ễ': 'e', 'ệ': 'e',
        'ì': 'i', 'í': 'i', 'ỉ': 'i', 'ĩ': 'i', 'ị': 'i',
        'ò': 'o', 'ó': 'o', 'ỏ': 'o', 'õ': 'o', 'ọ': 'o',
        'ô': 'o', 'ồ': 'o', 'ố': 'o', 'ổ': 'o', 'ỗ': 'o', 'ộ': 'o',
        'ơ': 'o', 'ờ': 'o', 'ớ': 'o', 'ở': 'o', 'ỡ': 'o', 'ợ': 'o',
        'ù': 'u', 'ú': 'u', 'ủ': 'u', 'ũ': 'u', 'ụ': 'u',
        'ư': 'u', 'ừ': 'u', 'ứ': 'u', 'ử': 'u', 'ữ': 'u', 'ự': 'u',
        'ỳ': 'y', 'ý': 'y', 'ỷ': 'y', 'ỹ': 'y', 'ỵ': 'y',
        'đ': 'd',
        'Đ': 'D',
    }
    
    for viet, ascii_char in vietnamese_map.items():
        text = text.replace(viet, ascii_char)
        text = text.replace(viet.upper(), ascii_char.upper())
    
    return text


def parse_date(value: str, formats: List[str] = None) -> Optional[str]:
    """Parse date string to ISO-8601 format."""
    from datetime import datetime
    
    formats = formats or [
        '%Y-%m-%d',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%SZ',
        '%d/%m/%Y',
        '%m/%d/%Y',
        '%d-%m-%Y',
        '%Y/%m/%d',
        '%d %b %Y',
        '%d %B %Y',
    ]
    
    for fmt in formats:
        try:
            dt = datetime.strptime(value.strip(), fmt)
            return dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        except ValueError:
            continue
    
    return None  # Could not parse


def parse_boolean(value: Any) -> Optional[bool]:
    """Parse various boolean representations."""
    
    if isinstance(value, bool):
        return value
    
    if value is None:
        return None
    
    truthy = {'true', 'yes', 'y', '1', 'on', 'enabled', 'active'}
    falsy = {'false', 'no', 'n', '0', 'off', 'disabled', 'inactive'}
    
    str_val = str(value).lower().strip()
    
    if str_val in truthy:
        return True
    if str_val in falsy:
        return False
    
    return None  # Could not parse
```

---

## User Interface Output Format

When displaying transformation results, use this standardized format:

```markdown
## Data Transformation Report

### Status: ✅ SUCCESS | ⚠️ WARNING | ❌ ERROR

### Source Metrics
- **Format:** CSV (UTF-8, comma-delimited)
- **Size:** 2.4 MB
- **Records:** 10,542
- **Fields:** 15

### Target Metrics
- **Format:** JSON
- **Size:** 3.1 MB
- **Records:** 10,542
- **Fields:** 15

### Integrity Check
| Metric | Input | Output | Status |
|--------|-------|--------|--------|
| Record Count | 10,542 | 10,542 | ✅ Match |
| Field Count | 15 | 15 | ✅ Match |
| Null Values | 23 | 23 | ✅ Preserved |

### Preview (First 3 Records)
\```json
[
  {"id": 1, "name": "Example 1", "createdAt": "2026-01-15T08:30:00Z"},
  {"id": 2, "name": "Example 2", "createdAt": "2026-01-16T09:45:00Z"},
  {"id": 3, "name": "Example 3", "createdAt": "2026-01-17T10:00:00Z"}
]
\```

### Transformations Applied
1. Renamed 3 fields to camelCase
2. Converted `date_string` → ISO-8601 datetime
3. Normalized boolean fields (yes/no → true/false)

### Warnings
- 2 records had empty `email` field (preserved as null)

### Download
📎 [output.json](./output.json)
```

---

## Safety Rules

### NEVER Do These

| Prohibited Action | Why |
|-------------------|-----|
| Drop records silently | Data loss |
| Truncate fields without warning | Information loss |
| Auto-fix invalid data without logging | Hidden corruption |
| Process without backup | Unrecoverable errors |
| Skip validation on "trusted" sources | All sources can be corrupted |

### ALWAYS Do These

| Required Action | When |
|-----------------|------|
| Create backup | Before any transformation |
| Validate input | First step, always |
| Count records | Before and after |
| Log all transformations | Every change |
| Report anomalies | Any unexpected values |
| Verify output | Parse and validate result |

### Error Recovery

```
┌─────────────────────────────────────────────────────────┐
│  Error Detected                                         │
│       ↓                                                 │
│  Log error with full context (record #, field, value)   │
│       ↓                                                 │
│  Apply recovery strategy:                               │
│    - Skip record (log it)                               │
│    - Use default value (log it)                         │
│    - Abort and report                                   │
│       ↓                                                 │
│  Continue processing remaining records                  │
│       ↓                                                 │
│  Generate error summary in audit report                 │
└─────────────────────────────────────────────────────────┘
```

---

## Regex Patterns for Log Parsing

### Common Log Formats

```python
# Apache Combined Log Format
APACHE_LOG = r'(?P<ip>\S+) \S+ \S+ \[(?P<timestamp>[^\]]+)\] "(?P<method>\S+) (?P<path>\S+) \S+" (?P<status>\d+) (?P<size>\d+)'

# JSON Log (one per line)
JSON_LOG = r'^\{.*\}$'

# Syslog
SYSLOG = r'(?P<timestamp>\w+\s+\d+\s+\d+:\d+:\d+)\s+(?P<host>\S+)\s+(?P<process>\S+):\s+(?P<message>.+)'

# Error Stack Trace
STACK_TRACE = r'at (?P<function>\S+) \((?P<file>[^:]+):(?P<line>\d+):(?P<col>\d+)\)'
```

### Email Extraction

```python
EMAIL_PATTERN = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
```

### Phone Number (Vietnamese)

```python
VN_PHONE = r'(?:\+84|0)(3|5|7|8|9)\d{8}'
```

---

## Checklist Before Transformation

- [ ] Source file readable and not corrupted
- [ ] Encoding detected correctly (UTF-8 preferred)
- [ ] Schema documented or discovered
- [ ] Target format requirements understood
- [ ] Backup created
- [ ] Field mappings defined
- [ ] Type conversions planned
- [ ] Null handling strategy set
- [ ] Output location writable
- [ ] Sufficient disk space for output

## Checklist After Transformation

- [ ] Output file created successfully
- [ ] Output syntax valid (parseable)
- [ ] Record count matches
- [ ] Sample records spot-checked
- [ ] Audit report generated
- [ ] Warnings/errors logged
- [ ] Original backup preserved

---

## Quick Command Reference

| Task | Command |
|------|---------|
| CSV → JSON | `csv_to_json(input.csv, output.json)` |
| JSON → CSV | `json_to_csv(input.json, output.csv)` |
| Excel → JSON | `excel_to_json(input.xlsx, output.json)` |
| Validate JSON | `validate_json_schema(data, schema)` |
| Clean text | `normalize_text(text, options)` |
| Parse date | `parse_date(value)` |
| Remove diacritics | `remove_vietnamese_accents(text)` |
