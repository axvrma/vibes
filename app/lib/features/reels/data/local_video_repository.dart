import 'dart:io';
import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:path/path.dart' as p;
import '../../../core/config/settings_repository.dart';
import '../../../core/config/local_folder_access.dart';
import '../domain/video_item.dart';
import '../domain/video_repository.dart';

class LocalVideoRepository implements VideoRepository {
  static const extensions = {'.mp4', '.mov', '.mkv', '.avi', '.webm', '.m4v'};
  final Box box = Hive.box('videoData');
  @override
  Future<List<VideoItem>> getVideos() async {
    final settings = SettingsRepository();
    final folder = settings.localFolderPath;
    if (folder == null || folder.isEmpty) return [];
    await LocalFolderAccess.restore();
    if (folder.startsWith('content://')) {
      final records =
          await LocalFolderAccess.channel.invokeListMethod<dynamic>(
            'listVideos',
            {'tree': folder, 'recursive': settings.recursiveLocalScan},
          ) ??
          [];
      return records.map((raw) {
        final m = Map<String, dynamic>.from(raw);
        final uri = Uri.parse(m['uri']);
        return VideoItem(
          id: 'local_${sha256.convert(utf8.encode(m['id']))}',
          title: m['name'],
          streamUrl: uri,
          thumbnailUrl: Uri(),
          tags: [],
          sizeBytes: m['size'] ?? 0,
        );
      }).toList();
    }
    final dir = Directory(folder);
    if (!await dir.exists()) {
      throw FileSystemException(
        'Your folder is unavailable. Reconnect it or choose it again.',
        folder,
      );
    }
    final videos = <VideoItem>[];
    final seen = <String>{};
    await for (final entity in dir.list(
      recursive: settings.recursiveLocalScan,
      followLinks: false,
    )) {
      if (entity is! File ||
          !extensions.contains(p.extension(entity.path).toLowerCase())) {
        continue;
      }
      if (p
          .split(p.relative(entity.path, from: folder))
          .any((part) => part.startsWith('.'))) {
        continue;
      }
      final stat = await entity.stat();
      final canonical = await entity.resolveSymbolicLinks();
      final cacheKey = 'identity_$canonical';
      final cached = box.get(cacheKey);
      String id;
      if (cached is Map &&
          cached['size'] == stat.size &&
          cached['modified'] == stat.modified.millisecondsSinceEpoch) {
        id = cached['id'];
      } else {
        // Bounded content fingerprint stays stable across renames. Never hash an entire drive.
        final handle = await entity.open();
        try {
          final first = await handle.read(min(stat.size, 65536));
          await handle.setPosition(max(0, stat.size - 65536));
          final last = await handle.read(min(stat.size, 65536));
          id =
              'local_${sha256.convert([...utf8.encode('${stat.size}:'), ...first, ...last])}';
        } finally {
          await handle.close();
        }
        await box.put(cacheKey, {
          'id': id,
          'size': stat.size,
          'modified': stat.modified.millisecondsSinceEpoch,
        });
      }
      // Retain state created by the v2.2 path-hash scheme where it is available.
      final legacy = box.get('video_${entity.path.hashCode}');
      if (box.get('video_$id') == null && legacy != null) {
        await box.put('video_$id', legacy);
      }
      if (!seen.add(id)) continue;
      videos.add(
        VideoItem(
          id: id,
          title: p.basenameWithoutExtension(entity.path),
          streamUrl: Uri.file(entity.path),
          thumbnailUrl: Uri(),
          localPath: entity.path,
          tags: [],
          sizeBytes: stat.size,
        ),
      );
    }
    videos.sort(
      (a, b) => a.title.toLowerCase().compareTo(b.title.toLowerCase()),
    );
    return videos;
  }

  @override
  Future<VideoItem> getVideo(String id) async =>
      (await getVideos()).firstWhere((v) => v.id == id);
  @override
  Future<File?> getCachedVideo(String videoId) async => null;
  @override
  Future<File> downloadVideo(
    VideoItem video, {
    Function(int, int)? onReceiveProgress,
  }) async {
    if (video.localPath != null) return File(video.localPath!);
    throw UnsupportedError('This video uses a system document URI.');
  }

  @override
  Future<void> deleteCachedVideo(String videoId) async {}
  Future<void> _save(String id, Map<String, dynamic> patch) async {
    final existing = Map<String, dynamic>.from(
      box.get('video_$id', defaultValue: <String, dynamic>{}),
    );
    await box.put('video_$id', {
      ...existing,
      ...patch,
      'updatedAt': DateTime.now().toIso8601String(),
    });
  }

  @override
  Future<void> likeVideo(String id) => _save(id, {'liked': true});
  @override
  Future<void> unlikeVideo(String id) => _save(id, {'liked': false});
  @override
  Future<void> saveNote(String id, String text) => _save(id, {'note': text});
  @override
  Future<void> saveProgress(String id, double value) =>
      _save(id, {'progressSeconds': value});
}
