# Mobile Performance Checklist

> Quick reference for React Native performance optimization.

## Key Metrics

| Metric | Good | Acceptable | Poor |
|--------|------|------------|------|
| **App Startup (cold)** | < 2s | 2-4s | > 4s |
| **App Startup (warm)** | < 1s | 1-2s | > 2s |
| **Frame Rate** | 60 FPS | 50-59 FPS | < 50 FPS |
| **JS Bundle Size** | < 2MB | 2-5MB | > 5MB |
| **Memory Usage** | < 150MB | 150-300MB | > 300MB |
| **TTI (Time to Interactive)** | < 3s | 3-5s | > 5s |

---

## Startup Performance

### Bundle Optimization
- [ ] Enable Hermes engine (default in RN 0.70+)
- [ ] Use inline requires (`require()` inside functions)
- [ ] Code split with `React.lazy()` and `Suspense`
- [ ] Remove unused dependencies (`npx depcheck`)
- [ ] Analyze bundle with `react-native-bundle-visualizer`

### Splash Screen
- [ ] Use native splash screen (`react-native-bootsplash`)
- [ ] Preload critical data during splash
- [ ] Avoid heavy computations before first render

```tsx
// ✅ Good: Inline require for rarely used screens
const HeavyScreen = React.lazy(() => import('./HeavyScreen'));

// ✅ Good: Defer non-critical initialization
useEffect(() => {
  InteractionManager.runAfterInteractions(() => {
    initializeAnalytics();
    preloadImages();
  });
}, []);
```

---

## Rendering Performance

### Lists
- [ ] Use `FlatList` or `FlashList` for dynamic lists
- [ ] Implement `keyExtractor` properly
- [ ] Set `getItemLayout` for fixed-height items
- [ ] Use `removeClippedSubviews={true}`
- [ ] Optimize `windowSize` and `maxToRenderPerBatch`
- [ ] Avoid inline functions in `renderItem`

```tsx
// ✅ Good: Optimized FlatList
<FlatList
  data={items}
  keyExtractor={(item) => item.id}
  renderItem={renderItem}
  removeClippedSubviews
  maxToRenderPerBatch={10}
  windowSize={5}
  initialNumToRender={10}
  getItemLayout={(_, index) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  })}
/>

// ✅ Good: Memoized renderItem
const renderItem = useCallback(({ item }: { item: ItemType }) => (
  <MemoizedItem item={item} />
), []);
```

### Component Optimization
- [ ] Use `React.memo()` for pure components
- [ ] Use `useMemo()` for expensive computations
- [ ] Use `useCallback()` for event handlers passed as props
- [ ] Avoid creating objects/arrays in render

```tsx
// ✅ Good: Memoized component
const UserCard = React.memo(({ user }: { user: User }) => (
  <View className="p-4">
    <Text>{user.name}</Text>
  </View>
));

// ✅ Good: Stable references
const handlePress = useCallback(() => {
  navigation.navigate('Profile', { id: user.id });
}, [user.id]);

const sortedItems = useMemo(
  () => items.sort((a, b) => a.name.localeCompare(b.name)),
  [items]
);
```

---

## Animation Performance

### Rules
- [ ] Use `react-native-reanimated` for complex animations
- [ ] Always use `useNativeDriver: true` with Animated API
- [ ] Run animations on UI thread, not JS thread
- [ ] Avoid animating layout properties (width, height, top, left)
- [ ] Prefer `transform` and `opacity` for animations

```tsx
// ❌ Bad: JS thread animation
Animated.timing(value, {
  toValue: 1,
  useNativeDriver: false, // Runs on JS thread
}).start();

// ✅ Good: Native driver
Animated.timing(value, {
  toValue: 1,
  useNativeDriver: true, // Runs on UI thread
}).start();

// ✅ Good: Reanimated (always on UI thread)
import { withSpring, useAnimatedStyle } from 'react-native-reanimated';

const animatedStyle = useAnimatedStyle(() => ({
  transform: [{ scale: withSpring(scale.value) }],
}));
```

### Gesture Handling
- [ ] Use `react-native-gesture-handler` for gestures
- [ ] Handle gestures on native thread
- [ ] Combine with Reanimated for smooth interactions

---

## Image Performance

### Optimization
- [ ] Use `expo-image` or `react-native-fast-image`
- [ ] Set explicit `width` and `height`
- [ ] Use appropriate image sizes (don't load 4K for thumbnails)
- [ ] Implement placeholder/blurhash
- [ ] Enable caching

```tsx
// ✅ Good: Optimized image loading
import { Image } from 'expo-image';

<Image
  source={{ uri: imageUrl }}
  style={{ width: 100, height: 100 }}
  placeholder={blurhash}
  contentFit="cover"
  transition={200}
  cachePolicy="memory-disk"
/>
```

### Asset Optimization
- [ ] Use WebP format for images
- [ ] Compress images before bundling
- [ ] Use vector icons instead of PNGs where possible
- [ ] Lazy load images below the fold

---

## Memory Management

### Prevention
- [ ] Clean up subscriptions in `useEffect` return
- [ ] Remove event listeners on unmount
- [ ] Cancel network requests on unmount
- [ ] Avoid storing large data in state
- [ ] Use pagination for large lists

```tsx
// ✅ Good: Cleanup pattern
useEffect(() => {
  const subscription = eventEmitter.addListener('event', handler);
  
  return () => {
    subscription.remove();
  };
}, []);

// ✅ Good: Cancel requests
useEffect(() => {
  const controller = new AbortController();
  
  fetchData({ signal: controller.signal });
  
  return () => {
    controller.abort();
  };
}, []);
```

### Monitoring
- [ ] Profile with Xcode Instruments (iOS)
- [ ] Profile with Android Studio Profiler
- [ ] Use Flipper memory plugin
- [ ] Check for memory leaks in long sessions

---

## Network Performance

### Optimization
- [ ] Implement request caching (TanStack Query)
- [ ] Use appropriate cache times
- [ ] Batch related requests
- [ ] Implement pagination
- [ ] Compress request/response (gzip)

```tsx
// ✅ Good: Optimized query
useQuery({
  queryKey: ['users'],
  queryFn: fetchUsers,
  staleTime: 5 * 60 * 1000,     // Cache for 5 min
  gcTime: 30 * 60 * 1000,       // Keep in memory 30 min
  refetchOnWindowFocus: false,  // Don't refetch on app focus
});
```

### Offline Support
- [ ] Cache critical data locally
- [ ] Queue mutations when offline
- [ ] Show cached data while revalidating
- [ ] Handle network errors gracefully

---

## Storage Performance

### Best Practices
- [ ] Use MMKV for key-value storage (10x faster than AsyncStorage)
- [ ] Use SQLite/WatermelonDB for complex queries
- [ ] Don't store large objects in state
- [ ] Implement data pagination

```tsx
// ✅ Good: MMKV for fast storage
import { MMKV } from 'react-native-mmkv';

const storage = new MMKV();
storage.set('user', JSON.stringify(user));
const user = JSON.parse(storage.getString('user') ?? '{}');
```

---

## Build Optimization

### Bundle Size
- [ ] Enable Proguard/R8 (Android)
- [ ] Enable Bitcode (iOS)
- [ ] Remove console.log in production
- [ ] Use `babel-plugin-transform-remove-console`

### Hermes
- [ ] Hermes enabled (check `hermes-engine` in Podfile)
- [ ] Verify bytecode compilation
- [ ] Profile with Hermes sampling profiler

---

## Profiling Tools

| Tool | Platform | Use For |
|------|----------|---------|
| **Flipper** | Both | Network, layout, performance |
| **React DevTools** | Both | Component tree, re-renders |
| **Xcode Instruments** | iOS | CPU, memory, energy |
| **Android Studio Profiler** | Android | CPU, memory, network |
| **Hermes Profiler** | Both | JS execution |
| **Perf Monitor** | Both | FPS, RAM (shake menu) |

---

## Quick Fixes

| Problem | Solution |
|---------|----------|
| Slow list scrolling | Use `FlashList`, add `getItemLayout` |
| Janky animations | Use Reanimated, check `useNativeDriver` |
| High memory | Profile for leaks, paginate data |
| Slow startup | Enable Hermes, code split, inline requires |
| Large bundle | Analyze with visualizer, remove unused deps |
| Slow images | Use FastImage/expo-image with caching |
