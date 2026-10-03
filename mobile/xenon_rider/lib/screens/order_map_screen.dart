import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:geolocator/geolocator.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models.dart';
import '../theme.dart';

class OrderMapScreen extends StatefulWidget {
  final Order order;
  const OrderMapScreen({super.key, required this.order});
  @override
  State<OrderMapScreen> createState() => _OrderMapScreenState();
}

class _OrderMapScreenState extends State<OrderMapScreen> {
  final _map = MapController();
  LatLng? _me;
  StreamSubscription<Position>? _sub;

  LatLng? get _customer => widget.order.customerLatLng;

  @override
  void initState() {
    super.initState();
    _startMe();
  }

  Future<void> _startMe() async {
    try {
      final perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) await Geolocator.requestPermission();
      _sub = Geolocator.getPositionStream(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, distanceFilter: 8),
      ).listen((p) {
        setState(() => _me = LatLng(p.latitude, p.longitude));
        _fit();
      });
    } catch (_) {}
  }

  void _fit() {
    final pts = [if (_me != null) _me!, if (_customer != null) _customer!];
    if (pts.length == 2) {
      _map.fitCamera(CameraFit.bounds(
        bounds: LatLngBounds.fromPoints(pts),
        padding: const EdgeInsets.all(60),
      ));
    } else if (pts.length == 1) {
      _map.move(pts.first, 15);
    }
  }

  double? get _distanceKm => (_me != null && _customer != null)
      ? const Distance().as(LengthUnit.Kilometer, _me!, _customer!)
      : null;

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final center = _customer ?? _me ?? const LatLng(33.3152, 44.3661);
    return Scaffold(
      appBar: AppBar(title: Text('موقع الطلب #${widget.order.id}')),
      body: Column(
        children: [
          Expanded(
            child: FlutterMap(
              mapController: _map,
              options: MapOptions(initialCenter: center, initialZoom: 14),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.joniah.pharmacy.delivery',
                ),
                if (_me != null && _customer != null)
                  PolylineLayer(polylines: [
                    Polyline(points: [_me!, _customer!], strokeWidth: 3, color: XColors.fuchsia),
                  ]),
                MarkerLayer(markers: [
                  if (_customer != null)
                    Marker(
                      point: _customer!, width: 44, height: 44,
                      child: const Icon(Icons.location_on, color: XColors.fuchsia, size: 44),
                    ),
                  if (_me != null)
                    Marker(
                      point: _me!, width: 24, height: 24,
                      child: Container(
                        decoration: BoxDecoration(
                          color: XColors.violet, shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 3),
                        ),
                      ),
                    ),
                ]),
              ],
            ),
          ),
          Container(
            color: XColors.cardDark,
            padding: const EdgeInsets.all(16),
            child: SafeArea(
              top: false,
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      _legend(XColors.violet, 'موقعك', _me != null),
                      _legend(XColors.fuchsia, 'موقع الزبون', _customer != null),
                      if (_distanceKm != null)
                        Text('المسافة ≈ ${_distanceKm!.toStringAsFixed(1)} كم',
                            style: const TextStyle(fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (_customer != null)
                    SizedBox(
                      width: double.infinity,
                      child: ElevatedButton.icon(
                        icon: const Icon(Icons.navigation),
                        label: const Text('المسار إلى الزبون'),
                        onPressed: () {
                          final c = _customer!;
                          launchUrl(
                            Uri.parse('https://www.google.com/maps/dir/?api=1&destination=${c.latitude},${c.longitude}'),
                            mode: LaunchMode.externalApplication,
                          );
                        },
                      ),
                    )
                  else
                    const Text('لا يوجد موقع محفوظ للزبون لهذا الطلب',
                        style: TextStyle(color: Colors.amberAccent, fontSize: 13)),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _legend(Color c, String label, bool on) => Row(children: [
        Icon(Icons.circle, size: 12, color: on ? c : Colors.white24),
        const SizedBox(width: 5),
        Text(label, style: TextStyle(fontSize: 13, color: on ? Colors.white : Colors.white38)),
      ]);
}
