import type { Detector } from '../detection';

export const detectMobileNative: Detector = (dir) => {
  const flutter = dir.has('pubspec.yaml') && dir.text('pubspec.yaml').includes('flutter');
  const ios = dir.has('ios/Podfile') || dir.list('ios').some((name) => name.endsWith('.xcodeproj'));
  const android = dir.has('android/build.gradle') || dir.has('android/build.gradle.kts');
  return {
    languages: dir.has('pubspec.yaml') ? ['dart'] : [],
    frameworks: [...(flutter ? ['flutter'] : []), ...(ios ? ['ios'] : []), ...(android ? ['android'] : [])],
  };
};

const CI_MARKERS: Record<string, string> = {
  '.gitlab-ci.yml': 'gitlab-ci',
  Jenkinsfile: 'jenkins',
  '.circleci': 'circleci',
  'azure-pipelines.yml': 'azure-pipelines',
  'bitbucket-pipelines.yml': 'bitbucket-pipelines',
};

const CONTAINER_MARKERS = ['Dockerfile', 'compose.yml', 'compose.yaml', 'docker-compose.yml', 'docker-compose.yaml'];

export const detectDelivery: Detector = (dir) => {
  const githubActions = dir.list('.github/workflows').some((name) => /\.ya?ml$/.test(name));
  return {
    ci: [...(githubActions ? ['github-actions'] : []), ...Object.keys(CI_MARKERS).filter((file) => dir.has(file)).map((file) => CI_MARKERS[file]!)],
    signals: CONTAINER_MARKERS.some((file) => dir.has(file)) ? ['container'] : [],
  };
};
