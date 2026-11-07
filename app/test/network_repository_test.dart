import 'dart:io';
import 'dart:convert';
import 'dart:typed_data';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:vibes/core/config/settings_repository.dart';
import 'package:vibes/features/auth/data/auth_repository.dart';
import 'package:vibes/features/reels/data/server_video_repository.dart';

class TestAuth extends AuthRepository {
  String token = 'test';
  int refreshes = 0, logouts = 0;
  @override
  Future<String?> getAccessToken() async => token;
  @override
  Future<String?> getUserId() async => 'test-user';
  @override
  Future<String?> refresh() async {
    refreshes++;
    return token = 'fresh';
  }

  @override
  Future<void> logout() async {
    logouts++;
  }
}

class Transport implements HttpClientAdapter {
  final Future<ResponseBody> Function(RequestOptions) respond;
  final requests = <RequestOptions>[];
  Transport(this.respond);
  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? stream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return respond(options);
  }

  @override
  void close({bool force = false}) {}
}

ResponseBody page({bool more = false}) => ResponseBody.fromString(
  jsonEncode({
    'videos': [
      {
        'id': 'v',
        'title': 'Video',
        'streamUrl': '/api/videos/v/stream',
        'thumbnailUrl': '/api/videos/v/thumbnail',
        'sizeBytes': 3,
        'tags': [],
        'state': {'liked': 1, 'note': 'Remember', 'progress_seconds': 2},
      },
    ],
    'pagination': {
      'hasMore': more,
      'total': more ? 49 : 1,
      'page': 1,
      'limit': 48,
    },
  }),
  200,
  headers: {
    Headers.contentTypeHeader: ['application/json'],
  },
);
void main() {
  late Directory temp;
  late TestAuth auth;
  setUp(() async {
    temp = await Directory.systemTemp.createTemp('vibes-network');
    Hive.init(temp.path);
    await Hive.openBox('settingsData');
    await Hive.openBox('videoData');
    await SettingsRepository().setServerUrl('https://media.example.test/api');
    auth = TestAuth();
  });
  tearDown(() async {
    await Hive.close();
    await temp.delete(recursive: true);
  });
  test('uses bounded pages and preserves state from server', () async {
    final transport = Transport((_) async => page(more: true));
    final dio = Dio()..httpClientAdapter = transport;
    final repo = ServerVideoRepository(dio: dio, authRepo: auth);
    final first = await repo.getVideos();
    expect(first.first.initialState?.note, 'Remember');
    expect(first.first.initialState?.liked, isTrue);
    expect(transport.requests.first.queryParameters, containsPair('limit', 48));
    await repo.loadMore();
    expect(transport.requests.last.queryParameters, containsPair('page', 2));
    expect(transport.requests.last.headers['Authorization'], 'Bearer test');
  });
  test(
    'forwards personal search filters instead of downloading every video',
    () async {
      final transport = Transport((_) async => page());
      final repo = ServerVideoRepository(
        dio: Dio()..httpClientAdapter = transport,
        authRepo: auth,
      );
      await repo.getPage(
        filters: {
          'search': 'quiet',
          'collection': 'favorites',
          'categoryId': 'category',
        },
      );
      expect(
        transport.requests.single.queryParameters,
        containsPair('search', 'quiet'),
      );
      expect(
        transport.requests.single.queryParameters,
        containsPair('collection', 'favorites'),
      );
    },
  );
  test(
    'retries expired sessions once and uses refreshed credentials',
    () async {
      var count = 0;
      final transport = Transport(
        (_) async => ++count == 1 ? ResponseBody.fromString('{}', 401) : page(),
      );
      final repo = ServerVideoRepository(
        dio: Dio()..httpClientAdapter = transport,
        authRepo: auth,
      );
      expect((await repo.getVideos()).length, 1);
      expect(auth.refreshes, 1);
      expect(count, 2);
      expect(transport.requests.last.headers['Authorization'], 'Bearer fresh');
    },
  );
  test('shows cached metadata offline without logging the user out', () async {
    var offline = false;
    final transport = Transport((options) async {
      if (offline) {
        throw DioException.connectionError(
          requestOptions: options,
          reason: 'offline',
        );
      }
      return page();
    });
    final repo = ServerVideoRepository(
      dio: Dio()..httpClientAdapter = transport,
      authRepo: auth,
    );
    await repo.getVideos();
    offline = true;
    expect((await repo.getVideos()).first.id, 'v');
    expect(repo.isOffline, isTrue);
    expect(repo.hasMore, isFalse);
    expect(auth.logouts, 0);
  });
  test(
    'sends only the changed note field and obtains scoped browser media URLs',
    () async {
      final transport = Transport(
        (options) async => options.path.endsWith('media-ticket')
            ? ResponseBody.fromString(
                '{"url":"/api/videos/v/stream?ticket=short"}',
                200,
                headers: {
                  Headers.contentTypeHeader: ['application/json'],
                },
              )
            : ResponseBody.fromString('{}', 200),
      );
      final repo = ServerVideoRepository(
        dio: Dio()..httpClientAdapter = transport,
        authRepo: auth,
      );
      await repo.saveNote('v', 'A note');
      expect(transport.requests.first.data, {'note': 'A note'});
      final video = (await (ServerVideoRepository(
        dio: Dio()..httpClientAdapter = Transport((_) async => page()),
        authRepo: auth,
      )).getVideos()).first;
      final uri = await repo.mediaUri(video, 'stream');
      expect(uri.host, 'media.example.test');
      expect(uri.queryParameters, {'ticket': 'short'});
    },
  );
}
