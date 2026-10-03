import 'package:flutter/material.dart';
import '../api.dart';
import '../theme.dart';

class ProfileScreen extends StatelessWidget {
  final Map<String, dynamic> user;
  final Future<void> Function() onLogout;
  const ProfileScreen({super.key, required this.user, required this.onLogout});

  @override
  Widget build(BuildContext context) {
    final name = user['name']?.toString() ?? 'مندوب';
    final phone = user['phone']?.toString() ?? '—';
    final username = user['username']?.toString() ?? '';
    final img = user['profileImage']?.toString();

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        const SizedBox(height: 8),
        Center(
          child: Column(children: [
            Container(
              padding: const EdgeInsets.all(3),
              decoration: const BoxDecoration(gradient: xenonGradient, shape: BoxShape.circle),
              child: CircleAvatar(
                radius: 48,
                backgroundColor: XColors.surfaceDark,
                backgroundImage: (img != null && img.isNotEmpty) ? NetworkImage(img) : null,
                child: (img == null || img.isEmpty)
                    ? const Icon(Icons.person, size: 48, color: Colors.white70)
                    : null,
              ),
            ),
            const SizedBox(height: 12),
            Text(name, style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            Text('@$username', style: TextStyle(color: Colors.white.withValues(alpha: 0.5))),
          ]),
        ),
        const SizedBox(height: 24),
        Card(
          child: Column(children: [
            _tile(Icons.phone_outlined, 'رقم الهاتف', phone),
            const Divider(height: 1),
            _tile(Icons.badge_outlined, 'اسم المستخدم', username),
          ]),
        ),
        const SizedBox(height: 12),
        Card(
          child: ListTile(
            leading: const Icon(Icons.lock_outline, color: XColors.violet),
            title: const Text('تغيير كلمة المرور'),
            trailing: const Icon(Icons.chevron_left),
            onTap: () => _changePassword(context),
          ),
        ),
        const SizedBox(height: 24),
        SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            icon: const Icon(Icons.logout),
            label: const Text('تسجيل الخروج'),
            onPressed: () async {
              final ok = await showDialog<bool>(
                context: context,
                builder: (c) => AlertDialog(
                  title: const Text('تسجيل الخروج'),
                  content: const Text('هل تريد تسجيل الخروج؟ سيتوقّف تتبّع الموقع.'),
                  actions: [
                    TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
                    ElevatedButton(
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
                      onPressed: () => Navigator.pop(c, true),
                      child: const Text('خروج'),
                    ),
                  ],
                ),
              );
              if (ok == true) await onLogout();
            },
          ),
        ),
        const SizedBox(height: 20),
        Center(
          child: Text('Xenon — تطبيق المندوب • v1.0',
              style: TextStyle(color: Colors.white.withValues(alpha: 0.35), fontSize: 12)),
        ),
      ],
    );
  }

  Widget _tile(IconData icon, String label, String value) => ListTile(
        leading: Icon(icon, color: Colors.white54),
        title: Text(label, style: const TextStyle(fontSize: 13, color: Colors.white54)),
        subtitle: Text(value, textDirection: TextDirection.ltr,
            style: const TextStyle(fontSize: 16, color: Colors.white)),
      );

  Future<void> _changePassword(BuildContext context) async {
    final oldC = TextEditingController();
    final newC = TextEditingController();
    final messenger = ScaffoldMessenger.of(context);
    final done = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('تغيير كلمة المرور'),
        content: Column(mainAxisSize: MainAxisSize.min, children: [
          TextField(controller: oldC, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور الحالية')),
          const SizedBox(height: 10),
          TextField(controller: newC, obscureText: true, decoration: const InputDecoration(labelText: 'كلمة المرور الجديدة')),
        ]),
        actions: [
          TextButton(onPressed: () => Navigator.pop(c, false), child: const Text('إلغاء')),
          ElevatedButton(onPressed: () => Navigator.pop(c, true), child: const Text('حفظ')),
        ],
      ),
    );
    if (done != true) return;
    try {
      await Api.instance.changePassword(oldC.text, newC.text);
      messenger.showSnackBar(const SnackBar(content: Text('تم تغيير كلمة المرور')));
    } catch (e) {
      messenger.showSnackBar(SnackBar(content: Text(e.toString())));
    }
  }
}
