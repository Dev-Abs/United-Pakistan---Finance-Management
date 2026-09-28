import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:dio/dio.dart';
import 'package:united_pakistan_finance/src/api_client.dart';
import 'package:united_pakistan_finance/src/finance_store.dart';
import 'package:united_pakistan_finance/src/parity_screens.dart';
import 'package:united_pakistan_finance/src/screens.dart';
import 'package:united_pakistan_finance/src/session.dart';
import 'package:united_pakistan_finance/src/theme.dart';

void main() {
  test('latestMonth uses calendar order instead of API order', () {
    expect(latestMonth(['January 2026', 'December 2025', 'September 2026']),
        'September 2026');
  });

  test('refresh keeps the last complete data snapshot when a request fails',
      () async {
    final client = StatefulFakeClient();
    final store = FinanceStore(client);
    await store.initialize();
    expect(store.month, 'September 2026');
    expect(store.members.single['Name'], 'Saved member');

    client.failMembers = true;
    await store.refresh();

    expect(store.members.single['Name'], 'Saved member');
    expect(store.refreshError, isNotNull);
    expect(store.error, isNull);
  });

  test('rapid month changes cannot apply an older response last', () async {
    final client = RacingFakeClient();
    final store = FinanceStore(client)
      ..months = ['August 2026', 'September 2026']
      ..month = 'July 2026';

    final older = store.selectMonth('August 2026');
    await Future<void>.delayed(const Duration(milliseconds: 1));
    final newer = store.selectMonth('September 2026');
    await Future.wait([older, newer]);

    expect(store.month, 'September 2026');
    expect(store.members.single['Name'], 'September 2026 member');
  });

  test('special fund web placeholders resolve in mobile messages', () {
    final store = FinanceStore(FakeClient())
      ..settings = {
        'SPECIAL_FUND_CAMPAIGN_NAME': 'Convention',
        'SPECIAL_FUND_EVENT_TIMING': 'Next year',
        'SPECIAL_FUND_EVENT_VENUE': 'Liaquat Bagh',
        'SPECIAL_FUND_JP_MINIMUM': 5000,
        'SPECIAL_FUND_SC_MINIMUM': 1000,
        'SPECIAL_FUND_FM_MINIMUM': 0,
      };
    const source =
        '{campaign_name}|{event_timing}|{event_venue}|{jp_minimum}|{sc_minimum}|{fm_minimum}';
    final result = applyTemplate(source, templateValues(store));
    expect(result, isNot(contains(RegExp(r'\{[a-z_]+\}'))));
    expect(result, contains('Convention'));
    expect(result, contains('Liaquat Bagh'));
  });

  test('rapid theme changes are persisted in selection order', () async {
    final preferences =
        FakeThemePreferences(writeDelay: const Duration(milliseconds: 5));
    final session = AppSession(FakeClient(), themeStore: preferences);

    final light = session.setThemeMode('light');
    final dark = session.setThemeMode('dark');
    expect(session.themeMode, 'dark');
    await Future.wait([light, dark]);

    expect(preferences.writes, ['light', 'dark']);
    expect(preferences.value, 'dark');
    expect(session.themePersistenceError, isNull);
  });

  test('theme persistence failure is exposed without undoing live mode',
      () async {
    final preferences = FakeThemePreferences(fail: true);
    final session = AppSession(FakeClient(), themeStore: preferences);

    await expectLater(session.setThemeMode('dark'), throwsException);

    expect(session.themeMode, 'dark');
    expect(session.themePersistenceError, isNotNull);
  });

  test('session persistence failure clears the in-memory credential', () async {
    final client = FakeClient()..token = 'temporary-token';
    final session = AppSession(client,
        credentialStore: FakeCredentialStore(failWrites: true));

    await expectLater(session.persist('admin'), throwsException);

    expect(session.isSignedIn, isFalse);
    expect(session.role, isNull);
    expect(session.sessionPersistenceError, isNotNull);
  });

  test('401 callback signs out globally even if secure deletion fails',
      () async {
    final client = FakeClient()..token = 'expired-token';
    final session = AppSession(client,
        credentialStore: FakeCredentialStore(failDeletes: true));

    client.onUnauthorized?.call();
    await Future<void>.delayed(Duration.zero);

    expect(session.isSignedIn, isFalse);
    expect(session.sessionPersistenceError, isNotNull);
  });

  test('super-admin sector context persists and clears as one unit', () async {
    final client = FakeClient();
    final credentials = FakeCredentialStore();
    final session = AppSession(client, credentialStore: credentials);

    await session.selectSector(42, 'Central Sector');
    expect(client.sectorId, 42);
    expect(session.sectorName, 'Central Sector');
    expect(session.hasSectorContext, isTrue);

    await session.clearSectorContext();
    expect(client.sectorId, isNull);
    expect(session.sectorName, isNull);
    expect(session.hasSectorContext, isFalse);
  });

  testWidgets('MaterialApp applies System → Light → Dark → System',
      (tester) async {
    tester.view.platformDispatcher.platformBrightnessTestValue =
        Brightness.dark;
    addTearDown(
        tester.view.platformDispatcher.clearPlatformBrightnessTestValue);
    final preferences = FakeThemePreferences();
    final session = AppSession(FakeClient(), themeStore: preferences);

    await tester.pumpWidget(_ThemeHarness(session: session));
    expect(_themeBrightness(tester), Brightness.dark);

    await session.setThemeMode('light');
    expect(session.themeMode, 'light');
    await tester.pumpAndSettle();
    expect(_themeBrightness(tester), Brightness.light);

    await session.setThemeMode('dark');
    await tester.pumpAndSettle();
    expect(_themeBrightness(tester), Brightness.dark);

    await session.setThemeMode('system');
    await tester.pumpAndSettle();
    expect(_themeBrightness(tester), Brightness.dark);
  });

  test('light and dark themes apply readable semantic foregrounds', () {
    for (final brightness in Brightness.values) {
      final theme = buildTheme(brightness: brightness);
      final scheme = theme.colorScheme;
      final semantic = theme.extension<AppSemanticColors>()!;

      expect(theme.textTheme.bodyMedium?.color, scheme.onSurface);
      expect(theme.textTheme.titleLarge?.color, scheme.onSurface);
      expect(_contrast(scheme.onSurface, scheme.surface),
          greaterThanOrEqualTo(4.5));
      expect(_contrast(scheme.onSurfaceVariant, scheme.surface),
          greaterThanOrEqualTo(4.5));
      expect(_contrast(scheme.onPrimary, scheme.primary),
          greaterThanOrEqualTo(4.5));
      expect(_contrast(semantic.success, scheme.surface),
          greaterThanOrEqualTo(4.5));
      expect(_contrast(semantic.warning, scheme.surface),
          greaterThanOrEqualTo(4.5));
      expect(
          _contrast(semantic.info, scheme.surface), greaterThanOrEqualTo(4.5));
    }
  });

  test('overlay and native-control themes use the active color scheme', () {
    for (final brightness in Brightness.values) {
      final theme = buildTheme(brightness: brightness);
      final scheme = theme.colorScheme;

      expect(theme.brightness, brightness);
      expect(theme.dialogTheme.backgroundColor, scheme.surfaceContainerHigh);
      expect(theme.bottomSheetTheme.modalBackgroundColor,
          scheme.surfaceContainerLow);
      expect(theme.popupMenuTheme.color, scheme.surfaceContainerHigh);
      expect(
          theme.inputDecorationTheme.fillColor, scheme.surfaceContainerLowest);
      expect(theme.navigationBarTheme.backgroundColor, scheme.surface);
    }
  });

  testWidgets('login validates empty credentials', (tester) async {
    await tester.pumpWidget(MaterialApp(
      home: LoginScreen(client: FakeClient(), onSignedIn: (_) async {}),
    ));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign in'));
    await tester.pump();
    expect(find.text('Username is required'), findsOneWidget);
    expect(find.text('Password is required'), findsOneWidget);
  });

  testWidgets('dashboard renders live totals and payment action',
      (tester) async {
    final store = FinanceStore(FakeClient())
      ..month = 'September 2026'
      ..members = [
        {
          'Name': 'Test Member',
          'Total Payable': 1000,
          'Amount Paid': 600,
          'Remaining Balance': 400,
          'Payment Status': 'Partially Paid',
        }
      ];
    await tester.pumpWidget(MaterialApp(
        home: Scaffold(
      body: Dashboard(store: store, readOnly: false, pay: ([member]) {}),
    )));
    expect(find.text('Rs 600'), findsWidgets);
    expect(find.text('Rs 400'), findsWidgets);
    expect(find.text('Record payment'), findsOneWidget);
    expect(find.text('Test Member'), findsOneWidget);
  });

  testWidgets('store selector skips rebuilds for unrelated state',
      (tester) async {
    final store = FinanceStore(FakeClient());
    var builds = 0;
    await tester.pumpWidget(MaterialApp(
        home: StoreSelector<int>(
            store: store,
            select: (value) => value.members.length,
            builder: (_, value) {
              builds += 1;
              return Text('members: $value');
            })));
    expect(builds, 1);

    await store.saveSettings({'ORG_NAME': 'Updated'});
    await tester.pump();

    expect(builds, 1);
    expect(find.text('members: 0'), findsOneWidget);
  });
}

double _contrast(Color a, Color b) {
  final lighter = a.computeLuminance() > b.computeLuminance() ? a : b;
  final darker = identical(lighter, a) ? b : a;
  return (lighter.computeLuminance() + .05) / (darker.computeLuminance() + .05);
}

Brightness _themeBrightness(WidgetTester tester) =>
    Theme.of(tester.element(find.byKey(const Key('theme-probe')))).brightness;

class _ThemeHarness extends StatefulWidget {
  const _ThemeHarness({required this.session});
  final AppSession session;

  @override
  State<_ThemeHarness> createState() => _ThemeHarnessState();
}

class _ThemeHarnessState extends State<_ThemeHarness> {
  @override
  void initState() {
    super.initState();
    widget.session.addListener(_changed);
  }

  void _changed() => setState(() {});

  @override
  void dispose() {
    widget.session.removeListener(_changed);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        // The app's production themes are validated separately below. Keep this
        // rebuild-boundary test independent of Google Fonts' async font loader.
        theme: ThemeData(brightness: Brightness.light),
        darkTheme: ThemeData(brightness: Brightness.dark),
        themeMode: switch (widget.session.themeMode) {
          'light' => ThemeMode.light,
          'dark' => ThemeMode.dark,
          _ => ThemeMode.system,
        },
        home: const SizedBox(key: Key('theme-probe')),
      );
}

class FakeClient extends ApiClient {
  @override
  Future<Map<String, dynamic>> request(String path,
          {String method = 'GET',
          Map<String, dynamic>? body,
          Map<String, dynamic>? query,
          Map<String, dynamic>? headers,
          CancelToken? cancelToken}) async =>
      <String, dynamic>{};
}

class StatefulFakeClient extends ApiClient {
  bool failMembers = false;

  @override
  Future<Map<String, dynamic>> request(String path,
      {String method = 'GET',
      Map<String, dynamic>? body,
      Map<String, dynamic>? query,
      Map<String, dynamic>? headers,
      CancelToken? cancelToken}) async {
    if (path == '/api/months') {
      return {
        'data': ['January 2026', 'September 2026', 'December 2025']
      };
    }
    if (path == '/api/settings') return {'data': <String, dynamic>{}};
    if (path == '/api/members') {
      if (failMembers) throw const ApiException('Network unavailable');
      return {
        'data': [
          {'Name': 'Saved member'}
        ]
      };
    }
    if (path == '/api/expenses' || path == '/api/followups') {
      return {'data': <Map<String, dynamic>>[]};
    }
    return <String, dynamic>{};
  }
}

class FakeThemePreferences implements ThemePreferenceStore {
  FakeThemePreferences({this.writeDelay = Duration.zero, this.fail = false});
  final Duration writeDelay;
  final bool fail;
  final List<String> writes = [];
  String? value;

  @override
  Future<String?> readThemeMode() async => value;

  @override
  Future<void> writeThemeMode(String value) async {
    if (writeDelay != Duration.zero) {
      await Future<void>.delayed(writeDelay);
    }
    if (fail) throw Exception('storage unavailable');
    writes.add(value);
    this.value = value;
  }
}

class FakeCredentialStore implements SessionCredentialStore {
  FakeCredentialStore({this.failWrites = false, this.failDeletes = false});
  final bool failWrites, failDeletes;
  final values = <String, String>{};

  @override
  Future<String?> read(String key) async => values[key];

  @override
  Future<void> write(String key, String value) async {
    if (failWrites) throw Exception('write failed');
    values[key] = value;
  }

  @override
  Future<void> delete(String key) async {
    if (failDeletes) throw Exception('delete failed');
    values.remove(key);
  }
}

class RacingFakeClient extends ApiClient {
  @override
  Future<Map<String, dynamic>> request(String path,
      {String method = 'GET',
      Map<String, dynamic>? body,
      Map<String, dynamic>? query,
      Map<String, dynamic>? headers,
      CancelToken? cancelToken}) async {
    final month = query?['month']?.toString() ?? '';
    if (month == 'August 2026') {
      await Future<void>.delayed(const Duration(milliseconds: 30));
    }
    if (path == '/api/members') {
      return {
        'data': [
          {'Name': '$month member'}
        ]
      };
    }
    return {'data': <Map<String, dynamic>>[]};
  }
}
