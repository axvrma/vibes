import 'category_item.dart';
import 'video_state.dart';

class VideoTag {
  final String id;
  final String name;
  final String color;

  VideoTag({required this.id, required this.name, required this.color});

  factory VideoTag.fromJson(Map<String, dynamic> json) {
    return VideoTag(id: json['id'], name: json['name'], color: json['color']);
  }
}

class VideoItem {
  final String id;
  final String title;
  final Uri streamUrl;
  final Uri thumbnailUrl;
  final String? localPath;
  final List<VideoTag> tags;
  final double? durationSeconds;
  final int sizeBytes;
  final CategoryItem? category;
  final VideoState? initialState;
  final String sourceType;
  final String availability;

  VideoItem({
    required this.id,
    required this.title,
    required this.streamUrl,
    required this.thumbnailUrl,
    this.localPath,
    required this.tags,
    this.durationSeconds,
    required this.sizeBytes,
    this.category,
    this.initialState,
    this.sourceType = 'upload',
    this.availability = 'available',
  });

  factory VideoItem.fromJson(Map<String, dynamic> json, String baseUrl) {
    return VideoItem(
      initialState: json['state'] is Map
          ? VideoState(
              videoId: json['id'],
              liked: json['state']['liked'] == 1,
              note: json['state']['note'] ?? '',
              progressSeconds: (json['state']['progress_seconds'] ?? 0)
                  .toDouble(),
              updatedAt:
                  DateTime.tryParse(json['state']['updated_at'] ?? '') ??
                  DateTime.now(),
            )
          : null,
      sourceType: json['sourceType'] ?? 'upload',
      availability: json['availability'] ?? 'available',
      id: json['id'],
      title: json['title'],
      // Strip out the prefix if any and append correctly
      streamUrl: Uri.parse('$baseUrl${json['streamUrl']}'),
      thumbnailUrl: Uri.parse('$baseUrl${json['thumbnailUrl']}'),
      tags: (json['tags'] as List? ?? [])
          .map((t) => VideoTag.fromJson(Map<String, dynamic>.from(t)))
          .toList(),
      durationSeconds: json['durationSeconds']?.toDouble(),
      sizeBytes: json['sizeBytes'] ?? 0,
      category: json['category'] != null
          ? CategoryItem.fromJson(Map<String, dynamic>.from(json['category']))
          : null,
    );
  }

  VideoItem copyWith({String? localPath}) {
    return VideoItem(
      id: id,
      title: title,
      streamUrl: streamUrl,
      thumbnailUrl: thumbnailUrl,
      localPath: localPath ?? this.localPath,
      tags: tags,
      durationSeconds: durationSeconds,
      sizeBytes: sizeBytes,
      category: category,
      initialState: initialState,
      sourceType: sourceType,
      availability: availability,
    );
  }
}
