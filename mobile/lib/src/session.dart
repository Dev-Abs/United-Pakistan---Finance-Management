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
    client.onSectorContextInvalid = clearSectorContext;
    client.onTokensRefreshed = (access, refresh) async {
      client.token = access;
      client.refreshToken = refresh;
      await _credentialStore.write(_tokenKey, access);
      await _credentialStore.write(_refreshTokenKey, refresh);
    };
  }

  static const _tokenKey = 'session_token';
  static const _roleKey = 'session_role';
  static const _systemRoleKey = 'session_system_role';
  static const _refreshTokenKey = 'session_refresh_token';
  static const _sectorIdKey = 'session_sector_id';
  static const _sectorNameKey = 'session_sector_name';
  static const themeKey = 'theme_mode';

  final ApiClient client;
  final SessionCredentialStore _credentialStore;
  final ThemePreferenceStore _themeStore;
  Future<void> _themeWrite = Future.value();
  int _themeRevision = 0;
  bool initialized = false;
  String? role;
  String? systemRole;
  String? sectorName;
  bool get isSuperAdmin => systemRole == 'super_admin';
  bool get hasSectorContext => client.sectorId != null;
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
      client.refreshToken = await _credentialStore.read(_refreshTokenKey);
      role = await _credentialStore.read(_roleKey);
      systemRole = await _credentialStore.read(_systemRoleKey);
      final savedSectorId = await _credentialStore.read(_sectorIdKey);
      sectorName = await _credentialStore.read(_sectorNameKey);
      client.sectorId = int.tryParse(savedSectorId ?? '');
      if (client.token != null) {
        final status = await client.request('/api/auth/status');
        if (status['authenticated'] != true) {
          await _clear();
        } else {
          role = status['role']?.toString() ?? role;
          systemRole = status['systemRole']?.toString() ?? systemRole;
          if (!isSuperAdmin) {
            client.sectorId = null;
            sectorName = null;
            await _credentialStore.delete(_sectorIdKey);
            await _credentialStore.delete(_sectorNameKey);
          }
        }
      }
    } catch (_) {
      client.token = null;
      client.refreshToken = null;
      role = null;
      systemRole = null;
      client.sectorId = null;
      sectorName = null;
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

  Future<void> persist(Object session) async {
    final data = session is Map<String, dynamic>
        ? session
        : <String, dynamic>{'role': session};
    role = data['role']?.toString() ?? 'admin';
    systemRole = data['systemRole']?.toString();
    client.refreshToken = data['refreshToken']?.toString();
    if (!isSuperAdmin) {
      client.sectorId = null;
      sectorName = null;
    }
    final token = client.token;
    try {
      if (token != null) {
        await _credentialStore.write(_tokenKey, token);
        await _credentialStore.write(_roleKey, role!);
        if (client.refreshToken != null) {
          await _credentialStore.write(_refreshTokenKey, client.refreshToken!);
        }
        if (systemRole != null) {
          await _credentialStore.write(_systemRoleKey, systemRole!);
        } else {
          await _credentialStore.delete(_systemRoleKey);
        }
        if (!isSuperAdmin) {
          await _credentialStore.delete(_sectorIdKey);
          await _credentialStore.delete(_sectorNameKey);
        }
      }
      sessionPersistenceError = null;
    } catch (_) {
      client.token = null;
      client.refreshToken = null;
      role = null;
      systemRole = null;
      sessionPersistenceError =
          'Secure sign-in storage is unavailable. Please try again.';
      notifyListeners();
      rethrow;
    }
    notifyListeners();
  }

  Future<void> signOut() async {
    final tokenToRevoke = client.refreshToken;
    if (tokenToRevoke != null) {
      try {
        await client.request('/api/auth/logout',
            method: 'POST', body: {'refreshToken': tokenToRevoke});
      } catch (_) {
        // Local sign-out must succeed even when the API is unreachable.
      }
    }
    client.token = null;
    client.refreshToken = null;
    role = null;
    systemRole = null;
    client.sectorId = null;
    sectorName = null;
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
    client.refreshToken = null;
    role = null;
    systemRole = null;
    client.sectorId = null;
    sectorName = null;
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
      await _credentialStore.delete(_systemRoleKey);
      await _credentialStore.delete(_refreshTokenKey);
      await _credentialStore.delete(_sectorIdKey);
      await _credentialStore.delete(_sectorNameKey);
    } catch (error) {
      firstError ??= error;
    }
    if (firstError != null) throw firstError;
  }

  Future<void> selectSector(int id, String name) async {
    client.sectorId = id;
    sectorName = name.trim();
    await _credentialStore.write(_sectorIdKey, id.toString());
    await _credentialStore.write(_sectorNameKey, sectorName!);
    notifyListeners();
  }

  Future<void> clearSectorContext() async {
    client.sectorId = null;
    sectorName = null;
    try {
      await _credentialStore.delete(_sectorIdKey);
      await _credentialStore.delete(_sectorNameKey);
    } finally {
      notifyListeners();
    }
  }
}
