import 'package:latlong2/latlong.dart';

/// استخراج إحداثيات من رابط خرائط (q=.. أو @lat,lng) أو نص "lat,lng"
LatLng? parseLatLng(String? input) {
  if (input == null || input.isEmpty) return null;
  final patterns = [
    RegExp(r'[?&](?:q|ll|destination|daddr)=(-?\d+\.\d+)[, ]+(-?\d+\.\d+)', caseSensitive: false),
    RegExp(r'@(-?\d+\.\d+),(-?\d+\.\d+)'),
    RegExp(r'(-?\d{1,2}\.\d{3,}),\s*(-?\d{1,3}\.\d{3,})'),
  ];
  for (final re in patterns) {
    final m = re.firstMatch(input);
    if (m != null) {
      final lat = double.tryParse(m.group(1)!);
      final lng = double.tryParse(m.group(2)!);
      if (lat != null && lng != null && lat.abs() <= 90 && lng.abs() <= 180) {
        return LatLng(lat, lng);
      }
    }
  }
  return null;
}

class Order {
  final Map<String, dynamic> raw;
  Order(this.raw);

  int get id => (raw['id'] as num).toInt();
  String get status => (raw['status'] ?? '').toString();
  int get price => ((raw['price'] ?? 0) as num).toInt();
  int get discount => ((raw['discount'] ?? 0) as num).toInt();
  int get net => price - discount;
  String? get note => raw['note']?.toString();
  String? get regionName => raw['regionName']?.toString();
  String? get provinceName => raw['provinceName']?.toString();
  String? get customerName => raw['customerName']?.toString();
  String? get customerPhone => raw['customerPhone']?.toString();
  String? get address => raw['address']?.toString() ?? raw['customerAddress1']?.toString();
  String? get deliveryImage => raw['deliveryImage']?.toString();

  String? get locationUrl =>
      (raw['locationLink'] ?? raw['customerLocationUrl1'] ?? raw['customerLocationUrl2'])?.toString();
  LatLng? get customerLatLng => parseLatLng(locationUrl);

  DateTime? get createdAt => DateTime.tryParse(raw['createdAt']?.toString() ?? '');
  DateTime? get deliveredAt => DateTime.tryParse(raw['deliveredAt']?.toString() ?? '');

  bool get isNew => status == 'pending_approval';
  bool get isCurrent => status == 'pending' || status == 'postponed';
  bool get isFinished => status == 'delivered' || status == 'returned' || status == 'cancelled';

  String get statusLabel {
    switch (status) {
      case 'pending_approval': return 'بانتظار الموافقة';
      case 'pending': return 'قيد التوصيل';
      case 'delivered': return 'تم التسليم';
      case 'postponed': return 'مؤجّل';
      case 'returned': return 'مُرجَع';
      case 'cancelled': return 'ملغى';
      default: return status;
    }
  }
}
