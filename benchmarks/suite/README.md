# Benchmark task suite (W2.2-03)

36 tasks in the distribution of [docs/v2/09 §5.3](../../docs/v2/09-testing-and-benchmark-strategy.md#53-task-suite),
run by `npm run bench` (W2.2-02).

**Status: development set.** One author wrote the tasks, the hidden checks and the reference solutions.
09 §5.6 asks for held-out tasks and a second reviewer before any result is reported as evaluation.

## Layout

| Folder | Content |
|---|---|
| `tasks/` | One `benchmark-task/v1` YAML per task: category, domains, fixture, prompt, scope, acceptance, time limit |
| `fixtures/` | The projects agents work in, without dependencies: `shop` (Node API and web UI), `mobile` (list screen data layer), `etl` (Python 3, standard library), `product` (planning documents) |
| `hidden/<task>/` | Checks copied into the workspace only after the agent stops; testing tasks also hold mutants the agent's tests must catch |
| `solutions/<task>/` | A reference solution, never shown to agents; it proves each task can be solved |

## Distribution

| Category | Tasks |
|---|---|
| Product requirements | 3 (rubric) |
| Architecture | 3 (rubric) |
| Frontend | 3 |
| Backend | 4 |
| Mobile | 2 |
| Data | 3 (Python) |
| DevOps | 3 |
| Testing | 3 (mutants and a regression test) |
| Security | 3 |
| Documentation | 2 (rubric) |
| Refactoring | 2 |
| Bug fixing | 3 |
| Cross-domain integration | 2 |

The eight rubric tasks also have structural checks. They stay NOT_VERIFIED until a blinded reviewer
scores them (09 §5.4).

## Checks

`tests/benchmark/suite.test.ts` keeps the suite sound with the real oracle:

- the distribution matches 09 §5.3;
- the hidden checks reject every untouched fixture;
- every reference solution is accepted (NOT_VERIFIED for rubric tasks) without data loss or secrets;
- every solution stays inside its task's scope;
- every mutant differs from the code it mutates.

To add a task, add its YAML, hidden checks and solution, then run that test.
