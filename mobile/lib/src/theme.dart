import 'package:flex_color_scheme/flex_color_scheme.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

abstract final class AppColors {
  static const emerald = Color(0xFF087F67);
  static const emeraldDark = Color(0xFF034B46);
  static const teal = Color(0xFF04B99B);
  static const cyan = Color(0xFF168FC7);
  static const indigo = Color(0xFF3146B8);
  static const navy = Color(0xFF061C2D);
  static const mint = Color(0xFFD9FFF2);
  static const gold = Color(0xFFFFC857);
  static const background = Color(0xFFF2F8F7);
  static const surface = Colors.white;
  static const ink = Color(0xFF082B32);
  static const slate = Color(0xFF577078);
  static const border = Color(0xFFCFE3E0);
  static const success = Color(0xFF15803D);
  static const warning = Color(0xFFE09A13);
  static const error = Color(0xFFBA1A1A);
  static const info = Color(0xFF1685A8);

  // Compatibility aliases retained for older widgets.
  static const blood = emerald;
  static const bloodDark = emeraldDark;
  static const crimson = teal;
  static const rose = mint;
}

abstract final class AppGradients {
  static const brand = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.emeraldDark, AppColors.emerald, AppColors.teal],
  );
  static const accent = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.teal, AppColors.cyan, AppColors.indigo],
  );
  static const night = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.navy, Color(0xFF063B49), AppColors.emeraldDark],
  );
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
    primary: isDark ? const Color(0xFF5FF2CC) : AppColors.emerald,
    onPrimary: isDark ? AppColors.navy : Colors.white,
    primaryContainer: isDark ? const Color(0xFF07594F) : AppColors.mint,
    onPrimaryContainer: isDark ? AppColors.mint : AppColors.emeraldDark,
    secondary: isDark ? const Color(0xFFFFCB70) : AppColors.gold,
    error: isDark ? const Color(0xFFFFB4AB) : AppColors.error,
    surface: isDark ? const Color(0xFF092733) : Colors.white,
    onSurface: isDark ? const Color(0xFFE9FFFA) : AppColors.ink,
    onSurfaceVariant: isDark ? const Color(0xFFAACCC7) : AppColors.slate,
    outlineVariant: isDark ? const Color(0xFF28505A) : AppColors.border,
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
    scaffoldBackgroundColor: Colors.transparent,
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
    iconTheme: IconThemeData(color: scheme.onSurfaceVariant),
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
      backgroundColor: scheme.surface,
      indicatorColor: scheme.primaryContainer,
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

class BrandMark extends StatelessWidget {
  const BrandMark({super.key, this.size = 42, this.inverse = false});
  final double size;
  final bool inverse;

  @override
  Widget build(BuildContext context) => Container(
        width: size,
        height: size,
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: inverse
                ? [Colors.white.withValues(alpha: .22), Colors.white10]
                : [AppColors.teal, AppColors.emeraldDark],
          ),
          borderRadius: BorderRadius.circular(size * .31),
          boxShadow: inverse
              ? null
              : [
                  BoxShadow(
                    color: AppColors.emerald.withValues(alpha: .22),
                    blurRadius: 18,
                    offset: const Offset(0, 7),
                  )
                ],
        ),
        child: Icon(Icons.front_hand_rounded,
            color: Colors.white, size: size * .52),
      );
}

class BrandGradient extends StatelessWidget {
  const BrandGradient({super.key, required this.child, this.padding});
  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding ?? const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: AppGradients.brand,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: AppColors.emerald.withValues(alpha: .24),
              blurRadius: 26,
              offset: const Offset(0, 12),
            )
          ],
        ),
        child: DefaultTextStyle.merge(
          style: const TextStyle(color: Colors.white),
          child: IconTheme.merge(
              data: const IconThemeData(color: Colors.white), child: child),
        ),
      );
}

class GradientCanvas extends StatelessWidget {
  const GradientCanvas({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final dark = Theme.of(context).brightness == Brightness.dark;
    return DecoratedBox(
      decoration: BoxDecoration(
        gradient: dark
            ? AppGradients.night
            : const LinearGradient(
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
                colors: [
                  Color(0xFFE8FFF8),
                  Color(0xFFF5FAFF),
                  Color(0xFFEEF0FF)
                ],
              ),
      ),
      child: Stack(fit: StackFit.expand, children: [
        Positioned(
          right: -90,
          top: -80,
          child: IgnorePointer(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  AppColors.teal.withValues(alpha: dark ? .22 : .18),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
        ),
        child,
      ]),
    );
  }
}

class GradientPanel extends StatelessWidget {
  const GradientPanel({super.key, required this.child, this.padding});
  final Widget child;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) => Container(
        padding: padding ?? const EdgeInsets.all(AppSpace.lg),
        decoration: BoxDecoration(
          gradient: AppGradients.accent,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: [
            BoxShadow(
              color: AppColors.cyan.withValues(alpha: .22),
              blurRadius: 28,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: DefaultTextStyle.merge(
          style: const TextStyle(color: Colors.white),
          child: IconTheme.merge(
            data: const IconThemeData(color: Colors.white),
            child: child,
          ),
        ),
      );
}
