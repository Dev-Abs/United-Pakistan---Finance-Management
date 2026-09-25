import 'package:dynamic_color/dynamic_color.dart';
import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';
import 'package:responsive_framework/responsive_framework.dart';
import 'package:toastification/toastification.dart';

import 'api_client.dart';
import 'screens.dart';
import 'session.dart';
import 'theme.dart';

class FinanceApp extends StatefulWidget {
  const FinanceApp({super.key});

  @override
  State<FinanceApp> createState() => _FinanceAppState();
}

class _FinanceAppState extends State<FinanceApp> {
  late final ApiClient client;
  late final AppSession session;
  late final GoRouter router;

  @override
  void initState() {
    super.initState();
    client = ApiClient();
    session = AppSession(client);
    router = GoRouter(
      initialLocation: '/launch',
      refreshListenable: session,
      redirect: (_, state) {
        if (!session.initialized) return '/launch';
        if (!session.isSignedIn && state.matchedLocation != '/login') {
          return '/login';
        }
        if (session.isSignedIn &&
            (state.matchedLocation == '/login' ||
                state.matchedLocation == '/launch')) {
          return '/';
        }
        return null;
      },
      routes: [
        GoRoute(
          path: '/launch',
          builder: (_, __) => const AppLaunchScreen(),
        ),
        GoRoute(
          path: '/login',
          pageBuilder: (_, state) => CustomTransitionPage<void>(
            key: state.pageKey,
            child: LoginScreen(
              client: client,
              onSignedIn: session.persist,
            ),
            transitionsBuilder: (_, animation, __, child) => FadeTransition(
              opacity: animation,
              child: child,
            ),
          ),
        ),
        GoRoute(
          path: '/',
          pageBuilder: (_, state) => NoTransitionPage<void>(
            key: state.pageKey,
            child: AppShell(
              readOnly: session.isReadOnly,
              client: client,
              onSignOut: session.signOut,
            ),
          ),
        ),
      ],
    );
    session.restore();
  }

  @override
  void dispose() {
    router.dispose();
    session.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => DynamicColorBuilder(
        builder: (lightDynamic, darkDynamic) => ToastificationWrapper(
          child: MaterialApp.router(
            title: 'United Pakistan Finance',
            debugShowCheckedModeBanner: false,
            routerConfig: router,
            theme: buildTheme(
              brightness: Brightness.light,
              dynamicScheme: lightDynamic,
            ),
            darkTheme: buildTheme(
              brightness: Brightness.dark,
              dynamicScheme: darkDynamic,
            ),
            themeMode: ThemeMode.system,
            builder: (context, child) => ResponsiveBreakpoints.builder(
              child: child!,
              breakpoints: const [
                Breakpoint(start: 0, end: 359, name: 'COMPACT'),
                Breakpoint(start: 360, end: 599, name: MOBILE),
                Breakpoint(start: 600, end: 1023, name: TABLET),
                Breakpoint(start: 1024, end: double.infinity, name: DESKTOP),
              ],
            ),
          ),
        ),
      );
}
