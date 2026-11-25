# Android Patterns

> Android apps in Kotlin (Jetpack). Applies with the Kotlin rule; follow the app's architecture first.

## Architecture and state

```kotlin
// ✅ The ViewModel owns UI state; the UI only renders it and sends events
data class OrdersUiState(val orders: List<Order> = emptyList(), val loading: Boolean = false, val error: String? = null)

class OrdersViewModel(private val repo: OrdersRepository) : ViewModel() {
    private val _state = MutableStateFlow(OrdersUiState(loading = true))
    val state: StateFlow<OrdersUiState> = _state.asStateFlow()

    init { refresh() }

    fun refresh() = viewModelScope.launch {
        _state.update { it.copy(loading = true, error = null) }
        try {
            val orders = repo.orders()
            _state.update { it.copy(orders = orders, loading = false) }
        } catch (e: CancellationException) {
            throw e                       // never swallow cancellation
        } catch (e: IOException) {
            _state.update { it.copy(loading = false, error = e.message) }
        }
    }
}
```

- One-directional data flow: state down (`StateFlow`), events up; no business logic in Activities, Fragments or Composables.
- Survive configuration changes: state in the ViewModel or `rememberSaveable`, not in the Activity.
- Repositories expose `suspend` functions or `Flow`; inject them (Hilt/Koin or constructor injection).

## Coroutines on Android

- `viewModelScope`/`lifecycleScope`; collect flows with `repeatOnLifecycle` or `collectAsStateWithLifecycle`.
- Disk and network on `Dispatchers.IO` inside repositories; the main thread only renders.
- Never `GlobalScope`, never `runBlocking` on the main thread.

## Compose (when used)

- Composables are stateless where possible (state hoisting); side effects only in `LaunchedEffect`/`DisposableEffect`.
- Stable keys in `LazyColumn` items; no expensive work during composition.

## Resources and UX

- Strings in `strings.xml` (localisable), dimensions in `dp`/`sp`, content descriptions for images.
- Handle process death and the back stack; test rotation and dark mode.

## Permissions and security

- Request runtime permissions in context and handle denial; declare only the permissions you use.
- Tokens in EncryptedSharedPreferences or the Keystore, never plain SharedPreferences or logs.
- No secrets or API keys in the APK; HTTPS only (network security config); `exported` set deliberately on components.
- WebView: JavaScript off unless needed; never `addJavascriptInterface` with untrusted content.

## Testing

- Local unit tests for ViewModels and repositories (`kotlinx-coroutines-test`, fakes); instrumented tests and Compose UI tests for screens.

## Tooling

`./gradlew assembleDebug`, `./gradlew test`, `./gradlew lint` (or ktlint/detekt when configured).
Keep versions in `libs.versions.toml`; keep `minSdk`/`targetSdk` changes deliberate.
