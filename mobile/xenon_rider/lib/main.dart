import 'package:flutter/material.dart';
import 'api.dart';
import 'theme.dart';
import 'location_service.dart';
import 'screens/login_screen.dart';
import 'screens/home_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Api.instance.loadToken();
  await LocationService.initialize();
  runApp(const XenonRiderApp());
}

class XenonRiderApp extends StatelessWidget {
  const XenonRiderApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Xenon مندوب',
      debugShowCheckedModeBanner: false,
      theme: buildXenonTheme(),
      locale: const Locale('ar'),
      builder: (context, child) => Directionality(
        textDirection: TextDirection.rtl,
        child: child ?? const SizedBox.shrink(),
      ),
      home: Api.instance.token == null ? const LoginScreen() : const HomeScreen(),
    );
  }
}
