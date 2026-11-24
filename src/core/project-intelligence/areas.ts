import type { AreaRisk, ProjectProfile } from '../contracts';
import { matchesAnyGlob } from '../../shared/glob';

export interface AreaRule {
  id: string;
  patterns: string[];
  except?: string[];
  capabilities: string[];
  /** Used instead of `capabilities` when the project is a mobile app without a web UI. */
  mobileCapabilities?: string[];
  risk?: AreaRisk;
}

/** Path conventions → areas. Data, not logic: extend here to recognise more kinds of code. */
export const AREA_RULES: readonly AreaRule[] = [
  { id: 'api', patterns: ['**/routes/**', '**/controllers/**', '**/*.controller.*', '**/api/**', '**/handlers/**', '**/*.route.*'], capabilities: ['backend.api-design'] },
  {
    id: 'auth',
    patterns: ['**/auth/**', '**/*auth*.*', '**/guards/**', '**/*.guard.*', '**/*jwt*.*', '**/session/**', '**/sessions/**'],
    capabilities: ['backend.authn-authz', 'security-compliance.authorization-review'],
    risk: { level: 'high', reason: 'authentication and authorization code' },
  },
  { id: 'database', patterns: ['prisma/**', '**/*.sql', '**/*repository*.*', '**/db/**', '**/models/**', '**/entities/**'], capabilities: ['backend.database-design'] },
  { id: 'migrations', patterns: ['**/migrations/**'], capabilities: ['backend.database-design'], risk: { level: 'high', reason: 'database migrations' } },
  {
    id: 'payments',
    patterns: ['**/payment/**', '**/payments/**', '**/billing/**', '**/checkout/**', '**/*payment*.*'],
    capabilities: ['integration-automation.external-service-integration'],
    risk: { level: 'high', reason: 'payment code' },
  },
  {
    id: 'personal-data',
    patterns: ['**/privacy/**', '**/gdpr/**', '**/consent/**', '**/*pii*', '**/personal-data/**'],
    capabilities: ['security-compliance.privacy-assessment'],
    risk: { level: 'high', reason: 'personal data handling' },
  },
  { id: 'middleware', patterns: ['**/middleware/**', '**/interceptors/**', '**/filters/**'], capabilities: ['backend.service-architecture'] },
  {
    id: 'ui',
    patterns: ['**/components/**', '**/*.tsx', '**/*.jsx', '**/*.vue', '**/*.svelte', '**/pages/**', '**/styles/**', '**/*.css', '**/*.scss'],
    capabilities: ['frontend.component-engineering'],
    mobileCapabilities: ['mobile.cross-platform-development'],
  },
  { id: 'state', patterns: ['**/stores/**', '**/store/**', '**/*-store.*', '**/*Store.*', '**/redux/**'], capabilities: ['frontend.state-management'], mobileCapabilities: ['mobile.navigation-state'] },
  { id: 'tests', patterns: ['**/*.test.*', '**/*.spec.*', 'tests/**', 'test/**', '**/__tests__/**', 'e2e/**'], capabilities: ['quality.test-automation'] },
  {
    id: 'ci',
    patterns: ['.github/workflows/**', '.gitlab-ci.yml', 'Jenkinsfile', '.circleci/**', 'azure-pipelines.yml', 'bitbucket-pipelines.yml'],
    capabilities: ['devops-sre.ci-cd'],
    risk: { level: 'medium', reason: 'CI configuration' },
  },
  { id: 'containers', patterns: ['**/Dockerfile', '**/Dockerfile.*', '**/docker-compose*.yml', '**/docker-compose*.yaml', '**/compose.yml', '**/compose.yaml'], capabilities: ['devops-sre.containerization'] },
  { id: 'kubernetes', patterns: ['k8s/**', '**/helm/**', '**/charts/**', 'kustomize/**'], capabilities: ['devops-sre.kubernetes'], risk: { level: 'high', reason: 'deployment manifests' } },
  { id: 'iac', patterns: ['**/*.tf', 'terraform/**', '**/pulumi/**', '**/cdk/**'], capabilities: ['devops-sre.infrastructure-as-code'], risk: { level: 'high', reason: 'infrastructure as code' } },
  {
    id: 'secrets',
    patterns: ['**/.env', '**/.env.*', '**/secrets/**', '**/*.pem', '**/*.key', '**/credentials*'],
    except: ['**/.env.example', '**/.env.sample', '**/.env.template'],
    capabilities: ['security-compliance.secrets-management'],
    risk: { level: 'high', reason: 'secrets and environment configuration' },
  },
  {
    id: 'dependencies',
    patterns: ['package.json', '**/package.json', '**/requirements*.txt', '**/pyproject.toml', '**/go.mod', '**/pom.xml', '**/*.csproj', '**/Cargo.toml', '**/Gemfile', '**/package-lock.json', '**/yarn.lock', '**/pnpm-lock.yaml'],
    capabilities: ['security-compliance.dependency-security'],
    risk: { level: 'medium', reason: 'dependency manifest' },
  },
  { id: 'data', patterns: ['**/pipelines/**', '**/etl/**', '**/dags/**', '**/*.ipynb', '**/notebooks/**'], capabilities: ['data-ai.data-pipelines'] },
  { id: 'native-mobile', patterns: ['ios/**', 'android/**'], capabilities: ['mobile.native-development'] },
  { id: 'logging', patterns: ['**/logger.*', '**/logging/**', '**/telemetry/**', '**/metrics/**'], capabilities: ['devops-sre.logging-tracing'] },
  { id: 'docs', patterns: ['docs/**', '**/*.md', '**/*.mdx'], capabilities: ['docs-devex.technical-documentation'] },
];

function isMobileOnly(profile: ProjectProfile): boolean {
  return profile.signals.includes('mobile-app') && !profile.signals.includes('web-ui');
}

export function areaRulesFor(path: string): AreaRule[] {
  return AREA_RULES.filter((rule) => matchesAnyGlob(path, rule.patterns) && !matchesAnyGlob(path, rule.except ?? []));
}

export function capabilitiesOf(rule: AreaRule, profile: ProjectProfile): string[] {
  return isMobileOnly(profile) && rule.mobileCapabilities ? rule.mobileCapabilities : rule.capabilities;
}
