# Mobile Release Checklist

> Pre-submission checklist for App Store and Google Play releases.

## Pre-Release Testing

### Functionality
- [ ] All features working on iOS
- [ ] All features working on Android
- [ ] Deep links working correctly
- [ ] Push notifications received and handled
- [ ] Authentication flow complete
- [ ] Payment flow working (if applicable)
- [ ] Offline mode tested

### Devices & OS
- [ ] Tested on minimum supported iOS version
- [ ] Tested on minimum supported Android version
- [ ] Tested on various screen sizes (phone + tablet)
- [ ] Tested on low-end devices
- [ ] Tested with slow network (3G simulation)
- [ ] Tested with no network

### Edge Cases
- [ ] App handles being killed and restored
- [ ] App handles low memory situations
- [ ] App handles permissions denied
- [ ] App handles logout/login cycle
- [ ] App handles timezone changes
- [ ] App handles language/locale changes

---

## App Store (iOS) Requirements

### App Information
- [ ] App name (30 char max)
- [ ] Subtitle (30 char max)
- [ ] Description (4000 char max)
- [ ] Keywords (100 char max, comma-separated)
- [ ] Support URL
- [ ] Marketing URL (optional)
- [ ] Privacy Policy URL (required)

### Visual Assets
- [ ] App icon (1024x1024 PNG, no alpha)
- [ ] Screenshots for each device size:
  - [ ] iPhone 6.7" (1290x2796 or 2796x1290)
  - [ ] iPhone 6.5" (1284x2778 or 2778x1284)
  - [ ] iPhone 5.5" (1242x2208 or 2208x1242)
  - [ ] iPad Pro 12.9" (2048x2732 or 2732x2048)
- [ ] App Preview video (optional, 15-30 seconds)

### Build Configuration
- [ ] Version number incremented
- [ ] Build number incremented
- [ ] Bundle ID correct
- [ ] Signing certificate valid
- [ ] Provisioning profile valid
- [ ] Bitcode enabled (optional but recommended)
- [ ] Minimum iOS version set correctly

### Privacy & Compliance
- [ ] App Tracking Transparency implemented (if tracking)
- [ ] Privacy Nutrition Labels filled out
- [ ] Data collection disclosures accurate
- [ ] IDFA usage declared (if applicable)
- [ ] Export compliance answered
- [ ] Content rights confirmed

### Technical Requirements
- [ ] No private API usage
- [ ] No crash on launch
- [ ] IPv6 compatibility
- [ ] Supports all required device orientations
- [ ] Uses HTTPS for all network calls
- [ ] No placeholder content

---

## Google Play (Android) Requirements

### Store Listing
- [ ] App name (50 char max)
- [ ] Short description (80 char max)
- [ ] Full description (4000 char max)
- [ ] Developer contact email
- [ ] Privacy Policy URL (required)

### Visual Assets
- [ ] App icon (512x512 PNG)
- [ ] Feature graphic (1024x500)
- [ ] Screenshots (min 2, max 8 per device type):
  - [ ] Phone screenshots (16:9 or 9:16)
  - [ ] Tablet 7" screenshots (optional)
  - [ ] Tablet 10" screenshots (optional)
- [ ] Promo video (YouTube link, optional)

### Build Configuration
- [ ] Version code incremented
- [ ] Version name updated
- [ ] Package name correct
- [ ] Signing key valid (upload key for Play App Signing)
- [ ] Target SDK meets Play requirements (currently 34)
- [ ] Minimum SDK set correctly
- [ ] ProGuard/R8 enabled for release

### Content & Compliance
- [ ] Content rating questionnaire completed
- [ ] Target audience and content set
- [ ] Data safety section filled out
- [ ] App permissions justified
- [ ] Ads declaration (if applicable)
- [ ] News app declaration (if applicable)

### Technical Requirements
- [ ] 64-bit support included
- [ ] App Bundle format (.aab) used
- [ ] No crash on launch
- [ ] Permissions rationale shown before request
- [ ] Handles permission denied gracefully

---

## Both Platforms

### Security
- [ ] API keys not hardcoded
- [ ] Sensitive data in secure storage
- [ ] Certificate pinning enabled (if required)
- [ ] No debug logs in release build
- [ ] ProGuard/obfuscation enabled
- [ ] Root/jailbreak detection (if required)

### Performance
- [ ] Startup time < 3 seconds
- [ ] No ANR (Android) / watchdog kills (iOS)
- [ ] Memory usage reasonable
- [ ] Battery usage optimized
- [ ] Bundle size minimized

### Analytics & Monitoring
- [ ] Crash reporting configured (Sentry/Crashlytics)
- [ ] Analytics tracking verified
- [ ] Performance monitoring enabled
- [ ] Error logging configured

### Legal
- [ ] Privacy policy up to date
- [ ] Terms of service up to date
- [ ] Third-party licenses included
- [ ] GDPR compliance (if applicable)
- [ ] CCPA compliance (if applicable)

---

## Build Commands

### Expo (EAS Build)

```bash
# Build for App Store
eas build --platform ios --profile production

# Build for Play Store
eas build --platform android --profile production

# Submit to App Store
eas submit --platform ios

# Submit to Play Store
eas submit --platform android
```

### React Native CLI

```bash
# iOS - Archive in Xcode
# Product > Archive > Distribute App

# Android - Generate signed AAB
cd android
./gradlew bundleRelease

# APK location: android/app/build/outputs/bundle/release/app-release.aab
```

---

## Version Naming

```
Version: MAJOR.MINOR.PATCH
Build:   Incrementing integer

Example:
- Version: 2.1.0
- Build (iOS): 45
- Version Code (Android): 45

Increment rules:
- MAJOR: Breaking changes, major redesign
- MINOR: New features, backward compatible
- PATCH: Bug fixes, minor improvements
```

---

## Post-Release

### Monitoring
- [ ] Monitor crash-free rate (target > 99.5%)
- [ ] Monitor ANR rate (Android, target < 0.1%)
- [ ] Monitor user reviews
- [ ] Monitor performance metrics

### Rollback Plan
- [ ] Previous version available for quick re-release
- [ ] Feature flags ready to disable problematic features
- [ ] Hotfix branch prepared

### Communication
- [ ] Release notes published
- [ ] Support team informed
- [ ] Changelog updated
- [ ] Users notified (if major update)

---

## Common Rejection Reasons

### App Store
| Reason | Prevention |
|--------|------------|
| Crashes on launch | Test on clean install, all devices |
| Incomplete metadata | Fill all required fields |
| Placeholder content | Remove "lorem ipsum", test accounts |
| Broken links | Verify all URLs work |
| Login required without demo | Provide demo credentials |
| Privacy issues | Update privacy labels accurately |
| Guideline 4.3 (spam) | Ensure unique value proposition |

### Google Play
| Reason | Prevention |
|--------|------------|
| Policy violation | Read policies, check data safety |
| Crashes | Test on various Android versions |
| Permissions | Justify each permission, handle denial |
| Target SDK | Meet current requirements (SDK 34) |
| 64-bit | Include arm64-v8a architecture |
| Data safety | Accurately declare data collection |

---

## Quick Reference

| Item | iOS | Android |
|------|-----|---------|
| **App Icon** | 1024x1024 | 512x512 |
| **Screenshots** | 6.7", 6.5", 5.5" | Phone, Tablet |
| **Build Format** | .ipa | .aab |
| **Version** | CFBundleShortVersionString | versionName |
| **Build Number** | CFBundleVersion | versionCode |
| **Min OS** | iOS 13+ (recommended) | API 24+ (recommended) |
| **Submission** | App Store Connect | Google Play Console |
| **Review Time** | 24-48 hours | 1-7 days |
