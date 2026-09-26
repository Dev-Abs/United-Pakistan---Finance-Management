import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:united_pakistan_finance/src/api_client.dart';
import 'package:united_pakistan_finance/src/finance_store.dart';
import 'package:united_pakistan_finance/src/parity_screens.dart';
import 'package:united_pakistan_finance/src/screens.dart';

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
}

class FakeClient extends ApiClient {
  @override
  Future<Map<String, dynamic>> request(String path,
          {String method = 'GET',
          Map<String, dynamic>? body,
          Map<String, dynamic>? query}) async =>
      <String, dynamic>{};
}

class StatefulFakeClient extends ApiClient {
  bool failMembers = false;

  @override
  Future<Map<String, dynamic>> request(String path,
      {String method = 'GET',
      Map<String, dynamic>? body,
      Map<String, dynamic>? query}) async {
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
