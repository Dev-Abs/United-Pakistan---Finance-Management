import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

import 'api_client.dart';

class AppSession extends ChangeNotifier {
  AppSession(this.client, {FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  static const _tokenKey = 'session_token';
  static const _roleKey = 'session_role';

  final ApiClient client;
  final FlutterSecureStorage _storage;
  bool initialized = false;
  String? role;

  bool get isSignedIn => client.token != null;
  bool get isReadOnly => role == 'reader';

  Future<void> restore() async {
    try {
      client.token = await _storage.read(key: _tokenKey);
      role = await _storage.read(key: _roleKey);
    } catch (_) {
      client.token = null;
      role = null;
    } finally {
      initialized = true;
      notifyListeners();
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
    client.token = null;
    role = null;
    await _storage.delete(key: _tokenKey);
    await _storage.delete(key: _roleKey);
    notifyListeners();
  }
}
