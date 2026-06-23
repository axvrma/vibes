import 'dart:io';
import 'package:dio/dio.dart';
import '../../../core/config/settings_repository.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/video_item.dart';
import '../domain/video_repository.dart';
import 'video_cache_manager.dart';

class ServerVideoRepository implements VideoRepository {
  final Dio _dio;
  final VideoCacheManager _cacheManager;
  final AuthRepository _authRepo;

  ServerVideoRepository({Dio? dio, VideoCacheManager? cacheManager, AuthRepository? authRepo})
      : _dio = dio ?? Dio(),
        _cacheManager = cacheManager ?? VideoCacheManager(),
        _authRepo = authRepo ?? AuthRepository() {
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authRepo.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        return handler.next(options);
      },
      onError: (DioException e, handler) async {
        if (e.response?.statusCode == 401 && !e.requestOptions.path.contains('/auth/')) {
          // Attempt refresh
          try {
            final newToken = await _authRepo.refresh();
            if (newToken != null) {
              e.requestOptions.headers['Authorization'] = 'Bearer $newToken';
              final cloneReq = await _dio.fetch(e.requestOptions);
              return handler.resolve(cloneReq);
            }
          } catch (_) {}
          await _authRepo.logout();
        }
        return handler.next(e);
      },
    ));
  }

  @override
  Future<List<VideoItem>> getVideos() async {
    final settings = SettingsRepository();
    final apiUrl = settings.serverUrl;
    final baseUrl = apiUrl.replaceAll('/api', '');

    final response = await _dio.get('$apiUrl/videos');
    final List videosJson = response.data['videos'];
    return videosJson.map((json) => VideoItem.fromJson(json, baseUrl)).toList();
  }

  @override
  Future<VideoItem> getVideo(String id) async {
    throw UnimplementedError('Not needed in v1');
  }

  @override
  Future<File?> getCachedVideo(String videoId) {
    return _cacheManager.getCachedVideo(videoId);
  }

  @override
  Future<File> downloadVideo(VideoItem video, {Function(int, int)? onReceiveProgress}) {
    return _cacheManager.downloadVideo(video, onReceiveProgress: onReceiveProgress);
  }

  @override
  Future<void> deleteCachedVideo(String videoId) {
    return _cacheManager.deleteCachedVideo(videoId);
  }
  
  Future<void> cleanStaleFiles() {
    return _cacheManager.cleanStalePartFiles();
  }

  @override
  Future<void> likeVideo(String videoId) async {
    final settings = SettingsRepository();
    final apiUrl = settings.serverUrl;
    await _dio.put('$apiUrl/videos/$videoId/state', data: {'liked': true});
  }

  @override
  Future<void> unlikeVideo(String videoId) async {
    final settings = SettingsRepository();
    final apiUrl = settings.serverUrl;
    await _dio.put('$apiUrl/videos/$videoId/state', data: {'liked': false});
  }

  @override
  Future<void> saveNote(String videoId, String text) async {
    final settings = SettingsRepository();
    final apiUrl = settings.serverUrl;
    await _dio.put('$apiUrl/videos/$videoId/state', data: {'note': text});
  }

  @override
  Future<void> saveProgress(String videoId, double progress) async {
    final settings = SettingsRepository();
    final apiUrl = settings.serverUrl;
    await _dio.put('$apiUrl/videos/$videoId/state', data: {'progress_seconds': progress});
  }
}
