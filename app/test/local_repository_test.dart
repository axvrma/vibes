import 'dart:io';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter/services.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:vibes/core/config/settings_repository.dart';
import 'package:vibes/features/reels/data/local_video_repository.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
      .setMockMethodCallHandler(
        const MethodChannel('vibes/local-library'),
        (call) async => null,
      );
  late Directory temp;
  setUp(() async {
    temp = await Directory.systemTemp.createTemp('vibes-local-test');
    Hive.init(temp.path);
    await Hive.openBox('settingsData');
    await Hive.openBox('videoData');
    await SettingsRepository().setLocalFolderPath(temp.path);
  });
  tearDown(() async {
    await Hive.close();
    await temp.delete(recursive: true);
  });
  test(
    'recursive discovery is optional, excludes duplicates and survives rename',
    () async {
      final file = File('${temp.path}/one.mp4');
      await file.writeAsBytes([1, 2, 3]);
      await Directory('${temp.path}/nested').create();
      await File('${temp.path}/nested/two.webm').writeAsBytes([4, 5, 6]);
      final repo = LocalVideoRepository();
      final first = await repo.getVideos();
      expect(first.length, 1);
      await file.rename('${temp.path}/renamed.mp4');
      expect((await repo.getVideos()).first.id, first.first.id);
      await File('${temp.path}/copy.mp4').writeAsBytes([1, 2, 3]);
      expect((await repo.getVideos()).length, 1);
      await SettingsRepository().setRecursiveLocalScan(true);
      expect((await repo.getVideos()).length, 2);
    },
  );
  test('likes, notes and progress persist and merge', () async {
    final repo = LocalVideoRepository();
    await repo.likeVideo('v');
    await repo.saveNote('v', 'Remember');
    await repo.saveProgress('v', 12.5);
    expect(Hive.box('videoData').get('video_v'), containsPair('liked', true));
    expect(
      Hive.box('videoData').get('video_v'),
      containsPair('note', 'Remember'),
    );
    expect(
      Hive.box('videoData').get('video_v'),
      containsPair('progressSeconds', 12.5),
    );
    await repo.unlikeVideo('v');
    expect(
      Hive.box('videoData').get('video_v'),
      containsPair('note', 'Remember'),
    );
  });
  test('missing folder reports a recoverable error', () async {
    await SettingsRepository().setLocalFolderPath('${temp.path}/missing');
    await expectLater(
      LocalVideoRepository().getVideos(),
      throwsA(isA<FileSystemException>()),
    );
  });
}
