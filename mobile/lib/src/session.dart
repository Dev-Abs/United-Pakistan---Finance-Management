import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

abstract interface class ThemePreferenceStore {
  Future<String?> readThemeMode();
  Future<void> writeThemeMode(String value);
}

abstract interface class SessionCredentialStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureSessionCredentialStore implements SessionCredentialStore {
  const SecureSessionCredentialStore(this.storage);
  final FlutterSecureStorage storage;

  @override
  Future<String?> read(String key) => storage.read(key: key);

  @override
  Future<void> write(String key, String value) =>
      storage.write(key: key, value: value);

  @override
  Future<void> delete(String key) => storage.delete(key: key);
}

class SecureThemePreferenceStore implements ThemePreferenceStore {
  const SecureThemePreferenceStore(this.storage);
  final FlutterSecureStorage storage;

  @override
  Future<String?> readThemeMode() => storage.read(key: AppSession.themeKey);

  @override
  Future<void> writeThemeMode(String value) =>
      storage.write(key: AppSession.themeKey, value: value);
}

class AppSession extends ChangeNotifier {
  AppSession(this.client,
      {FlutterSecureStorage? storage,
      ThemePreferenceStore? themeStore,
      SessionCredentialStore? credentialStore})
      : _credentialStore = credentialStore ??
            SecureSessionCredentialStore(
                storage ?? const FlutterSecureStorage()),
        _themeStore = themeStore ??
            SecureThemePreferenceStore(
                storage ?? const FlutterSecureStorage()) {
    client.onUnauthorized = signOut;
  }

  static const _tokenKey = 'session_token';
  static const _roleKey = 'session_role';
  static const themeKey = 'theme_mode';

  final ApiClient client;
  final SessionCredentialStore _credentialStore;
  final ThemePreferenceStore _themeStore;
  Future<void> _themeWrite = Future.value();
  int _themeRevision = 0;
  bool initialized = false;
  String? role;
  String themeMode = 'system';
  String? themePersistenceError;
  String? sessionPersistenceError;

  bool get isSignedIn => client.token != null;
  bool get isReadOnly => role == 'reader';

  Future<void> restore() async {
    try {
      themeMode = await _themeStore.readThemeMode() ?? 'system';
      if (!const {'system', 'light', 'dark'}.contains(themeMode)) {
        themeMode = 'system';
      }
    } catch (_) {
      themeMode = 'system';
      themePersistenceError =
          'Saved appearance could not be read. Using the system theme.';
    }
    try {
      client.token = await _credentialStore.read(_tokenKey);
      role = await _credentialStore.read(_roleKey);
      if (client.token != null) {
        final status = await client.request('/api/auth/status');
        if (status['authenticated'] != true) {
          await _clear();
        } else {
          role = status['role']?.toString() ?? role;
        }
      }
    } catch (_) {
      client.token = null;
      role = null;
      sessionPersistenceError =
          'The saved session could not be restored. Please sign in again.';
    } finally {
      initialized = true;
      notifyListeners();
    }
  }

  Future<void> setThemeMode(String value) async {
    if (!const {'system', 'light', 'dark'}.contains(value) ||
        value == themeMode) {
      return;
    }
    themeMode = value;
    themePersistenceError = null;
    final revision = ++_themeRevision;
    notifyListeners();
    final write = _themeWrite.then((_) => _themeStore.writeThemeMode(value));
    _themeWrite = write.catchError((_) {});
    try {
      await write;
    } catch (_) {
      if (revision == _themeRevision) {
        themePersistenceError =
            'Appearance changed for this session, but could not be saved.';
        notifyListeners();
      }
      rethrow;
    }
  }

  Future<void> persist(String newRole) async {
    role = newRole;
    final token = client.token;
    try {
      if (token != null) {
        await _credentialStore.write(_tokenKey, token);
        await _credentialStore.write(_roleKey, newRole);
      }
      sessionPersistenceError = null;
    } catch (_) {
      client.token = null;
      role = null;
      sessionPersistenceError =
          'Secure sign-in storage is unavailable. Please try again.';
      notifyListeners();
      rethrow;
    }
    notifyListeners();
  }

  Future<void> signOut() async {
    client.token = null;
    role = null;
    try {
      await _deleteCredentials();
      sessionPersistenceError = null;
    } catch (_) {
      sessionPersistenceError =
          'Signed out locally, but secure storage could not be cleared.';
    } finally {
      notifyListeners();
    }
  }

  Future<void> _clear() async {
    client.token = null;
    role = null;
    await _deleteCredentials();
  }

  Future<void> _deleteCredentials() async {
    Object? firstError;
    try {
      await _credentialStore.delete(_tokenKey);
    } catch (error) {
      firstError = error;
    }
    try {
      await _credentialStore.delete(_roleKey);
    } catch (error) {
      firstError ??= error;
    }
    if (firstError != null) throw firstError;
  }
}
