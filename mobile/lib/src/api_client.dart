import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

class ApiException implements Exception {
  const ApiException(this.message, {this.statusCode});
  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({String? baseUrl}) : baseUrl = _resolveBaseUrl(baseUrl) {
    _dio = Dio(
      BaseOptions(
        baseUrl: this.baseUrl,
        connectTimeout: const Duration(seconds: 15),
        receiveTimeout: const Duration(seconds: 15),
        sendTimeout: const Duration(seconds: 15),
        responseType: ResponseType.json,
        headers: const {'Accept': 'application/json'},
      ),
    );
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) {
          if (token case final value?) {
            options.headers[HttpHeaders.authorizationHeader] = 'Bearer $value';
          }
          if (options.method.toUpperCase() != 'GET' &&
              !options.headers.containsKey('Idempotency-Key')) {
            options.headers['Idempotency-Key'] =
                '${DateTime.now().microsecondsSinceEpoch}-${options.path}';
          }
          handler.next(options);
        },
      ),
    );
  }

  final String baseUrl;
  late final Dio _dio;
  final Map<String, Future<Map<String, dynamic>>> _inflightGets = {};
  String? token;
  String? refreshToken;
  VoidCallback? onUnauthorized;
  Future<void> Function(String accessToken, String refreshToken)?
      onTokensRefreshed;

  static String _resolveBaseUrl(String? override) {
    final configured = (override ??
            const String.fromEnvironment('API_BASE_URL', defaultValue: ''))
        .trim()
        .replaceAll(RegExp(r'/$'), '');
    if (configured.isEmpty) {
      if (kReleaseMode) {
        throw StateError(
          'API_BASE_URL must be provided for release builds.',
        );
      }
      return 'http://10.0.2.2:3000';
    }
    final uri = Uri.tryParse(configured);
    if (uri == null || !uri.hasScheme || uri.host.isEmpty) {
      throw ArgumentError.value(configured, 'baseUrl', 'Use an absolute URL.');
    }
    if (kReleaseMode && uri.scheme != 'https') {
      throw StateError('Release builds require an HTTPS API_BASE_URL.');
    }
    return configured;
  }

  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
  }) async {
    final normalizedMethod = method.toUpperCase();
    final dedupeKey = normalizedMethod == 'GET' && cancelToken == null
        ? _getKey(path, query)
        : null;
    if (dedupeKey != null) {
      final existing = _inflightGets[dedupeKey];
      if (existing != null) return existing;
      final future = _performRequest(
        path,
        method: normalizedMethod,
        body: body,
        query: query,
      );
      _inflightGets[dedupeKey] = future;
      try {
        return await future;
      } finally {
        if (identical(_inflightGets[dedupeKey], future)) {
          _inflightGets.remove(dedupeKey);
        }
      }
    }
    return _performRequest(
      path,
      method: normalizedMethod,
      body: body,
      query: query,
      cancelToken: cancelToken,
    );
  }

  String _getKey(String path, Map<String, dynamic>? query) {
    final entries = (query ?? const <String, dynamic>{}).entries.toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    return '$path?${entries.map((e) => '${e.key}=${e.value}').join('&')}';
  }

  Future<Map<String, dynamic>> _performRequest(
    String path, {
    required String method,
    Map<String, dynamic>? body,
    Map<String, dynamic>? query,
    CancelToken? cancelToken,
    bool retryAfterRefresh = true,
  }) async {
    try {
      final response = await _dio.request<Object?>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method),
        cancelToken: cancelToken,
      );
      final data = response.data;
      if (data == null) return <String, dynamic>{};
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      throw const ApiException('The server returned an unexpected response.');
    } on DioException catch (error) {
      final status = error.response?.statusCode;
      if (status == 401 &&
          retryAfterRefresh &&
          refreshToken != null &&
          !path.contains('/api/auth/refresh')) {
        try {
          final refreshed = await _dio.post<Object?>('/api/auth/refresh',
              data: {'refreshToken': refreshToken});
          final values = refreshed.data is Map
              ? Map<String, dynamic>.from(refreshed.data as Map)
              : const <String, dynamic>{};
          token = values['token']?.toString();
          refreshToken = values['refreshToken']?.toString() ?? refreshToken;
          if (token != null &&
              refreshToken != null &&
              onTokensRefreshed != null) {
            await onTokensRefreshed!(token!, refreshToken!);
          }
          return _performRequest(path,
              method: method,
              body: body,
              query: query,
              cancelToken: cancelToken,
              retryAfterRefresh: false);
        } catch (_) {
          refreshToken = null;
        }
      }
      if (status == 401) onUnauthorized?.call();
      final data = error.response?.data;
      final serverMessage = data is Map ? data['error']?.toString() : null;
      if (serverMessage != null && serverMessage.isNotEmpty) {
        throw ApiException(serverMessage, statusCode: status);
      }
      if (error.type == DioExceptionType.connectionTimeout ||
          error.type == DioExceptionType.receiveTimeout ||
          error.type == DioExceptionType.sendTimeout) {
        throw const ApiException(
          'The server took too long to respond. Try again.',
        );
      }
      if (error.type == DioExceptionType.connectionError ||
          error.error is SocketException) {
        throw const ApiException(
          'You appear to be offline. Check your connection and try again.',
        );
      }
      if (error.type == DioExceptionType.cancel) {
        throw const ApiException('Request cancelled.');
      }
      throw ApiException('Request failed. Please try again.',
          statusCode: status);
    }
  }
}
