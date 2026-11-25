import type { Detector } from '../detection';

const XCODE = /\.(xcodeproj|xcworkspace)$/;
const ANDROID_PLUGIN = /com\.android\.(application|library)/;
const ANDROID_BUILD_FILES = ['build.gradle', 'build.gradle.kts', 'app/build.gradle', 'app/build.gradle.kts'];

/**
 * Mobile platforms: Flutter, and iOS or Android either nested (Flutter, React Native: `ios/`,
 * `android/`) or native at the root (an Xcode project; the Android Gradle plugin).
 */
export const detectMobileNative: Detector = (dir) => {
  const pubspec = dir.has('pubspec.yaml') ? dir.text('pubspec.yaml') : null;
  const flutter = pubspec?.includes('flutter') ?? false;
  const ios = dir.has('ios/Podfile') || dir.list('ios').some((name) => name.endsWith('.xcodeproj')) || dir.list().some((name) => XCODE.test(name));
  const android = dir.has('android/build.gradle') || dir.has('android/build.gradle.kts') || ANDROID_PLUGIN.test(dir.text(...ANDROID_BUILD_FILES));
  return {
    languages: pubspec === null ? [] : ['dart'],
    frameworks: [...(flutter ? ['flutter'] : []), ...(ios ? ['ios'] : []), ...(android ? ['android'] : [])],
    testRunners: pubspec === null ? [] : dartTestRunners(pubspec, flutter),
  };
};

function dartTestRunners(pubspec: string, flutter: boolean): string[] {
  if (flutter) return ['flutter-test'];
  return /^\s+test:/m.test(pubspec) ? ['dart-test'] : [];
}

/**
 * Swift: a Swift package, or a native Xcode project at the root (a Flutter app's `ios/` folder does
 * not make the project a Swift project).
 */
export const detectSwift: Detector = (dir) => {
  const swiftPackage = dir.has('Package.swift');
  if (!swiftPackage && !dir.list().some((name) => XCODE.test(name))) return {};
  return {
    languages: ['swift'],
    buildTools: swiftPackage ? ['swiftpm'] : ['xcodebuild'],
    testRunners: ['xctest'],
    linters: dir.has('.swiftlint.yml') ? ['swiftlint'] : [],
  };
};

const CPP_SOURCES = /\.(cpp|cc|cxx|hpp|hh|hxx)$/;

/** C and C++ built with CMake: C++ when the project or its sources say so, otherwise C. */
export const detectCmake: Detector = (dir) => {
  if (!dir.has('CMakeLists.txt')) return {};
  const cmake = dir.text('CMakeLists.txt');
  const cpp = /project\([^)]*\bCXX\b/.test(cmake) || dir.find((name) => CPP_SOURCES.test(name), 3).length > 0;
  return {
    languages: [cpp ? 'cpp' : 'c'],
    buildTools: ['cmake'],
    testRunners: /\b(enable_testing|add_test)\s*\(/.test(cmake) ? ['ctest'] : [],
    linters: dir.has('.clang-tidy') ? ['clang-tidy'] : [],
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
