import 'dart:io';
import 'video_item.dart';

abstract class VideoRepository {
  Future<List<VideoItem>> getVideos();
  Future<VideoItem> getVideo(String id);
  Future<File?> getCachedVideo(String videoId);
  Future<File> downloadVideo(VideoItem video, {Function(int, int)? onReceiveProgress});
  Future<void> deleteCachedVideo(String videoId);
  Future<void> likeVideo(String videoId);
  Future<void> unlikeVideo(String videoId);
  Future<void> saveNote(String videoId, String text);
  Future<void> saveProgress(String videoId, double progress);
}
