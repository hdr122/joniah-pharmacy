import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

/// عنوان خادم Xenon — يمكن تغييره عبر --dart-define=API_BASE=...
const String kApiBase = String.fromEnvironment(
  'API_BASE',
  defaultValue: 'https://xenondelivery.up.railway.app',
);
String get kMobileBase => '$kApiBase/api/mobile';

const _kTokenKey = 'xenon_token';

class ApiException implements Exception {
  final int status;
  final String message;
  ApiException(this.status, this.message);
  @override
  String toString() => message;
}

class Api {
  Api._();
  static final Api instance = Api._();

  String? _token;
  String? get token => _token;

  Future<void> loadToken() async {
    final p = await SharedPreferences.getInstance();
    _token = p.getString(_kTokenKey);
  }

  Future<void> _setToken(String? t) async {
    _token = t;
    final p = await SharedPreferences.getInstance();
    if (t == null) {
      await p.remove(_kTokenKey);
    } else {
      await p.setString(_kTokenKey, t);
    }
  }

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (_token != null) 'Authorization': 'Bearer $_token',
      };

  Uri _u(String path, [Map<String, dynamic>? q]) =>
      Uri.parse('$kMobileBase$path').replace(
        queryParameters: q?.map((k, v) => MapEntry(k, '$v')),
      );

  dynamic _decode(http.Response r) {
    dynamic body;
    try {
      body = r.body.isNotEmpty ? jsonDecode(r.body) : null;
    } catch (_) {
      body = null;
    }
    if (r.statusCode >= 200 && r.statusCode < 300) return body;
    final msg = (body is Map && (body['error'] != null || body['message'] != null))
        ? (body['error'] ?? body['message']).toString()
        : 'خطأ في الخادم (${r.statusCode})';
    throw ApiException(r.statusCode, msg);
  }

  // ── المصادقة ──
  Future<Map<String, dynamic>> login(String username, String password) async {
    final r = await http.post(_u('/login'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'username': username, 'password': password}));
    final data = _decode(r) as Map<String, dynamic>;
    await _setToken(data['token'] as String?);
    return data['user'] as Map<String, dynamic>;
  }

  Future<void> logout() async => _setToken(null);

  Future<Map<String, dynamic>> me() async =>
      _decode(await http.get(_u('/me'), headers: _headers)) as Map<String, dynamic>;

  // ── الطلبات ──
  Future<List<dynamic>> orders() async =>
      _decode(await http.get(_u('/orders'), headers: _headers)) as List<dynamic>;

  Future<void> acceptOrder(int id, {double? lat, double? lng}) async =>
      _decode(await http.post(_u('/orders/$id/accept'),
          headers: _headers,
          body: jsonEncode({if (lat != null) 'latitude': lat, if (lng != null) 'longitude': lng})));

  Future<void> rejectOrder(int id, String reason) async => _decode(await http.post(
      _u('/orders/$id/reject'),
      headers: _headers,
      body: jsonEncode({'reason': reason})));

  Future<void> deliverOrder(int id,
      {String? note, String? imageBase64, String mimeType = 'image/jpeg', double? lat, double? lng}) async {
    if (imageBase64 != null) {
      // رفع صورة الإثبات يُعلّم الطلب "مُسلّم" تلقائياً
      _decode(await http.post(_u('/orders/$id/deliver-image'),
          headers: _headers,
          body: jsonEncode({'imageBase64': imageBase64, 'mimeType': mimeType})));
    } else {
      _decode(await http.post(_u('/orders/$id/deliver'),
          headers: _headers,
          body: jsonEncode({
            'deliveryNote': note ?? '',
            if (lat != null) 'latitude': lat,
            if (lng != null) 'longitude': lng,
          })));
    }
  }

  Future<void> postponeOrder(int id, String reason) async => _decode(await http.post(
      _u('/orders/$id/postpone'),
      headers: _headers,
      body: jsonEncode({'reason': reason})));

  // ── الموقع ──
  Future<void> sendLocation(Map<String, dynamic> loc) async =>
      _decode(await http.post(_u('/location'), headers: _headers, body: jsonEncode(loc)));

  Future<void> sendLocationBatch(List<Map<String, dynamic>> locations) async => _decode(
      await http.post(_u('/location/batch'),
          headers: _headers, body: jsonEncode({'locations': locations})));

  // ── الإحصاءات والإشعارات والملف ──
  Future<Map<String, dynamic>> stats() async =>
      _decode(await http.get(_u('/stats'), headers: _headers)) as Map<String, dynamic>;

  Future<List<dynamic>> notifications() async {
    final d = _decode(await http.get(_u('/notifications'), headers: _headers));
    if (d is Map && d['notifications'] is List) return d['notifications'] as List<dynamic>;
    return d is List ? d : <dynamic>[];
  }

  Future<void> trackingStatus(bool active) async => _decode(await http.post(
      _u('/tracking-status'),
      headers: _headers,
      body: jsonEncode({'active': active})));

  Future<void> changePassword(String oldP, String newP) async => _decode(await http.post(
      _u('/change-password'),
      headers: _headers,
      body: jsonEncode({'oldPassword': oldP, 'newPassword': newP})));
}
