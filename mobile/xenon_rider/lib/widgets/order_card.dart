import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models.dart';
import '../theme.dart';
import '../screens/order_map_screen.dart';

class OrderCard extends StatelessWidget {
  final Order order;
  final VoidCallback onAccept;
  final VoidCallback onReject;
  final VoidCallback onDeliver;
  final VoidCallback onPostpone;
  const OrderCard({
    super.key,
    required this.order,
    required this.onAccept,
    required this.onReject,
    required this.onDeliver,
    required this.onPostpone,
  });

  Color get _statusColor {
    switch (order.status) {
      case 'pending_approval': return Colors.blueAccent;
      case 'pending': return XColors.amber;
      case 'delivered': return Colors.green;
      case 'returned': return Colors.redAccent;
      case 'cancelled': return Colors.grey;
      default: return XColors.violet;
    }
  }

  Future<void> _dial(String? phone) async {
    if (phone == null || phone.isEmpty) return;
    final uri = Uri.parse('tel:$phone');
    if (await canLaunchUrl(uri)) launchUrl(uri);
  }

  Future<void> _openMaps() async {
    final url = order.locationUrl;
    if (url == null) return;
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 14),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // العنوان + الحالة + السعر
            Row(
              children: [
                Expanded(
                  child: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8, runSpacing: 6,
                    children: [
                      Text('طلب #${order.id}',
                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 3),
                        decoration: BoxDecoration(
                          color: _statusColor.withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(order.statusLabel,
                            style: TextStyle(color: _statusColor, fontSize: 12, fontWeight: FontWeight.bold)),
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text('${order.net} د.ع',
                        style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: XColors.fuchsia)),
                    if (order.discount > 0)
                      Text('خصم ${order.discount}',
                          style: const TextStyle(fontSize: 11, color: Colors.greenAccent)),
                  ],
                ),
              ],
            ),
            const SizedBox(height: 12),
            if (order.customerName != null)
              _infoRow(Icons.person_outline, order.customerName!),
            if (order.regionName != null)
              _infoRow(Icons.location_on_outlined, '${order.regionName}${order.provinceName != null ? ' - ${order.provinceName}' : ''}'),
            if (order.address != null) _infoRow(Icons.home_outlined, order.address!),
            if (order.note != null && order.note!.isNotEmpty)
              Container(
                margin: const EdgeInsets.only(top: 8),
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: XColors.amber.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Row(children: [
                  const Icon(Icons.sticky_note_2_outlined, size: 16, color: XColors.amber),
                  const SizedBox(width: 6),
                  Expanded(child: Text(order.note!, style: const TextStyle(fontSize: 13))),
                ]),
              ),

            const SizedBox(height: 12),
            // أدوات: اتصال، موقع، معاينة الخريطة
            Wrap(
              spacing: 8, runSpacing: 8,
              children: [
                if (order.customerPhone != null)
                  _chip(Icons.phone, 'اتصال', () => _dial(order.customerPhone)),
                if (order.locationUrl != null)
                  _chip(Icons.map_outlined, 'الموقع', _openMaps),
                _chip(Icons.my_location, 'معاينة الموقع', () {
                  Navigator.of(context).push(MaterialPageRoute(
                    builder: (_) => OrderMapScreen(order: order),
                  ));
                }),
              ],
            ),

            const Divider(height: 24),
            // الإجراءات حسب الحالة
            if (order.isNew)
              Row(children: [
                Expanded(child: _action('قبول', Icons.check, XColors.violet, onAccept)),
                const SizedBox(width: 10),
                Expanded(child: _action('رفض', Icons.close, Colors.redAccent, onReject, outline: true)),
              ])
            else if (order.isCurrent)
              Column(children: [
                SizedBox(
                  width: double.infinity,
                  child: _action('تم التسليم', Icons.check_circle, Colors.green, onDeliver),
                ),
                const SizedBox(height: 8),
                Row(children: [
                  Expanded(child: _action('تأجيل', Icons.schedule, XColors.amber, onPostpone, outline: true)),
                  const SizedBox(width: 10),
                  Expanded(child: _action('إرجاع', Icons.undo, Colors.redAccent, onReject, outline: true)),
                ]),
              ])
            else
              Align(
                alignment: Alignment.centerRight,
                child: Text(order.statusLabel, style: TextStyle(color: _statusColor, fontWeight: FontWeight.bold)),
              ),
          ],
        ),
      ),
    );
  }

  Widget _infoRow(IconData icon, String text) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 3),
        child: Row(children: [
          Icon(icon, size: 16, color: Colors.white54),
          const SizedBox(width: 8),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 13.5))),
        ]),
      );

  Widget _chip(IconData icon, String label, VoidCallback onTap) => ActionChip(
        avatar: Icon(icon, size: 16, color: XColors.violet),
        label: Text(label, style: const TextStyle(fontSize: 12.5)),
        backgroundColor: XColors.surfaceDark,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(20),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.08)),
        ),
        onPressed: onTap,
      );

  Widget _action(String label, IconData icon, Color color, VoidCallback onTap, {bool outline = false}) {
    return ElevatedButton.icon(
      style: ElevatedButton.styleFrom(
        backgroundColor: outline ? Colors.transparent : color,
        foregroundColor: outline ? color : Colors.white,
        side: outline ? BorderSide(color: color) : null,
        elevation: 0,
      ),
      icon: Icon(icon, size: 18),
      label: Text(label),
      onPressed: onTap,
    );
  }
}
