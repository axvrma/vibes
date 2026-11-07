import 'dart:io';
import 'package:dio/dio.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../../core/config/settings_repository.dart';
import '../../auth/data/auth_repository.dart';
import '../domain/video_item.dart';
import '../domain/video_repository.dart';
import 'video_cache_manager.dart';

class ServerVideoRepository implements VideoRepository {
  final Dio _dio;
  final VideoCacheManager _cacheManager;
  final AuthRepository _authRepo;
  int _page = 1;
  bool hasMore = false;
  bool isOffline = false;

  ServerVideoRepository({
    Dio? dio,
    VideoCacheManager? cacheManager,
    AuthRepository? authRepo,
  }) : _dio =
           dio ??
           Dio(
             BaseOptions(
               connectTimeout: const Duration(seconds: 10),
               receiveTimeout: const Duration(seconds: 20),
             ),
           ),
       _cacheManager = cacheManager ?? VideoCacheManager(),
       _authRepo = authRepo ?? AuthRepository() {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _authRepo.getAccessToken();
          if (token != null) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          return handler.next(options);
        },
        onError: (DioException e, handler) async {
          if (e.response?.statusCode == 401 &&
              e.requestOptions.extra['retried'] != true &&
              !e.requestOptions.path.contains('/auth/')) {
            // Attempt refresh
            try {
              final newToken = await _authRepo.refresh();
              if (newToken != null) {
                e.requestOptions.extra['retried'] = true;
                e.requestOptions.headers['Authorization'] = 'Bearer $newToken';
                final cloneReq = await _dio.fetch(e.requestOptions);
                return handler.resolve(cloneReq);
              }
            } catch (_) {}
          }
          return handler.next(e);
        },
      ),
    );
  }

  @override
  Future<List<VideoItem>> getVideos() async {
    _page = 1;
    return getPage(page: 1);
  }

  Future<List<VideoItem>> loadMore() async {
    if (!hasMore) return [];
    final result = await getPage(page: _page + 1);
    _page++;
    return result;
  }

  Future<List<VideoItem>> getPage({
    int page = 1,
    Map<String, dynamic> filters = const {},
  }) async {
    final apiUrl = SettingsRepository().serverUrl;
    final cacheKey = 'manifest_${apiUrl}_${await _authRepo.getUserId()}';
    dynamic data;
    try {
      final response = await _dio.get(
        '$apiUrl/videos',
        queryParameters: {'page': page, 'limit': 48, ...filters},
        options: Options(receiveTimeout: const Duration(seconds: 20)),
      );
      data = response.data;
      isOffline = false;
      if (page == 1 && filters.isEmpty) {
        await Hive.box('videoData').put(cacheKey, data);
      }
    } on DioException catch (error) {
      final cached = Hive.box('videoData').get(cacheKey);
      if (page != 1 ||
          filters.isNotEmpty ||
          cached == null ||
          [401, 403].contains(error.response?.statusCode)) {
        rethrow;
      }
      data = Map<String, dynamic>.from(cached);
      isOffline = true;
    }
    hasMore = !isOffline && (data['pagination']?['hasMore'] ?? false);
    final baseUrl = Uri.base.resolve(apiUrl).origin;
    final origin = Uri.tryParse(apiUrl)?.hasAuthority == true
        ? Uri.parse(apiUrl).origin
        : baseUrl;
    return (data['videos'] as List)
        .map(
          (json) => VideoItem.fromJson(Map<String, dynamic>.from(json), origin),
        )
        .toList();
  }

  Future<Uri> mediaUri(VideoItem video, String kind) async {
    final apiUrl = SettingsRepository().serverUrl;
    final response = await _dio.post(
      '$apiUrl/videos/${video.id}/media-ticket',
      data: {'kind': kind},
    );
    return Uri.base.resolve(apiUrl).resolve(response.data['url']);
  }

  Future<Map<String, List<Map<String, dynamic>>>> libraryFilters() async {
    final base = SettingsRepository().serverUrl;
    final result = await Future.wait([
      _dio.get('$base/categories'),
      _dio.get('$base/tags'),
    ]);
    return {
      'categories': (result[0].data as List)
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
      'tags': (result[1].data as List)
          .map((e) => Map<String, dynamic>.from(e))
          .toList(),
    };
  }

  Future<Map<String, dynamic>> getState(String id) async {
    final response = await _dio.get(
      '${SettingsRepository().serverUrl}/videos/$id/state',
    );
    return Map<String, dynamic>.from(response.data);
  }

  @override
  Future<VideoItem> getVideo(String id) async {
    return (await getVideos()).firstWhere((video) => video.id == id);
  }

  @override
  Future<File?> getCachedVideo(String videoId) {
    return _cacheManager.getCachedVideo(videoId);
  }

  @override
  Future<File> downloadVideo(
    VideoItem video, {
    Function(int, int)? onReceiveProgress,
  }) {
    return _cacheManager.downloadVideo(
      video,
      dio: _dio,
      onReceiveProgress: onReceiveProgress,
    );
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
    await _dio.put(
      '$apiUrl/videos/$videoId/state',
      data: {'progress_seconds': progress},
    );
  }
}
