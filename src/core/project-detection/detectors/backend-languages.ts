import { matchKeywords, type Detector } from '../detection';
import type { ProjectDir } from '../project-dir';

const PYTHON_MANIFESTS = ['pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'setup.py', 'setup.cfg', 'Pipfile'];
const PYTHON_LINT_FILES = ['ruff.toml', '.ruff.toml', 'mypy.ini', '.mypy.ini'];

export const detectPython: Detector = (dir) => {
  if (!PYTHON_MANIFESTS.some((file) => dir.has(file))) return {};
  const text = dir.text(...PYTHON_MANIFESTS);
  const managers: Record<string, string> = { 'poetry.lock': 'poetry', 'uv.lock': 'uv', 'Pipfile.lock': 'pipenv', 'requirements.txt': 'pip' };
  return {
    languages: ['python'],
    frameworks: matchKeywords(text, { django: 'django', fastapi: 'fastapi', flask: 'flask', sqlalchemy: 'sqlalchemy' }),
    testRunners: matchKeywords(text, { pytest: 'pytest' }),
    linters: matchKeywords(`${text}\n${PYTHON_LINT_FILES.filter((file) => dir.has(file)).join('\n')}`, { ruff: 'ruff', mypy: 'mypy' }),
    packageManagers: Object.keys(managers).filter((file) => dir.has(file)).map((file) => managers[file]!),
  };
};

export const detectJvm: Detector = (dir) => {
  const maven = dir.has('pom.xml');
  const gradleFiles = ['build.gradle', 'build.gradle.kts'].filter((file) => dir.has(file));
  if (!maven && gradleFiles.length === 0) return {};
  const text = dir.text('pom.xml', ...gradleFiles);
  const kotlin = dir.has('build.gradle.kts') || text.includes('kotlin');
  return {
    languages: [kotlin ? 'kotlin' : 'java'],
    buildTools: [...(maven ? ['maven'] : []), ...(gradleFiles.length > 0 ? ['gradle'] : [])],
    frameworks: matchKeywords(text, { 'spring-boot': 'spring-boot', quarkus: 'quarkus', micronaut: 'micronaut' }),
    testRunners: matchKeywords(text, { junit: 'junit' }),
    linters: matchKeywords(text, { ktlint: 'ktlint', detekt: 'detekt' }),
  };
};

export const detectGo: Detector = (dir) => {
  if (!dir.has('go.mod')) return {};
  return {
    languages: ['go'],
    frameworks: matchKeywords(dir.text('go.mod'), { 'gin-gonic/gin': 'gin', 'labstack/echo': 'echo', 'gofiber/fiber': 'fiber' }),
    testRunners: ['go-test'],
  };
};

export const detectDotnet: Detector = (dir) => {
  const projects = dir.find((name) => /\.(cs|fs)proj$/.test(name), 3);
  const hasSolution = dir.list().some((name) => name.endsWith('.sln'));
  if (projects.length === 0 && !hasSolution) return {};
  const text = dir.text(...projects);
  return {
    languages: [projects.some((file) => file.endsWith('.fsproj')) ? 'fsharp' : 'csharp'],
    buildTools: ['dotnet'],
    frameworks: matchKeywords(text, { 'microsoft.net.sdk.web': 'aspnetcore' }),
    testRunners: matchKeywords(text, { xunit: 'xunit', nunit: 'nunit', mstest: 'mstest' }),
  };
};

/** Rust: Cargo builds and tests every crate (`cargo test`); Clippy ships with the toolchain. */
export const detectRust: Detector = (dir) => {
  if (!dir.has('Cargo.toml')) return {};
  return { languages: ['rust'], buildTools: ['cargo'], frameworks: matchKeywords(dir.text('Cargo.toml'), { axum: 'axum', actix: 'actix' }), testRunners: ['cargo-test'] };
};

function rubyTestRunners(gems: string, dir: ProjectDir): string[] {
  if (gems.includes('rspec') || dir.has('.rspec')) return ['rspec'];
  if (gems.includes('minitest') || dir.has('Rakefile')) return ['minitest'];
  return [];
}

function phpTestRunners(composer: string, dir: ProjectDir): string[] {
  if (composer.includes('pestphp/pest')) return ['pest'];
  if (composer.includes('phpunit/phpunit') || dir.has('phpunit.xml') || dir.has('phpunit.xml.dist')) return ['phpunit'];
  return [];
}

/** Ruby: the test runner and linter come from the Gemfile or their configuration files. */
export const detectRuby: Detector = (dir) => {
  if (!dir.has('Gemfile')) return {};
  const gems = dir.text('Gemfile');
  return {
    languages: ['ruby'],
    buildTools: ['bundler'],
    frameworks: matchKeywords(gems, { rails: 'rails', sinatra: 'sinatra' }),
    testRunners: rubyTestRunners(gems, dir),
    linters: gems.includes('rubocop') || dir.has('.rubocop.yml') ? ['rubocop'] : [],
  };
};

/** PHP: Composer; PHPUnit or Pest for tests, PHPStan for static analysis. */
export const detectPhp: Detector = (dir) => {
  if (!dir.has('composer.json')) return {};
  const composer = dir.text('composer.json');
  return {
    languages: ['php'],
    buildTools: ['composer'],
    frameworks: matchKeywords(composer, { 'laravel/framework': 'laravel', symfony: 'symfony' }),
    testRunners: phpTestRunners(composer, dir),
    linters: composer.includes('phpstan/phpstan') || dir.has('phpstan.neon') || dir.has('phpstan.neon.dist') ? ['phpstan'] : [],
  };
};

