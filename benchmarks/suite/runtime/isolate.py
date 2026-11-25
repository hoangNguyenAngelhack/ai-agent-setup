"""Runtime of the Python hidden checks, with the contract of isolate.cjs.

The code under test (the subject) runs in its own process; the check process imports none of it and
keeps every assertion. BENCHMARK_SUBJECT_PREFIX is a command prefix from the oracle that also keeps
the subject out of the checks' directory (Seatbelt on macOS). The subject gets no BENCHMARK_* variable.
"""
import json
import os
import subprocess
import sys
import tempfile
import textwrap

SUBJECT_TIMEOUT_SECONDS = 120
PREFIX = json.loads(os.environ.get("BENCHMARK_SUBJECT_PREFIX", "[]"))
SUBJECT_ENV = {name: value for name, value in os.environ.items() if not name.startswith("BENCHMARK_")}

TEMPLATE = """import json, os, sys
sys.path.insert(0, os.getcwd())
answer, raw = sys.argv[1], sys.argv[2]
args = json.loads(raw)
def main():
{body}
try:
    reply = {{"ok": True, "value": main()}}
except Exception as error:
    reply = {{"ok": False, "error": repr(error)}}
with open(answer, "w") as handle:
    json.dump(reply, handle)
"""


def observe(body, args=None):
    """Runs `body`, the body of a function `main()`, in the subject from the workspace; returns its JSON value."""
    with tempfile.TemporaryDirectory(prefix="subject-") as directory:
        script = os.path.join(directory, "subject.py")
        answer = os.path.join(directory, "answer.json")
        with open(script, "w") as handle:
            handle.write(TEMPLATE.format(body=textwrap.indent(textwrap.dedent(body).strip("\n"), "    ")))
        result = subprocess.run(
            PREFIX + [sys.executable, script, answer, json.dumps(args or {})],
            cwd=os.getcwd(), env=SUBJECT_ENV, capture_output=True, text=True, timeout=SUBJECT_TIMEOUT_SECONDS,
        )
        if not os.path.exists(answer):
            raise AssertionError(f"the code under test ended without an answer (exit {result.returncode}): {result.stderr.strip()[:300]}")
        with open(answer) as handle:
            reply = json.load(handle)
        if not reply["ok"]:
            raise AssertionError(f"the code under test raised: {reply['error']}")
        return reply["value"]
