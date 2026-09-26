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
  ApiClient({String? baseUrl})
      : baseUrl = baseUrl ??
            const String.fromEnvironment(
              'API_BASE_URL',
              defaultValue: 'http://10.0.2.2:3000',
            ) {
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
          handler.next(options);
        },
      ),
    );
  }

  final String baseUrl;
  late final Dio _dio;
  String? token;
  VoidCallback? onUnauthorized;

  Future<Map<String, dynamic>> request(
    String path, {
    String method = 'GET',
    Map<String, dynamic>? body,
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await _dio.request<Object?>(
        path,
        data: body,
        queryParameters: query,
        options: Options(method: method),
      );
      final data = response.data;
      if (data == null) return <String, dynamic>{};
      if (data is Map<String, dynamic>) return data;
      if (data is Map) return Map<String, dynamic>.from(data);
      throw const ApiException('The server returned an unexpected response.');
    } on DioException catch (error) {
      final status = error.response?.statusCode;
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
      throw ApiException('Request failed. Please try again.',
          statusCode: status);
    }
  }
}
