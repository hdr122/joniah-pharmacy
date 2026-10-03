import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import '../api.dart';
import '../models.dart';
import '../theme.dart';
import '../location_service.dart';
import '../widgets/order_card.dart';
import 'login_screen.dart';
import 'profile_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _tab = 0;
  List<Order> _orders = [];
  Map<String, dynamic> _stats = {};
  Map<String, dynamic> _user = {};
  bool _loading = true;
  bool _working = false;
  Timer? _poll;
  LatLng? _me;
  StreamSubscription<Position>? _meSub;

  @override
  void initState() {
    super.initState();
    _refresh();
    _poll = Timer.periodic(const Duration(seconds: 20), (_) => _refresh(silent: true));
    LocationService.isRunning().then((r) => mounted ? setState(() => _working = r) : null);
    _watchMe();
  }

  @override
  void dispose() {
    _poll?.cancel();
    _meSub?.cancel();
    super.dispose();
  }

  Future<void> _watchMe() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied || perm == LocationPermission.deniedForever) return;
      _meSub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 15),
      ).listen((p) => mounted ? setState(() => _me = LatLng(p.latitude, p.longitude)) : null);
    } catch (_) {}
  }

  Future<void> _refresh({bool silent = false}) async {
    if (!silent) setState(() => _loading = true);
    try {
      final results = await Future.wait([
        Api.instance.orders(),
        Api.instance.stats().catchError((_) => <String, dynamic>{}),
        Api.instance.me().catchError((_) => _user),
      ]);
      if (!mounted) return;
      setState(() {
        _orders = (results[0] as List).map((e) => Order(e as Map<String, dynamic>)).toList();
        _stats = results[1] as Map<String, dynamic>;
        _user = results[2] as Map<String, dynamic>;
        _loading = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() => _loading = false);
      if (!silent) _toast(e.toString());
    }
  }

  void _toast(String m) => ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(m)));

  Future<void> _toggleWork() async {
    if (_working) {
      await LocationService.stop();
      setState(() => _working = false);
      _toast('تم إيقاف العمل');
    } else {
      final ok = await LocationService.start();
      setState(() => _working = ok);
      _toast(ok ? 'بدأ العمل — التتبّع يعمل حتى والجهاز مقفل' : 'نحتاج صلاحية الموقع «طوال الوقت» من الإعدادات');
    }
  }

  // ── إجراءات الطلب ──
  Future<void> _accept(Order o) async {
    try {
      await Api.instance.acceptOrder(o.id, lat: _me?.latitude, lng: _me?.longitude);
      _toast('تم قبول الطلب'); _refresh(silent: true);
    } catch (e) { _toast(e.toString()); }
  }

  Future<void> _reason(Order o, String title, Future<void> Function(String) action) async {
    final ctrl = TextEditingController();
    final reason = await showDialog<String>(
      context: context,
      builder: (c) => AlertDialog(
        title: Text(title),
        content: TextField(controller: ctrl, maxLines: 3, decoration: const InputDecoration(hintText: 'اكتب السبب…')),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c), child: const Text('إلغاء')),
          ElevatedButton(onPressed: () => Navigator.pop(c, ctrl.text.trim()), child: const Text('تأكيد')),
        ],
      ),
    );
    if (reason == null || reason.isEmpty) return;
    try { await action(reason); _toast('تم'); _refresh(silent: true); } catch (e) { _toast(e.toString()); }
  }

  Future<void> _deliver(Order o) async {
    final choice = await showModalBottomSheet<String>(
      context: context,
      backgroundColor: XColors.cardDark,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (c) => SafeArea(
        child: Column(mainAxisSize: MainAxisSize.min, children: [
          const SizedBox(height: 8),
          const Text('تأكيد تسليم الطلب', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
          const SizedBox(height: 8),
          ListTile(leading: const Icon(Icons.camera_alt, color: XColors.violet), title: const Text('تسليم مع صورة إثبات'), onTap: () => Navigator.pop(c, 'photo')),
          ListTile(leading: const Icon(Icons.check_circle, color: Colors.green), title: const Text('تسليم بدون صورة'), onTap: () => Navigator.pop(c, 'plain')),
          ListTile(leading: const Icon(Icons.close), title: const Text('إلغاء'), onTap: () => Navigator.pop(c)),
        ]),
      ),
    );
    if (choice == null) return;
    try {
      if (choice == 'photo') {
        final x = await ImagePicker().pickImage(source: ImageSource.camera, imageQuality: 55, maxWidth: 1280);
        if (x == null) return;
        final b64 = base64Encode(await x.readAsBytes());
        await Api.instance.deliverOrder(o.id, imageBase64: 'data:image/jpeg;base64,$b64', mimeType: 'image/jpeg');
      } else {
        await Api.instance.deliverOrder(o.id, lat: _me?.latitude, lng: _me?.longitude);
      }
      _toast('تم تسليم الطلب ✓'); _refresh(silent: true);
    } catch (e) { _toast(e.toString()); }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(child: _loading ? const Center(child: CircularProgressIndicator()) : _body()),
      bottomNavigationBar: _bottomNav(),
    );
  }

  Widget _body() {
    switch (_tab) {
      case 1: return _ordersView(log: true);
      case 2: return _mapTab();
      case 3: return ProfileScreen(user: _user, onLogout: _logout);
      default: return _ordersView(log: false);
    }
  }

  Future<void> _logout() async {
    await LocationService.stop();
    await Api.instance.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
  }

  // ── رأس + إحصاءات + حالة العمل ──
  Widget _header() {
    final today = _stats['todayDelivered'] ?? 0;
    final total = _stats['deliveredOrders'] ?? _stats['totalDelivered'] ?? 0;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: XColors.cardDark,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: Colors.white.withValues(alpha: 0.06)),
      ),
      child: Column(children: [
        Row(children: [
          Container(
            width: 46, height: 46,
            decoration: BoxDecoration(gradient: xenonGradient, borderRadius: BorderRadius.circular(14)),
            child: const Icon(Icons.auto_awesome, color: Colors.white),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
              Text('مرحباً ${_user['name'] ?? 'مندوب'} 👋',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
              Text('مندوب Xenon', style: TextStyle(color: Colors.white.withValues(alpha: 0.55), fontSize: 13)),
            ]),
          ),
        ]),
        const SizedBox(height: 14),
        Row(children: [
          Expanded(child: _stat('تسليمات اليوم', '$today', Icons.today, Colors.greenAccent)),
          const SizedBox(width: 10),
          Expanded(child: _stat('إجمالي التسليمات', '$total', Icons.local_shipping, XColors.fuchsia)),
        ]),
        const SizedBox(height: 14),
        _workStrip(),
      ]),
    );
  }

  Widget _stat(String label, String value, IconData icon, Color color) => Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(color: XColors.surfaceDark, borderRadius: BorderRadius.circular(14)),
        child: Row(children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(width: 10),
          Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
            Text(label, style: TextStyle(fontSize: 11, color: Colors.white.withValues(alpha: 0.6))),
          ]),
        ]),
      );

  Widget _workStrip() => Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(
          color: (_working ? Colors.green : XColors.violet).withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: (_working ? Colors.green : XColors.violet).withValues(alpha: 0.4)),
        ),
        child: Row(children: [
          Icon(_working ? Icons.navigation : Icons.navigation_outlined,
              color: _working ? Colors.greenAccent : Colors.white70),
          const SizedBox(width: 10),
          Expanded(
            child: Text(_working ? 'جارٍ العمل — التتبّع نشط' : 'أنت غير نشط',
                style: const TextStyle(fontWeight: FontWeight.bold)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: _working ? Colors.redAccent : Colors.green,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            ),
            onPressed: _toggleWork,
            child: Text(_working ? 'إيقاف' : 'ابدأ العمل'),
          ),
        ]),
      );

  // ── عرض الطلبات (رئيسية بأقسام / سجل اليوم) ──
  Widget _ordersView({required bool log}) {
    final now = DateTime.now();
    final dayStart = DateTime(now.year, now.month, now.day, 5);
    final start = now.hour < 5 ? dayStart.subtract(const Duration(days: 1)) : dayStart;

    final newOrders = _orders.where((o) => o.isNew).toList();
    final current = _orders.where((o) => o.isCurrent).toList();
    final todayOrders = _orders.where((o) {
      final c = o.createdAt, d = o.deliveredAt;
      return (c != null && c.isAfter(start)) || (d != null && d.isAfter(start));
    }).toList();

    return RefreshIndicator(
      onRefresh: () => _refresh(),
      child: ListView(
        padding: const EdgeInsets.only(bottom: 20),
        children: [
          _header(),
          Padding(
            padding: const EdgeInsets.all(12),
            child: log
                ? _section('سجل اليوم', todayOrders, 'لا توجد طلبات اليوم')
                : Column(children: [
                    _section('الطلبات الجديدة', newOrders, 'لا توجد طلبات جديدة'),
                    const SizedBox(height: 8),
                    _section('الطلبات الحالية', current, 'لا توجد طلبات قيد التنفيذ'),
                  ]),
          ),
        ],
      ),
    );
  }

  Widget _section(String title, List<Order> list, String empty) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 8),
          child: Row(children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 2),
              decoration: BoxDecoration(color: XColors.violet.withValues(alpha: 0.2), borderRadius: BorderRadius.circular(20)),
              child: Text('${list.length}', style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white)),
            ),
            const SizedBox(width: 8),
            Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          ]),
        ),
        if (list.isEmpty)
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Text(empty, style: TextStyle(color: Colors.white.withValues(alpha: 0.5))),
          )
        else
          ...list.map((o) => OrderCard(
                order: o,
                onAccept: () => _accept(o),
                onReject: () => _reason(o, o.isNew ? 'رفض الطلب' : 'إرجاع الطلب',
                    (r) => o.isNew ? Api.instance.rejectOrder(o.id, r) : Api.instance.rejectOrder(o.id, r)),
                onDeliver: () => _deliver(o),
                onPostpone: () => _reason(o, 'تأجيل الطلب', (r) => Api.instance.postponeOrder(o.id, r)),
              )),
      ],
    );
  }

  // ── تبويب الخريطة ──
  Widget _mapTab() {
    final center = _me ?? const LatLng(33.3152, 44.3661);
    return FlutterMap(
      options: MapOptions(initialCenter: center, initialZoom: 15),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.joniah.pharmacy.delivery',
        ),
        if (_me != null)
          MarkerLayer(markers: [
            Marker(
              point: _me!, width: 26, height: 26,
              child: Container(
                decoration: BoxDecoration(
                  color: XColors.violet, shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 3),
                ),
              ),
            ),
          ]),
      ],
    );
  }

  Widget _bottomNav() => NavigationBar(
        selectedIndex: _tab,
        onDestinationSelected: (i) => setState(() => _tab = i),
        backgroundColor: XColors.cardDark,
        indicatorColor: XColors.violet.withValues(alpha: 0.35),
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home_outlined), selectedIcon: Icon(Icons.home), label: 'الرئيسية'),
          NavigationDestination(icon: Icon(Icons.history), selectedIcon: Icon(Icons.history), label: 'السجل'),
          NavigationDestination(icon: Icon(Icons.map_outlined), selectedIcon: Icon(Icons.map), label: 'الخريطة'),
          NavigationDestination(icon: Icon(Icons.person_outline), selectedIcon: Icon(Icons.person), label: 'حسابي'),
        ],
      );
}
