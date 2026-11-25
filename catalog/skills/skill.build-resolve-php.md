# PHP Build Resolver

Diagnose and fix a PHP project that fails with Composer, its test runner (PHPUnit or Pest) or PHPStan.

## 1. Gather context

```bash
php -v                                       # compare with "php" in composer.json "require"
composer --version
composer validate --strict
composer install --no-interaction 2>&1 | tail -40
composer why-not vendor/package 2.0          # why a version cannot be installed
```

## 2. Common errors

| Error | Cause | Fix |
|---|---|---|
| `Your requirements could not be resolved` | Constraints conflict | Read which packages conflict; relax or align one constraint deliberately; `composer why-not` explains |
| `requires php ^8.N -> your php version does not satisfy` | PHP older than required | Use the PHP version the project requires; do not use `--ignore-platform-reqs` to install anyway |
| `ext-xyz is missing from your system` | PHP extension not installed | Install and enable the extension (`php -m` lists loaded ones) |
| `The lock file is not up to date` | `composer.json` changed without updating the lock | `composer update vendor/package` for the changed package only, then commit both files |
| `Class "X" not found` | Autoload out of date or namespace/path mismatch (PSR-4) | Fix the namespace or directory; `composer dump-autoload` |
| PHPUnit `No tests executed` | Test suite paths or naming in `phpunit.xml` | Check `<testsuites>` directories and the `*Test.php` suffix |
| PHPStan errors after a change | Real type problems | Fix types (add `@param`/generics only when the code is right); do not lower the level or add the error to the baseline |
| Laravel: `No application encryption key` / config cache issues | Missing `.env` setup or stale cache | Copy `.env.example`, `php artisan key:generate`, `php artisan config:clear` |
| Memory exhausted in PHPStan or Composer | Default memory limit | `--memory-limit=1G` for that command |

## 3. Do not

- Commit `vendor/`, edit files inside it, or install with `--ignore-platform-reqs`.
- Run a blind `composer update` that upgrades every package to fix one conflict.
- Skip tests or add `@phpstan-ignore` without a reason in the comment.

## 4. Verify

```bash
composer validate --strict && composer install --no-interaction
vendor/bin/phpunit        # or vendor/bin/pest
vendor/bin/phpstan analyse --no-progress
```
