# Ruby Patterns

> Idiomatic Ruby and Rails. Follow the project's RuboCop configuration and existing conventions first.

## Objects and methods

```ruby
# frozen_string_literal: true

# ✅ Small objects with one job; keyword arguments for clarity
class ChargeOrder
  def initialize(gateway:, logger: Rails.logger)
    @gateway = gateway
    @logger = logger
  end

  def call(order)
    return Result.failure(:already_paid) if order.paid?

    @gateway.charge(amount_cents: order.total_cents, currency: order.currency)
    Result.success(order)
  rescue Gateway::Declined => e
    @logger.warn("charge declined: #{e.message}")
    Result.failure(:declined)
  end
end
```

- `# frozen_string_literal: true` at the top of files when the project uses it.
- Prefer enumerables (`map`, `select`, `each_with_object`) over manual loops; guard clauses over nested `if`.
- Integer cents or `BigDecimal` for money, never `Float`.

## Errors

- Rescue specific exceptions, never bare `rescue` or `rescue Exception`.
- Do not use exceptions for control flow; return a result object for expected outcomes.

## Rails (when used)

- Strong parameters for every create/update; never `params.permit!`.
- Avoid N+1: `includes`/`preload`; check with the Bullet gem when present.
- Put business logic in models or service objects, not controllers or callbacks with side effects.
- Database constraints (`null: false`, unique indexes, foreign keys) as well as validations.
- Migrations are reversible and safe for production (no long locks on large tables).

## Security

```ruby
# ✅ Parameter binding
User.where(email: params[:email])
User.where("created_at > ?", 1.week.ago)

# ❌ Interpolation into SQL
User.where("email = '#{params[:email]}'")
```

- Escape output: ERB `<%= %>` escapes; avoid `html_safe` and `raw` on user input.
- No `eval`, `send` with user-chosen method names, `Marshal.load` or `YAML.load` on untrusted data (`YAML.safe_load`).
- Secrets in credentials or the environment, never committed.

## Testing

- RSpec or Minitest, whichever the project uses; one behaviour per example; factories over fixtures when the project uses FactoryBot.
- Request specs for endpoints, model specs for validations and logic; stub external services at the boundary.

## Tooling

`bundle install` from `Gemfile.lock`, `bundle exec rspec` or `bin/rails test`, `bundle exec rubocop`.
Respect `.ruby-version`.
