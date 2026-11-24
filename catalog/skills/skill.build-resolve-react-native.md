# React Native Build Resolver

Expert agent for diagnosing and fixing React Native/Expo build errors.

## When to Invoke

- Metro bundler errors
- iOS build failures (Xcode)
- Android build failures (Gradle)
- `pod install` errors
- Expo build/EAS errors
- Native module linking issues

## Approach

### Step 1: Identify Platform & Error Type

| Platform | Error Pattern | Tool |
|----------|---------------|------|
| Metro | `Unable to resolve module` | Metro Bundler |
| iOS | `Build failed`, `Undefined symbols` | Xcode |
| Android | `Execution failed for task` | Gradle |
| Expo | `EAS Build failed` | EAS CLI |

### Step 2: Gather Context

```bash
# Check versions
npx react-native info

# Check Expo version (if using Expo)
npx expo --version

# Check CocoaPods (iOS)
pod --version

# Check Android SDK
echo $ANDROID_HOME
```

---

## Metro Bundler Errors

### Module Not Found

**Error:**
```
Unable to resolve module `@react-navigation/native`
```

**Solutions:**
```bash
# Clear cache and reinstall
rm -rf node_modules
npm install

# Reset Metro cache
npx react-native start --reset-cache

# For Expo
npx expo start --clear
```

### Haste Module Collision

**Error:**
```
jest-haste-map: Haste module naming collision
```

**Solutions:**
```js
// metro.config.js
module.exports = {
  resolver: {
    blockList: [
      /node_modules\/.*\/node_modules\/react-native\/.*/,
    ],
  },
};
```

---

## iOS Build Errors

### Pod Install Failed

**Error:**
```
[!] CocoaPods could not find compatible versions for pod
```

**Solutions:**
```bash
# Update pods
cd ios
pod deintegrate
pod cache clean --all
pod install --repo-update

# If using Expo
npx expo prebuild --clean
```

### Xcode Build Failed

**Error:**
```
Undefined symbols for architecture arm64
```

**Solutions:**
```bash
# Clean Xcode build
cd ios
xcodebuild clean
rm -rf ~/Library/Developer/Xcode/DerivedData

# Rebuild
cd .. && npx react-native run-ios
```

### Signing Errors

**Error:**
```
Code signing "App" requires a provisioning profile
```

**Solutions:**
1. Open Xcode → Select project → Signing & Capabilities
2. Select team and let Xcode manage signing
3. Ensure bundle ID is unique

---

## Android Build Errors

### Gradle Sync Failed

**Error:**
```
Could not resolve com.google.android:...
```

**Solutions:**
```groovy
// android/build.gradle
buildscript {
    repositories {
        google()
        mavenCentral()
    }
}

allprojects {
    repositories {
        google()
        mavenCentral()
    }
}
```

### SDK Version Mismatch

**Error:**
```
Execution failed for task ':app:processDebugResources'
```

**Solutions:**
```groovy
// android/app/build.gradle
android {
    compileSdkVersion 34
    defaultConfig {
        minSdkVersion 24
        targetSdkVersion 34
    }
}
```

### Gradle Daemon Issues

```bash
# Kill Gradle daemon
cd android
./gradlew --stop

# Clean build
./gradlew clean
cd .. && npx react-native run-android
```

---

## Expo Errors

### EAS Build Failed

**Error:**
```
Build failed: "gradlew" exited with non-zero code
```

**Solutions:**
```bash
# Check eas.json config
cat eas.json

# Try local build first
npx expo run:android
npx expo run:ios

# Prebuild clean
npx expo prebuild --clean
```

### Config Plugin Error

**Error:**
```
Error: Cannot find module 'expo-modules-core'
```

**Solutions:**
```bash
# Reinstall Expo packages
npx expo install --check

# Or fix specific package
npx expo install expo-modules-core
```

---

## Native Module Linking

### Autolinking Failed

**Error:**
```
Native module not found
```

**Solutions:**
```bash
# For iOS
cd ios && pod install && cd ..

# For Android - ensure in settings.gradle
include ':react-native-my-module'
project(':react-native-my-module').projectDir = new File(rootProject.projectDir, '../node_modules/react-native-my-module/android')
```

### Manual Linking (Legacy)

```bash
# Only if autolinking fails
npx react-native link package-name
```

---

## Troubleshooting Checklist

### General
- [ ] Node version matches requirements (check .nvmrc)
- [ ] React Native version compatible with dependencies
- [ ] All native dependencies rebuilt after version changes

### iOS
- [ ] Xcode Command Line Tools installed
- [ ] CocoaPods updated (`sudo gem install cocoapods`)
- [ ] iOS Simulator available
- [ ] Correct iOS deployment target

### Android
- [ ] Android SDK installed
- [ ] ANDROID_HOME set correctly
- [ ] Java version compatible (Java 17 for RN 0.73+)
- [ ] Android emulator or device connected

### Expo
- [ ] expo-cli/eas-cli updated
- [ ] app.json/app.config.js valid
- [ ] EAS credentials configured

## Prevention Tips

1. **Lock dependency versions** with exact versions
2. **Test on both platforms** regularly
3. **Keep Expo SDK updated** for latest fixes
4. **Run `pod install`** after any iOS dep change
5. **Clean builds** when switching branches with native changes
