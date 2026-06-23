import 'package:hive_flutter/hive_flutter.dart';
import 'app_config.dart';

class SettingsRepository {
  static const String boxName = 'settingsData';
  static const String keyServerUrl = 'serverUrl';
  static const String keyIsLocalMode = 'isLocalMode';
  static const String keyLocalFolderPath = 'localFolderPath';

  final Box _box;

  SettingsRepository() : _box = Hive.box(boxName);

  String get serverUrl => _box.get(keyServerUrl, defaultValue: AppConfig.apiUrl);
  
  Future<void> setServerUrl(String url) async {
    await _box.put(keyServerUrl, url);
  }

  bool get isLocalMode => _box.get(keyIsLocalMode, defaultValue: false);

  Future<void> setLocalMode(bool isLocal) async {
    await _box.put(keyIsLocalMode, isLocal);
  }

  String? get localFolderPath => _box.get(keyLocalFolderPath);

  Future<void> setLocalFolderPath(String path) async {
    await _box.put(keyLocalFolderPath, path);
  }
}
