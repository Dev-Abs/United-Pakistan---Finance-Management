# United Pakistan Finance mobile

Native Flutter client for the existing Express/Google Sheets finance platform.

## Run

```sh
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000
```

Use an HTTPS production API URL for physical devices:

```sh
flutter build apk --release --dart-define=API_BASE_URL=https://your-production-host.example
```

Do not include `/api` at the end of the URL. Before building, verify that
`https://your-production-host.example/api/health` returns `configured: true`.
The release APK is written to `build/app/outputs/flutter-apk/app-release.apk`.

`10.0.2.2` is an Android-emulator alias for the development computer. It is
not reachable from a physical phone, which is why an APK built with the default
URL reports that it appears to be offline.

The checked-in release configuration uses Android's standard debug signing until an organization keystore is configured. Never commit keystore files or passwords. Configure `key.properties` and the Gradle release signing block before external distribution.

## Architecture

- `lib/src/theme.dart`: FlexColorScheme-based light/dark design system, dynamic Android color support, and Manrope typography.
- `lib/src/api_client.dart`: Dio-based, timeout-aware bearer-token HTTP client with user-safe error mapping.
- `lib/src/session.dart`: encrypted token/role persistence using platform secure storage.
- `lib/src/app.dart`: guarded GoRouter navigation, session restoration, responsive breakpoints, and toast overlay.
- `lib/src/screens.dart`: authentication, shell, dashboard, members, activity, reports, sheets, and state patterns.

Dependencies are intentionally scoped to implemented use cases. Image caching, SVG rendering, infinite pagination, searchable dropdowns, slidable rows, and biometrics should be added only alongside a real product flow that needs them.

The current backend does not provide token refresh, password reset, push notifications, or a secure device-bound session exchange. Those features remain deliberately non-fictionalized in the client.
