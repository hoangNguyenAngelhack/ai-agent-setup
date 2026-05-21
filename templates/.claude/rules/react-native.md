# React Native Coding Standards

> Mandatory rules for this React Native project. All developers MUST follow these standards.

---

## CRITICAL RULES

### 1. NO INLINE STYLES - ZERO TOLERANCE

**NEVER use inline styles.** This is the #1 rule.

```tsx
// ❌ ABSOLUTELY FORBIDDEN
<View style={{flex: 1, padding: 16}}>
<View style={{flexDirection: 'row', gap: 12}}>
<Text style={{fontSize: 14, color: '#888'}}>
<View style={[styles.container, {marginTop: 10}]}>

// ✅ CORRECT - Use className (NativeWind)
<View className="flex-1 p-4">
<View className="flex-row gap-3">
<Text className="text-sm text-[#888]">
<View className="mt-2.5">
```

**Only exception:** Native components that DON'T support className (e.g., `MapView`, `Animated.View` with transform):

```tsx
// ✅ OK - MapView doesn't support className
<MapView style={StyleSheet.absoluteFill} />

// ✅ OK - Animated transform requires style
<Animated.View style={{transform: [{translateY: animated}]}}>
```

### 2. REUSE SHARED COMPONENTS - NO DUPLICATION

**ALWAYS check if a shared component exists before creating new code.**

| Need | Use This | Location |
|------|----------|----------|
| Text display | `<Text>` | `components/nativewindui/Text` |
| Buttons | `<Button>` | `components/nativewindui/Button` |
| Text input | `<Input>` | `components/common/Input` |
| Email input | `<Input.Email>` | `components/common/Input` |
| Password input | `<Input.Password>` | `components/common/Input` |
| Phone input | `<Input.Phone>` | `components/common/Input` |
| Bottom sheet | `<BottomSheet>` | `components/general/BottomSheet` |
| Modal | `<Modal>` | `components/common/Modal` |
| Select/Dropdown | `<Select>` | `components/common/Select` |

```tsx
// ❌ WRONG - Creating custom text input
<TextInput 
  className="border p-4 rounded-lg"
  placeholder="Enter email"
/>

// ✅ CORRECT - Use shared component
<Input.Email 
  placeholder="Enter email"
  value={email}
  onChangeValue={setEmail}
/>
```

### 3. NO DUPLICATE LOGIC

Before writing new code, search for existing patterns:

```tsx
// ❌ WRONG - Duplicating validation logic
const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ✅ CORRECT - Check if it exists in utils/
import {isValidEmail} from 'utils/validation';

// ❌ WRONG - Duplicating API call pattern
const fetchUser = async () => {
  try {
    const res = await axios.get('/users/me');
    return res.data;
  } catch (e) { ... }
};

// ✅ CORRECT - Use existing service
import userService from 'services/user';
const user = await userService.getProfile();
```

---

## UI Components

### Use nativewindui Components

**ALWAYS** use shared components from `components/nativewindui/`:

```tsx
// ✅ CORRECT
import {Text} from 'components/nativewindui/Text';
import {Button} from 'components/nativewindui/Button';

// ❌ WRONG - Never import Text directly from react-native
import {Text} from 'react-native';
```

### Text Component

Use `variant` and `color` props instead of inline styles:

```tsx
// ✅ CORRECT
<Text variant="heading" className="text-white">Title</Text>
<Text variant="body" color="tertiary">Description</Text>
<Text variant="caption1" className="font-semibold">Label</Text>

// ❌ WRONG
<Text className="text-2xl font-bold">Title</Text>
<Text style={{fontSize: 14, color: '#888'}}>Description</Text>
```

**Available variants:** `largeTitle`, `title1`, `title2`, `title3`, `heading`, `body`, `callout`, `subhead`, `footnote`, `caption1`, `caption2`

**Available colors:** `primary`, `secondary`, `tertiary`, `quarternary`

### Button Component

Use Button component for all interactive buttons:

```tsx
// ✅ CORRECT
<Button variant="primary" size="lg" onPress={handlePress}>
  <Text variant="body" className="text-white font-semibold">Submit</Text>
</Button>

<Button variant="secondary" size="md" onPress={handlePress}>
  <Text variant="body">Cancel</Text>
</Button>

// ❌ WRONG - Don't use TouchableOpacity for buttons
<TouchableOpacity className="bg-primary p-4" onPress={handlePress}>
  <Text>Submit</Text>
</TouchableOpacity>
```

**Button variants:** `primary`, `secondary`, `tonal`, `plain`
**Button sizes:** `sm`, `md`, `lg`, `icon`, `none`

**Exception:** Use `TouchableOpacity` only for:
- Icon-only buttons (circular icons)
- Menu items in lists
- Custom interactive areas that aren't standard buttons

---

## Styling

### Use className (NativeWind) over inline styles

```tsx
// ✅ CORRECT
<View className="flex-row items-center gap-3 p-4 bg-[#1C1C1E] rounded-xl">

// ❌ WRONG
<View style={{flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16}}>
```

### Brand Colors

Use these hex codes consistently:

| Color | Hex | Usage |
|-------|-----|-------|
| Primary Red | `#DC2626` | Buttons, accents, active states |
| Success Green | `#22C55E` | Delivered, success states |
| Error Red | `#EF4444` | Failed, error states |
| Warning Yellow | `#EAB308` | Warnings |
| Card Background | `#1C1C1E` | Card backgrounds |
| Border | `#2C2C2E` | Borders, dividers |
| Secondary Border | `#3A3A3C` | Secondary borders |
| Muted Text | `#6B7280` | Muted/tertiary text |
| Background | `#000000` | Screen backgrounds |

```tsx
// ✅ CORRECT - Use className with hex colors
<View className="bg-[#1C1C1E] border-[#2C2C2E]">
<Text className="text-[#DC2626]">

// ❌ WRONG - Don't use semantic colors for brand colors
<View className="bg-card border-border">
```

---

## Navigation

### Screen Options

Always use smooth animations:

```tsx
<Stack.Navigator
  screenOptions={{
    headerShown: false,
    animation: 'slide_from_right',
    animationDuration: 200,
    gestureEnabled: true,
    fullScreenGestureEnabled: true,
  }}>
```

### Tab Navigator

Pre-load tabs to avoid jitter:

```tsx
<Tab.Navigator
  screenOptions={{
    swipeEnabled: false,
    animationEnabled: true,
    lazy: false, // Pre-load all tabs
  }}>
```

---

## File Structure

### Pages

```
pages/
├── auth/           # Authentication screens
├── delivery/       # Delivery-related screens
├── day-management/ # Start/End day screens
├── driver/         # Driver profile, settings
└── MainTabs.tsx    # Bottom tab navigator
```

### Components

```
components/
├── nativewindui/   # Shared UI components (Text, Button)
├── common/         # Common components (Input, Modal)
├── delivery/       # Delivery-specific components
├── navigation/     # Navigation components (BottomTabBar)
└── general/        # General utilities (BottomSheet, Portal)
```

---

## Environment Variables

### Setup

Use `react-native-config` for environment variables:

```tsx
import Config from 'react-native-config';

const apiUrl = Config.API_URL;
const mapsKey = Config.GOOGLE_MAPS_API_KEY;
```

### Files

- `.env` - Local development (gitignored)
- `.env.example` - Template (committed)
- `.env.production` - Production values (gitignored)

### Security

**NEVER** commit API keys or secrets:

```bash
# .gitignore
.env
.env.local
.env.production
.env.staging
```

---

## Imports

### Order

```tsx
// 1. React
import {useState, useEffect} from 'react';

// 2. React Native
import {View, TouchableOpacity} from 'react-native';

// 3. Third-party libraries
import {useNavigation} from '@react-navigation/native';
import {useSelector} from 'react-redux';

// 4. Internal components
import {Text} from 'components/nativewindui/Text';
import {Button} from 'components/nativewindui/Button';

// 5. Types, utils, constants
import {ScreenName} from 'types/react-navigation';
```

### Absolute Imports

Always use absolute imports:

```tsx
// ✅ CORRECT
import {Text} from 'components/nativewindui/Text';
import {RootState} from 'store';

// ❌ WRONG
import {Text} from '../../../components/nativewindui/Text';
```

---

## Redux

### Selectors

```tsx
// ✅ CORRECT
const deliveries = useSelector((state: RootState) => state.delivery.deliveries);

// ❌ WRONG - Don't select entire slice
const delivery = useSelector((state: RootState) => state.delivery);
```

### Actions

```tsx
import {useDispatch} from 'react-redux';
import {setDeliveries} from 'store/slices/deliverySlice';

const dispatch = useDispatch();
dispatch(setDeliveries(data));
```

---

## Performance

### Lists

Use `FlatList` for long lists:

```tsx
<FlatList
  data={items}
  keyExtractor={item => item.id}
  renderItem={({item}) => <ItemCard item={item} />}
  showsVerticalScrollIndicator={false}
/>
```

### Memoization

Use `useMemo` for expensive calculations:

```tsx
const filteredDeliveries = useMemo(() => 
  deliveries.filter(d => d.status === 'PENDING'),
  [deliveries]
);
```

### Images

Use `expo-image` or `react-native-fast-image` for better caching.

---

## Testing

### File naming

```
ComponentName.tsx
ComponentName.test.tsx
```

### Test structure

```tsx
describe('ComponentName', () => {
  it('should render correctly', () => {});
  it('should handle user interaction', () => {});
});
```

---

## Pre-Commit Checklist

Before committing, verify:

- [ ] **No inline styles** - Search for `style={{` and `style={[` in your changes
- [ ] **Using shared components** - Text from nativewindui, not react-native
- [ ] **No duplicate code** - Checked if similar logic exists elsewhere
- [ ] **className for styling** - All styling uses NativeWind classes
- [ ] **Absolute imports** - No `../` in import paths
- [ ] **TypeScript** - No `any` types, proper interfaces defined

### Quick Search Commands

```bash
# Find inline styles in your changes
git diff --staged | grep -E "style=\{\{|style=\{\["

# Find Text imports from react-native (should be 0)
grep -r "Text.*from 'react-native'" pages/ components/

# Find relative imports
grep -r "from '\.\." pages/ components/
```
