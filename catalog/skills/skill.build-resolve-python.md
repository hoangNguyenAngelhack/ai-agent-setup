# Python Build Resolver

Diagnose and fix a Python project that fails to install, import, type-check or test. Work inside the
project's environment manager (venv, Poetry, uv, pipenv), never the system interpreter.

## 1. Gather context

```bash
python --version                     # compare with requires-python / .python-version
which python                         # inside the project's virtual environment?
ls pyproject.toml poetry.lock uv.lock requirements*.txt 2>/dev/null
python -m pip check                  # broken or conflicting installed packages
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `ModuleNotFoundError: No module named 'x'` | Package not installed in this environment, or the wrong interpreter | Activate the project's environment; install with its manager (`poetry install`, `uv sync`, `pip install -r requirements.txt`) |
| `ModuleNotFoundError` for the project's own package in tests | Package not importable (src layout) | Install it in editable mode (`pip install -e .`) or configure `pythonpath` in pytest settings; do not add `sys.path` hacks |
| `ResolutionImpossible` / `SolverProblemError` | Conflicting constraints | Read which packages conflict; relax one constraint deliberately; update one package, not all |
| `requires a different Python` | Interpreter outside `requires-python` | Use a supported interpreter (pyenv, uv python install) |
| Building wheel failed (`psycopg2`, `lxml`, …) | Missing compiler or system libraries | Install them, or use the binary distribution the project allows (`psycopg[binary]`) |
| `ImportError: cannot import name X` (circular import) | Modules import each other at load time | Move the shared code to a third module, or import inside the function |
| mypy `error: ... [arg-type]` / `[union-attr]` | Real type mismatch or missing `None` handling | Fix the code or annotations; `# type: ignore[code]` only with a reason |
| Ruff errors | Lint rules in `pyproject.toml` | `ruff check --fix` for safe fixes; fix the rest |
| pytest collects 0 tests / fixture not found | Naming (`test_*.py`) or `conftest.py` location | Follow the naming; put shared fixtures in the right `conftest.py` |

## 3. Do not

- `pip install` into the system or user site, or use `sudo pip`.
- Pin everything to old versions, or delete the lockfile, to dodge one conflict.
- Disable mypy strictness, add blanket `# noqa`/`# type: ignore`, or skip tests to get green.

## 4. Verify

```bash
python -m pip check
pytest -q
ruff check . && mypy .      # when the project uses them
```
