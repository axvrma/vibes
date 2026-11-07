import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:hive_flutter/hive_flutter.dart';
import 'core/config/settings_repository.dart';
import 'core/config/brand_tokens.dart';
import 'features/auth/data/auth_repository.dart';
import 'features/auth/presentation/login_screen.dart';
import 'features/auth/presentation/welcome_screen.dart';
import 'features/auth/presentation/mode_selection_screen.dart';
import 'features/reels/presentation/video_feed_screen.dart';
import 'package:media_kit/media_kit.dart';
import 'core/services/audio_handler.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  MediaKit.ensureInitialized();
  if (!kIsWeb) {
    await initAudioService();
  }
  await Hive.initFlutter();
  await Hive.openBox('videoData');
  await Hive.openBox('settingsData');

  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF151016),
    ),
  );

  runApp(const VibesApp());
}

class VibesApp extends StatelessWidget {
  const VibesApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder(
      valueListenable: Hive.box(
        'settingsData',
      ).listenable(keys: [SettingsRepository.keyIsDarkMode]),
      builder: (context, box, child) {
        final isDarkMode = box.get(
          SettingsRepository.keyIsDarkMode,
          defaultValue: true,
        );
        return MaterialApp(
          title: 'Vibes',
          debugShowCheckedModeBanner: false,
          themeMode: isDarkMode ? ThemeMode.dark : ThemeMode.light,
          theme: _theme(Brightness.light),
          darkTheme: _theme(Brightness.dark),
          home: const InitialRouteWidget(),
        );
      },
    );
  }
}

ThemeData _theme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final scheme = ColorScheme.fromSeed(
    seedColor: dark ? VibesTokens.darkPrimary : VibesTokens.lightPrimary,
    brightness: brightness,
    surface: dark ? VibesTokens.darkSurface : VibesTokens.lightSurface,
  );
  return ThemeData(
    useMaterial3: true,
    brightness: brightness,
    colorScheme: scheme.copyWith(
      onPrimary: dark ? VibesTokens.lightText : Colors.white,
      primary: dark ? VibesTokens.darkPrimary : VibesTokens.lightPrimary,
    ),
    fontFamily: 'Inter',
    scaffoldBackgroundColor: dark
        ? VibesTokens.darkBackground
        : VibesTokens.lightBackground,
    visualDensity: VisualDensity.standard,
    inputDecorationTheme: const InputDecorationTheme(
      border: OutlineInputBorder(),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(minimumSize: const Size(48, 48)),
    ),
  );
}

class InitialRouteWidget extends StatefulWidget {
  const InitialRouteWidget({super.key});

  @override
  State<InitialRouteWidget> createState() => _InitialRouteWidgetState();
}

class _InitialRouteWidgetState extends State<InitialRouteWidget> {
  final _settings = SettingsRepository();
  final _authRepo = AuthRepository();

  @override
  Widget build(BuildContext context) {
    if (!_settings.hasSeenWelcome) {
      return const WelcomeScreen();
    }

    if (!_settings.hasSelectedMode) {
      return const ModeSelectionScreen();
    }

    if (_settings.isLocalMode) {
      return const VideoFeedScreen();
    }

    return FutureBuilder<bool>(
      future: _authRepo.isLoggedIn(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const Scaffold(
            body: Center(child: CircularProgressIndicator()),
          );
        }
        if (snapshot.hasData && snapshot.data == true) {
          return const VideoFeedScreen();
        }
        return const LoginScreen();
      },
    );
  }
}
