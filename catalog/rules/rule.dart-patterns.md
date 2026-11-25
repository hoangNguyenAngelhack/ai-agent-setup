# Dart and Flutter Patterns

> Sound null-safe Dart and Flutter. Follow `analysis_options.yaml` and the app's state management.

## Null safety and types

```dart
// ✅ Model absence in the type; handle it once
User? findUser(String id) => _users[id];

final name = findUser(id)?.name ?? 'unknown';

// ❌ `!` throws at runtime when you are wrong
final name = findUser(id)!.name;
```

- Avoid `!` and `late` unless the value is guaranteed (and say why); prefer `final` variables.
- Immutable models (`final` fields, `copyWith`, `==`/`hashCode` via `equatable` or `freezed` when the project uses them).
- `int` minor units or a decimal package for money, never `double`.

## Async

- `async`/`await` with `try`/`catch` around I/O; never leave a `Future` unawaited by accident (`unawaited()` when intended).
- Cancel `StreamSubscription`s and dispose controllers in `dispose()`.
- After an `await` in a widget, check `mounted` before using `BuildContext`.

## Flutter widgets

```dart
// ✅ Small, const-constructible widgets; state lives in one place
class OrderTile extends StatelessWidget {
  const OrderTile({super.key, required this.order, required this.onTap});
  final Order order;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => ListTile(title: Text(order.title), onTap: onTap);
}
```

- `const` constructors wherever possible; split big `build` methods into widgets, not helper methods.
- No side effects or heavy work in `build`; keys for items whose order changes.
- Use the project's state management (Provider, Riverpod, Bloc) consistently; do not mix approaches.

## Platform and security

- Secrets never in the app bundle; tokens in `flutter_secure_storage`; HTTPS only.
- Handle permissions and platform differences (iOS/Android) explicitly.

## Testing

- Unit tests for logic (`test`), widget tests (`testWidgets`, `pumpWidget`), integration tests for flows.
- Fakes for repositories; no real network in tests.

## Tooling

`flutter analyze` (or `dart analyze`) with zero issues, `dart format`, `flutter test`. Run code
generation (`dart run build_runner build`) after changing annotated models.
