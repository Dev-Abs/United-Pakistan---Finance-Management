import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

abstract interface class ThemePreferenceStore {
  Future<String?> readThemeMode();
  Future<void> writeThemeMode(String value);
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
      {FlutterSecureStorage? storage, ThemePreferenceStore? themeStore})
      : _storage = storage ?? const FlutterSecureStorage(),
        _themeStore = themeStore ??
            SecureThemePreferenceStore(
                storage ?? const FlutterSecureStorage()) {
    client.onUnauthorized = signOut;
  }

  static const _tokenKey = 'session_token';
  static const _roleKey = 'session_role';
  static const themeKey = 'theme_mode';

  final ApiClient client;
  final FlutterSecureStorage _storage;
  final ThemePreferenceStore _themeStore;
  Future<void> _themeWrite = Future.value();
  int _themeRevision = 0;
  bool initialized = false;
  String? role;
  String themeMode = 'system';
  String? themePersistenceError;

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
      client.token = await _storage.read(key: _tokenKey);
      role = await _storage.read(key: _roleKey);
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
    if (token != null) {
      await _storage.write(key: _tokenKey, value: token);
      await _storage.write(key: _roleKey, value: newRole);
    }
    notifyListeners();
  }

  Future<void> signOut() async {
    await _clear();
    notifyListeners();
  }

  Future<void> _clear() async {
    client.token = null;
    role = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _roleKey);
  }
}
