import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:united_pakistan_finance/src/api_client.dart';
import 'package:united_pakistan_finance/src/screens.dart';

void main() {
  testWidgets('login validates empty credentials', (tester) async {
    await tester.pumpWidget(
      MaterialApp(
        home: LoginScreen(client: FakeClient(), onSignedIn: (_) {}),
      ),
    );
    await tester.pumpAndSettle();
    await tester.tap(find.text('Sign in').last);
    await tester.pumpAndSettle();
    expect(find.text('Enter your username and password.'), findsOneWidget);
  });

  testWidgets('home exposes primary payment action', (tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: HomeScreen(onRecordPayment: _noop)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Record payment'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('Needs attention'), 300);
    expect(find.text('Needs attention'), findsOneWidget);
  });
}

void _noop() {}

class FakeClient extends ApiClient {}
