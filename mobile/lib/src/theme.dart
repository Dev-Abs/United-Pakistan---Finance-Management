import 'package:flex_color_scheme/flex_color_scheme.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class AppColors {
  static const emerald = Color(0xFF08705B);
  static const emeraldDark = Color(0xFF06483D);
  static const mint = Color(0xFFB9F3DC);
  static const gold = Color(0xFFE5A11A);
  static const background = Color(0xFFF6F8F6);
  static const surface = Colors.white;
  static const ink = Color(0xFF14201D);
  static const slate = Color(0xFF66756F);
  static const border = Color(0xFFDDE6E1);
  static const success = Color(0xFF15803D);
  static const warning = Color(0xFFE09A13);
  static const error = Color(0xFFD64242);
  static const info = Color(0xFF1685A8);
}

abstract final class AppSpace {
  static const xs = 4.0;
  static const sm = 8.0;
  static const md = 12.0;
  static const lg = 16.0;
  static const xl = 24.0;
  static const xxl = 32.0;
  static const xxxl = 48.0;
}

abstract final class AppRadius {
  static const sm = 10.0;
  static const md = 14.0;
  static const lg = 20.0;
  static const xl = 28.0;
}

ThemeData buildTheme({
  required Brightness brightness,
  ColorScheme? dynamicScheme,
}) {
  final isDark = brightness == Brightness.dark;
  final fallback = ColorScheme.fromSeed(
    seedColor: AppColors.emerald,
    brightness: brightness,
    primary: AppColors.emerald,
    secondary: AppColors.gold,
  );
  final scheme = (dynamicScheme ?? fallback).copyWith(
    primary: isDark ? const Color(0xFF71D9BB) : AppColors.emerald,
    secondary: isDark ? const Color(0xFFFFCB70) : AppColors.gold,
    error: isDark ? const Color(0xFFFFB4AB) : AppColors.error,
  );
  final base = isDark
      ? FlexThemeData.dark(
          colorScheme: scheme,
          useMaterial3: true,
          surfaceMode: FlexSurfaceMode.highScaffoldLowSurface,
          blendLevel: 10,
          subThemesData: const FlexSubThemesData(
            interactionEffects: true,
            tintedDisabledControls: true,
            inputDecoratorRadius: 16,
            cardRadius: 20,
            bottomSheetRadius: 28,
            dialogRadius: 24,
            navigationBarSelectedLabelSchemeColor: SchemeColor.primary,
          ),
        )
      : FlexThemeData.light(
          colorScheme: scheme,
          useMaterial3: true,
          surfaceMode: FlexSurfaceMode.highScaffoldLowSurface,
          blendLevel: 2,
          subThemesData: const FlexSubThemesData(
            interactionEffects: true,
            tintedDisabledControls: true,
            inputDecoratorRadius: 16,
            cardRadius: 20,
            bottomSheetRadius: 28,
            dialogRadius: 24,
            navigationBarSelectedLabelSchemeColor: SchemeColor.primary,
          ),
        );

  final textTheme = GoogleFonts.manropeTextTheme(base.textTheme).copyWith(
    displaySmall: GoogleFonts.manrope(
      fontSize: 34,
      height: 1.08,
      fontWeight: FontWeight.w800,
      letterSpacing: -1,
    ),
    headlineMedium: GoogleFonts.manrope(
      fontSize: 28,
      height: 1.15,
      fontWeight: FontWeight.w800,
      letterSpacing: -.6,
    ),
    titleLarge: GoogleFonts.manrope(
      fontSize: 20,
      fontWeight: FontWeight.w800,
      letterSpacing: -.25,
    ),
    titleMedium: GoogleFonts.manrope(
      fontSize: 16,
      fontWeight: FontWeight.w700,
    ),
    bodyLarge: GoogleFonts.manrope(fontSize: 16, height: 1.5),
    bodyMedium: GoogleFonts.manrope(fontSize: 14, height: 1.45),
    labelLarge: GoogleFonts.manrope(fontWeight: FontWeight.w700),
  );
  return base.copyWith(
    textTheme: textTheme,
    scaffoldBackgroundColor:
        isDark ? const Color(0xFF101614) : AppColors.background,
    appBarTheme: AppBarTheme(
      centerTitle: false,
      elevation: 0,
      scrolledUnderElevation: 1,
      backgroundColor: Colors.transparent,
      titleTextStyle: textTheme.titleLarge?.copyWith(
        color: scheme.onSurface,
      ),
    ),
    cardTheme: base.cardTheme.copyWith(
      elevation: 0,
      margin: EdgeInsets.zero,
      clipBehavior: Clip.antiAlias,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        side: BorderSide(color: scheme.outlineVariant.withValues(alpha: .7)),
      ),
    ),
    inputDecorationTheme: base.inputDecorationTheme.copyWith(
      filled: true,
      fillColor: scheme.surfaceContainerLowest,
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
        borderSide: BorderSide(color: scheme.outlineVariant),
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        minimumSize: const Size(48, 52),
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        textStyle: textTheme.labelLarge,
      ),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        textStyle: textTheme.labelLarge,
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size(48, 52),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
        textStyle: textTheme.labelLarge,
      ),
    ),
    navigationBarTheme: base.navigationBarTheme.copyWith(
      height: 72,
      elevation: 0,
      labelTextStyle: WidgetStateProperty.resolveWith((states) =>
          textTheme.labelSmall?.copyWith(
              fontWeight: states.contains(WidgetState.selected)
                  ? FontWeight.w800
                  : FontWeight.w600)),
    ),
    snackBarTheme: SnackBarThemeData(
      behavior: SnackBarBehavior.floating,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
    ),
    dividerTheme: DividerThemeData(color: scheme.outlineVariant, space: 1),
    pageTransitionsTheme: const PageTransitionsTheme(
      builders: {
        TargetPlatform.android: PredictiveBackPageTransitionsBuilder(),
        TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
      },
    ),
  );
}
