import 'package:flutter/material.dart';

/// هوية Xenon البصرية
class XColors {
  static const violet = Color(0xFF7C3AED);
  static const fuchsia = Color(0xFFD946EF);
  static const amber = Color(0xFFF59E0B);
  static const bgDark = Color(0xFF120B26);
  static const cardDark = Color(0xFF170F2E);
  static const surfaceDark = Color(0xFF1C1136);
}

ThemeData buildXenonTheme() {
  const seed = XColors.violet;
  final scheme = ColorScheme.fromSeed(
    seedColor: seed,
    brightness: Brightness.dark,
    primary: XColors.violet,
    secondary: XColors.fuchsia,
    surface: XColors.cardDark,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    colorScheme: scheme,
    scaffoldBackgroundColor: XColors.bgDark,
    fontFamily: 'Roboto',
    appBarTheme: const AppBarTheme(
      backgroundColor: XColors.cardDark,
      foregroundColor: Colors.white,
      elevation: 0,
      centerTitle: false,
    ),
    cardTheme: CardThemeData(
      color: XColors.cardDark,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: XColors.violet,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 18),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        textStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: XColors.surfaceDark,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide.none,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    ),
    snackBarTheme: const SnackBarThemeData(behavior: SnackBarBehavior.floating),
  );
}

/// تدرّج Xenon المميّز (بنفسجي → أرجواني)
const xenonGradient = LinearGradient(
  colors: [XColors.violet, XColors.fuchsia],
  begin: Alignment.centerRight,
  end: Alignment.centerLeft,
);
