import 'dart:async';
import 'dart:convert';
import 'package:flutter/widgets.dart';
import 'package:flutter_background_service/flutter_background_service.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:geolocator/geolocator.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;
import 'api.dart';

/// خدمة تتبّع الموقع في الخلفية — خدمة مقدّمة (foreground service) بإشعار دائم،
/// تستمر والجهاز مقفل أو التطبيق مُغلق، وتُخزّن النقاط محلياً عند انقطاع الإنترنت.
class LocationService {
  static const _channelId = 'xenon_tracking';
  static const _channelName = 'تتبّع المندوب';
  static const _notifId = 7001;
  static const _bufferKey = 'xenon_loc_buffer';

  static final _service = FlutterBackgroundService();

  /// يُستدعى مرّة عند إقلاع التطبيق لتهيئة قناة الإشعار والخدمة.
  static Future<void> initialize() async {
    final plugin = FlutterLocalNotificationsPlugin();
    const channel = AndroidNotificationChannel(
      _channelId,
      _channelName,
      description: 'إشعار دائم أثناء عمل المندوب وتتبّع موقعه',
      importance: Importance.low,
    );
    await plugin
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    await _service.configure(
      androidConfiguration: AndroidConfiguration(
        onStart: onStart,
        autoStart: false,
        isForegroundMode: true,
        notificationChannelId: _channelId,
        initialNotificationTitle: 'Xenon — جارٍ العمل 🟢',
        initialNotificationContent: 'التطبيق يعمل ويتتبّع موقعك ومسارك',
        foregroundServiceNotificationId: _notifId,
        foregroundServiceTypes: [AndroidForegroundType.location],
      ),
      iosConfiguration: IosConfiguration(autoStart: false, onForeground: onStart),
    );
  }

  static Future<bool> isRunning() => _service.isRunning();

  /// بدء العمل: يطلب صلاحيات الموقع ثم يشغّل الخدمة بالإشعار الدائم.
  static Future<bool> start() async {
    final ok = await _ensurePermissions();
    if (!ok) return false;
    await _service.startService();
    try { await Api.instance.trackingStatus(true); } catch (_) {}
    return true;
  }

  /// إيقاف العمل.
  static Future<void> stop() async {
    _service.invoke('stopService');
    try { await Api.instance.trackingStatus(false); } catch (_) {}
  }

  static Future<bool> _ensurePermissions() async {
    bool enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return false;
    var perm = await Geolocator.checkPermission();
    if (perm == LocationPermission.denied) {
      perm = await Geolocator.requestPermission();
    }
    if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) {
      return false;
    }
    // على أندرويد 10+ نطلب «السماح طوال الوقت» (الخلفية)
    try {
      if (perm == LocationPermission.whileInUse) {
        await Geolocator.requestPermission();
      }
    } catch (_) {}
    return true;
  }
}

/// نقطة دخول الخدمة في عزلة (isolate) منفصلة — يجب أن تكون دالّة عُليا.
@pragma('vm:entry-point')
void onStart(ServiceInstance service) async {
  WidgetsFlutterBinding.ensureInitialized();

  service.on('stopService').listen((_) => service.stopSelf());

  final prefs = await SharedPreferences.getInstance();
  final token = prefs.getString('xenon_token');

  StreamSubscription<Position>? sub;
  sub = Geolocator.getPositionStream(
    locationSettings: const LocationSettings(
      accuracy: LocationAccuracy.high,
      distanceFilter: 10,
    ),
  ).listen((pos) async {
    final now = DateTime.now();
    if (service is AndroidServiceInstance) {
      service.setForegroundNotificationInfo(
        title: 'Xenon — جارٍ العمل 🟢',
        content: 'آخر تحديث ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')} — يتتبّع موقعك',
      );
    }
    final point = {
      'latitude': pos.latitude,
      'longitude': pos.longitude,
      'accuracy': pos.accuracy,
      'speed': pos.speed,
      'heading': pos.heading,
      'recordedAt': now.toUtc().toIso8601String(),
    };
    await _sendOrBuffer(prefs, token, point);
  });

  service.on('stopService').listen((_) {
    sub?.cancel();
    service.stopSelf();
  });
}

/// يرسل النقطة للخادم، وإلّا يخزّنها محلياً ويحاول دفع المخزون لاحقاً.
Future<void> _sendOrBuffer(SharedPreferences prefs, String? token, Map<String, dynamic> point) async {
  final base = kMobileBase;
  final headers = {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };
  try {
    final r = await http
        .post(Uri.parse('$base/location'), headers: headers, body: jsonEncode(point))
        .timeout(const Duration(seconds: 20));
    if (r.statusCode < 200 || r.statusCode >= 300) throw Exception('bad status');
    // نجح الإرسال — جرّب دفع ما تراكم محلياً
    await _flushBuffer(prefs, token);
  } catch (_) {
    // لا إنترنت/فشل — خزّن محلياً (بحدّ أقصى 5000 نقطة)
    final raw = prefs.getStringList('xenon_loc_buffer') ?? [];
    raw.add(jsonEncode(point));
    if (raw.length > 5000) raw.removeRange(0, raw.length - 5000);
    await prefs.setStringList('xenon_loc_buffer', raw);
  }
}

Future<void> _flushBuffer(SharedPreferences prefs, String? token) async {
  final raw = prefs.getStringList('xenon_loc_buffer') ?? [];
  if (raw.isEmpty) return;
  final headers = {
    'Content-Type': 'application/json',
    if (token != null) 'Authorization': 'Bearer $token',
  };
  final locations = raw.map((s) => jsonDecode(s)).toList();
  try {
    final r = await http
        .post(Uri.parse('$kMobileBase/location/batch'),
            headers: headers, body: jsonEncode({'locations': locations}))
        .timeout(const Duration(seconds: 30));
    if (r.statusCode >= 200 && r.statusCode < 300) {
      await prefs.remove('xenon_loc_buffer');
    }
  } catch (_) {/* نُبقيها للمحاولة التالية */}
}
