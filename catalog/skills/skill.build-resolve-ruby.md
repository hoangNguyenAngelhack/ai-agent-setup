# Ruby Build Resolver

Diagnose and fix a Ruby or Rails project that fails with Bundler, its tests (RSpec or Minitest) or
RuboCop.

## 1. Gather context

```bash
ruby -v && bundle -v          # compare with .ruby-version and the Gemfile `ruby` line
bundle install 2>&1 | tail -30
bundle exec rspec --fail-fast 2>&1 | tail -40     # or: bin/rails test
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `Your Ruby version is X, but your Gemfile specified Y` | Wrong Ruby | Use the version manager the project uses (rbenv, asdf, chruby) to install and select it |
| `Bundler could not find compatible versions` | Constraint conflict | Read the conflict; `bundle update gem_name --conservative` for that gem only |
| Native extension build failed (`pg`, `nokogiri`, `mysql2`) | Missing system libraries or headers | Install them (`libpq-dev`, `libxml2-dev`, …) or configure with `bundle config build.pg --with-pg-config=...` |
| `LoadError` / `uninitialized constant` | Missing require, wrong file name for Zeitwerk, or gem not in the group | Match file and constant names (`app/models/order_item.rb` → `OrderItem`); add the gem to the right group |
| `ActiveRecord::PendingMigrationError` | Test database behind the schema | `bin/rails db:prepare` (or `db:test:prepare`) |
| `PG::ConnectionBad` / database does not exist | Database not running or not created | Start it, `bin/rails db:create db:schema:load` |
| RuboCop offenses | Style or lint rules | `bundle exec rubocop -a` for safe autocorrections; fix the rest; do not add `rubocop:disable` without a reason |
| Flaky specs depending on order | Shared state between examples | Run with `--order random --seed N` to reproduce; isolate the state |

## 3. Do not

- Delete `Gemfile.lock` or run a blind `bundle update` to fix one gem.
- Mark failing examples `pending`/`skip` to make the suite green.
- Add exclusions to `.rubocop.yml` to hide new offenses.

## 4. Verify

```bash
bundle install && bundle exec rspec    # or bin/rails test
bundle exec rubocop
```
