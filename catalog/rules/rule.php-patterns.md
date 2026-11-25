# PHP Patterns

> Modern PHP (8.1 or later) as `composer.json` allows. Follow PSR-12 and the framework's conventions.

## Types

```php
<?php

declare(strict_types=1);

final class Money
{
    public function __construct(
        public readonly int $cents,
        public readonly Currency $currency,
    ) {
        if ($cents < 0) {
            throw new InvalidArgumentException('cents must be >= 0');
        }
    }
}

enum Currency: string
{
    case Eur = 'EUR';
    case Usd = 'USD';
}
```

- `declare(strict_types=1);` in every file; type every parameter, return and property.
- `readonly` properties and constructor promotion for value objects; `final` by default.
- Enums instead of string constants; integer cents or a money library for amounts, never `float`.
- `null` only where absence is meaningful; prefer `?Type` over mixed returns like `false|array`.

## Errors

- Throw exceptions with context; catch them where you can handle them. No `@` error suppression.
- Never expose stack traces or SQL errors to users; log them.

## Database and input

```php
// ✅ Prepared statements (PDO) or the ORM's bindings
$stmt = $pdo->prepare('SELECT id, name FROM users WHERE email = :email');
$stmt->execute(['email' => $email]);

// ❌ Interpolation into SQL
$pdo->query("SELECT * FROM users WHERE email = '$email'");
```

- Validate requests at the boundary (Laravel Form Requests, Symfony Validator).
- Escape output: Blade `{{ }}` and Twig escape by default; never echo raw user input; avoid `{!! !!}`/`|raw`.
- `password_hash`/`password_verify` for passwords; CSRF protection on state-changing forms.
- No `eval`, `unserialize` on untrusted data, or shell calls with user input (`escapeshellarg` if unavoidable).

## Laravel (when used)

- Mass assignment guarded with `$fillable`; eager-load relations (`with()`) to avoid N+1.
- Business logic in services or actions, not controllers or models' boot hooks.
- Queue slow work; config through `config()` and `.env`, never `env()` outside config files.

## Testing

- PHPUnit or Pest (whichever the project uses); one behaviour per test; database tests in transactions or with refresh traits.
- Run PHPStan at the project's level; do not lower the level or add baseline entries to make an error go away.

## Tooling

`composer install` from the lockfile, `vendor/bin/phpunit` or `vendor/bin/pest`,
`vendor/bin/phpstan analyse`, and the project's formatter (PHP-CS-Fixer or Pint).
