class AppConfig {
  // Use flutter run --dart-define=API_URL=http://your-tailscale-ip:3000/api
  static const String apiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://10.0.2.2:3000/api', // default for Android emulator
  );

  static String get baseUrl => apiUrl.replaceAll('/api', '');
}
