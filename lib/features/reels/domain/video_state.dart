class VideoState {
  final String videoId;
  final bool liked;
  final String note;
  final double progressSeconds;
  final DateTime updatedAt;
  final bool syncPending;

  VideoState({
    required this.videoId,
    this.liked = false,
    this.note = '',
    this.progressSeconds = 0,
    required this.updatedAt,
    this.syncPending = false,
  });

  VideoState copyWith({
    bool? liked,
    String? note,
    double? progressSeconds,
    DateTime? updatedAt,
    bool? syncPending,
  }) {
    return VideoState(
      videoId: videoId,
      liked: liked ?? this.liked,
      note: note ?? this.note,
      progressSeconds: progressSeconds ?? this.progressSeconds,
      updatedAt: updatedAt ?? this.updatedAt,
      syncPending: syncPending ?? this.syncPending,
    );
  }
}
