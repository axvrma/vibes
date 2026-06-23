import 'dart:io';
import 'package:path/path.dart' as p;
import '../../../core/config/settings_repository.dart';
import '../domain/video_item.dart';
import '../domain/video_repository.dart';

class LocalVideoRepository implements VideoRepository {
  @override
  Future<List<VideoItem>> getVideos() async {
    final settings = SettingsRepository();
    final folderPath = settings.localFolderPath;
    
    if (folderPath == null || folderPath.isEmpty) {
      return [];
    }

    final dir = Directory(folderPath);
    if (!await dir.exists()) {
      return [];
    }

    final List<VideoItem> videos = [];
    final extensions = ['.mp4', '.mov', '.mkv', '.avi'];

    await for (final entity in dir.list(recursive: false)) {
      if (entity is File) {
        final ext = p.extension(entity.path).toLowerCase();
        if (extensions.contains(ext)) {
          // Use path as the ID so it's consistent across reloads
          final id = entity.path.hashCode.toString();
          
          videos.add(VideoItem(
            id: id,
            title: p.basename(entity.path),
            streamUrl: Uri.file(entity.path),
            thumbnailUrl: Uri.file(entity.path), // Placeholder
            localPath: entity.path,
            tags: [],
            sizeBytes: await entity.length(),
          ));
        }
      }
    }

    return videos;
  }

  @override
  Future<VideoItem> getVideo(String id) async {
    throw UnimplementedError('Not needed in v1');
  }

  @override
  Future<File?> getCachedVideo(String videoId) async {
    // Return null and let the player handle the file URI directly
    return null;
  }

  @override
  Future<File> downloadVideo(VideoItem video, {Function(int, int)? onReceiveProgress}) async {
    if (video.localPath != null) {
      return File(video.localPath!);
    }
    throw Exception('Cannot download local video');
  }

  @override
  Future<void> deleteCachedVideo(String videoId) async {
    // No-op for local repository
  }

  @override
  Future<void> likeVideo(String videoId) async {}

  @override
  Future<void> unlikeVideo(String videoId) async {}

  @override
  Future<void> saveNote(String videoId, String text) async {}

  @override
  Future<void> saveProgress(String videoId, double progress) async {}
}
