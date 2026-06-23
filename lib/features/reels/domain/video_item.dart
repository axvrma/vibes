import 'category_item.dart';

class VideoTag {
  final String id;
  final String name;
  final String color;

  VideoTag({required this.id, required this.name, required this.color});

  factory VideoTag.fromJson(Map<String, dynamic> json) {
    return VideoTag(
      id: json['id'],
      name: json['name'],
      color: json['color'],
    );
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
  });

  factory VideoItem.fromJson(Map<String, dynamic> json, String baseUrl) {
    return VideoItem(
      id: json['id'],
      title: json['title'],
      // Strip out the prefix if any and append correctly
      streamUrl: Uri.parse('$baseUrl${json['streamUrl']}'),
      thumbnailUrl: Uri.parse('$baseUrl${json['thumbnailUrl']}'),
      tags: (json['tags'] as List? ?? []).map((t) => VideoTag.fromJson(t)).toList(),
      durationSeconds: json['durationSeconds']?.toDouble(),
      sizeBytes: json['sizeBytes'] ?? 0,
      category: json['category'] != null ? CategoryItem.fromJson(json['category']) : null,
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
    );
  }
}
