import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

class AppSession extends ChangeNotifier {
  AppSession(this.client, {FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage() {
    client.onUnauthorized = signOut;
  }

  static const _tokenKey = 'session_token';
  static const _roleKey = 'session_role';
  static const _themeKey = 'theme_mode';

  final ApiClient client;
  final FlutterSecureStorage _storage;
  bool initialized = false;
  String? role;
  String themeMode = 'system';

  bool get isSignedIn => client.token != null;
  bool get isReadOnly => role == 'reader';

  Future<void> restore() async {
    try {
      themeMode = await _storage.read(key: _themeKey) ?? 'system';
      if (!const {'system', 'light', 'dark'}.contains(themeMode)) {
        themeMode = 'system';
      }
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
    notifyListeners();
    await _storage.write(key: _themeKey, value: value);
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
