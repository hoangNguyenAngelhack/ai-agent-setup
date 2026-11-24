import { matchKeywords, type Detector } from '../detection';

const PYTHON_MANIFESTS = ['pyproject.toml', 'requirements.txt', 'requirements-dev.txt', 'setup.py', 'setup.cfg', 'Pipfile'];

export const detectPython: Detector = (dir) => {
  if (!PYTHON_MANIFESTS.some((file) => dir.has(file))) return {};
  const text = dir.text(...PYTHON_MANIFESTS);
  const managers: Record<string, string> = { 'poetry.lock': 'poetry', 'uv.lock': 'uv', 'Pipfile.lock': 'pipenv', 'requirements.txt': 'pip' };
  return {
    languages: ['python'],
    frameworks: matchKeywords(text, { django: 'django', fastapi: 'fastapi', flask: 'flask', sqlalchemy: 'sqlalchemy' }),
    testRunners: matchKeywords(text, { pytest: 'pytest' }),
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

export const detectOtherLanguages: Detector = (dir) => {
  const findings = [
    dir.has('Cargo.toml') ? { language: 'rust', buildTool: 'cargo', frameworks: matchKeywords(dir.text('Cargo.toml'), { axum: 'axum', actix: 'actix' }) } : null,
    dir.has('Gemfile') ? { language: 'ruby', buildTool: 'bundler', frameworks: matchKeywords(dir.text('Gemfile'), { rails: 'rails' }) } : null,
    dir.has('composer.json') ? { language: 'php', buildTool: 'composer', frameworks: matchKeywords(dir.text('composer.json'), { 'laravel/framework': 'laravel', symfony: 'symfony' }) } : null,
  ].filter((finding) => finding !== null);
  return {
    languages: findings.map((finding) => finding.language),
    buildTools: findings.map((finding) => finding.buildTool),
    frameworks: findings.flatMap((finding) => finding.frameworks),
  };
};
