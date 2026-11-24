import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { detectProject } from '../../../src/core/project-detection';
import { writeTree } from '../../helpers/fs-tree';
import { REPO_ROOT } from '../../helpers/v1-cli';

const template = (name: string) => detectProject(join(REPO_ROOT, 'templates', name));

describe('detectProject — V1 template stacks', () => {
  it('should detect Express + Prisma + Vitest in the backend template', () => {
    const profile = template('backend');

    expect(profile.languages).toEqual(['typescript']);
    expect(profile.frameworks).toEqual(expect.arrayContaining(['express', 'prisma']));
    expect(profile.testRunners).toEqual(['vitest']);
    expect(profile.signals).toEqual(expect.arrayContaining(['http-server', 'orm']));
  });

  it('should detect NestJS + Jest in the NestJS template', () => {
    const profile = template('backend-nestjs');

    expect(profile.frameworks).toEqual(expect.arrayContaining(['nestjs', 'prisma']));
    expect(profile.frameworks).not.toContain('express');
    expect(profile.testRunners).toEqual(['jest']);
  });

  it('should detect Next.js + React in the Next.js template', () => {
    const profile = template('frontend-nextjs');

    expect(profile.frameworks).toEqual(expect.arrayContaining(['nextjs', 'react']));
    expect(profile.signals).toContain('web-ui');
  });

  it('should detect React + Vite + Vitest in the Vite template', () => {
    const profile = template('frontend-vite');

    expect(profile.frameworks).toContain('react');
    expect(profile.buildTools).toContain('vite');
    expect(profile.testRunners).toEqual(['vitest']);
  });

  it('should detect Next.js + tRPC + Prisma in the fullstack template', () => {
    expect(template('fullstack').frameworks).toEqual(expect.arrayContaining(['nextjs', 'trpc', 'prisma']));
  });

  it.each(['mobile-expo', 'mobile-cli'])('should detect React Native in %s', (name) => {
    const profile = template(name);

    expect(profile.frameworks).toContain('react-native');
    expect(profile.signals).toContain('mobile-app');
    expect(profile.testRunners).toEqual(['jest']);
  });

  it('should flag Expo only in the Expo template', () => {
    expect(template('mobile-expo').frameworks).toContain('expo');
    expect(template('mobile-cli').frameworks).not.toContain('expo');
  });
});

describe('detectProject — other ecosystems', () => {
  it('should detect a FastAPI service managed by Poetry with pytest', () => {
    const profile = detectProject(
      writeTree({
        'pyproject.toml': '[tool.poetry.dependencies]\nfastapi = "^0.110"\nsqlalchemy = "^2"\n[tool.poetry.group.dev.dependencies]\npytest = "^8"\n',
        'poetry.lock': '',
      }),
    );

    expect(profile.languages).toEqual(['python']);
    expect(profile.frameworks).toEqual(['fastapi', 'sqlalchemy']);
    expect(profile.packageManagers).toEqual(['poetry']);
    expect(profile.testRunners).toEqual(['pytest']);
    expect(profile.signals).toEqual(['http-server', 'orm']);
  });

  it('should detect a Spring Boot service built with Maven', () => {
    const profile = detectProject(
      writeTree({
        'pom.xml': '<project><parent><artifactId>spring-boot-starter-parent</artifactId></parent><dependency><artifactId>junit-jupiter</artifactId></dependency></project>',
      }),
    );

    expect(profile.languages).toEqual(['java']);
    expect(profile.frameworks).toEqual(['spring-boot']);
    expect(profile.buildTools).toEqual(['maven']);
    expect(profile.testRunners).toEqual(['junit']);
  });

  it('should detect Kotlin with Gradle Kotlin DSL', () => {
    const profile = detectProject(writeTree({ 'build.gradle.kts': 'plugins { kotlin("jvm") }' }));

    expect(profile.languages).toEqual(['kotlin']);
    expect(profile.buildTools).toEqual(['gradle']);
  });

  it('should detect a Go service using Gin', () => {
    const profile = detectProject(
      writeTree({ 'go.mod': 'module example.com/svc\n\nrequire github.com/gin-gonic/gin v1.10.0\n' }),
    );

    expect(profile.languages).toEqual(['go']);
    expect(profile.frameworks).toEqual(['gin']);
    expect(profile.testRunners).toEqual(['go-test']);
  });

  it('should detect an ASP.NET Core project', () => {
    const profile = detectProject(
      writeTree({ 'src/Api/Api.csproj': '<Project Sdk="Microsoft.NET.Sdk.Web"><PackageReference Include="xunit" /></Project>', 'Api.sln': '' }),
    );

    expect(profile.languages).toEqual(['csharp']);
    expect(profile.frameworks).toEqual(['aspnetcore']);
    expect(profile.testRunners).toEqual(['xunit']);
  });

  it('should detect a Flutter app', () => {
    const profile = detectProject(writeTree({ 'pubspec.yaml': 'name: app\ndependencies:\n  flutter:\n    sdk: flutter\n' }));

    expect(profile.languages).toEqual(['dart']);
    expect(profile.frameworks).toEqual(['flutter']);
    expect(profile.signals).toEqual(['mobile-app']);
  });

  it('should detect CI providers and containers', () => {
    const profile = detectProject(
      writeTree({
        '.github/workflows/ci.yml': 'name: ci',
        '.gitlab-ci.yml': 'stages: []',
        Dockerfile: 'FROM node:22',
      }),
    );

    expect(profile.ci).toEqual(['github-actions', 'gitlab-ci']);
    expect(profile.signals).toEqual(['container']);
  });

  it('should merge workspaces under apps/ and packages/', () => {
    const profile = detectProject(
      writeTree({
        'package.json': JSON.stringify({ private: true, workspaces: ['apps/*', 'packages/*'] }),
        'pnpm-lock.yaml': '',
        'apps/web/package.json': JSON.stringify({ dependencies: { next: '15', react: '19' } }),
        'apps/api/go.mod': 'module api\n',
        'packages/ui/package.json': JSON.stringify({ devDependencies: { vitest: '4' } }),
      }),
    );

    expect(profile.workspaces).toEqual(['apps/api', 'apps/web', 'packages/ui']);
    expect(profile.languages).toEqual(['go', 'javascript']);
    expect(profile.frameworks).toEqual(expect.arrayContaining(['nextjs', 'react']));
    expect(profile.packageManagers).toEqual(['pnpm']);
    expect(profile.testRunners).toEqual(['go-test', 'vitest']);
  });

  it('should ignore node_modules', () => {
    const profile = detectProject(
      writeTree({ 'node_modules/express/package.json': JSON.stringify({ dependencies: { express: '4' } }) }),
    );

    expect(profile.frameworks).toEqual([]);
  });

  it('should return an empty profile for an unknown directory without guessing', () => {
    const profile = detectProject(writeTree({ 'notes.txt': 'hello' }));

    expect(profile).toMatchObject({ languages: [], frameworks: [], packageManagers: [], testRunners: [], ci: [], signals: [] });
  });

  it('should not report a package manager when there is no lockfile or packageManager field', () => {
    expect(detectProject(writeTree({ 'package.json': '{}' })).packageManagers).toEqual([]);
  });

  it('should report a package manager declared in the packageManager field', () => {
    expect(detectProject(writeTree({ 'package.json': JSON.stringify({ packageManager: 'yarn@4.1.0' }) })).packageManagers).toEqual(['yarn']);
  });

  it('should tolerate an invalid package.json', () => {
    expect(() => detectProject(writeTree({ 'package.json': '{ not json' }))).not.toThrow();
  });
});
