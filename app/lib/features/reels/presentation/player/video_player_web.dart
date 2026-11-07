import 'package:flutter/material.dart';
import 'package:media_kit/media_kit.dart';
import 'package:media_kit_video/media_kit_video.dart';
import 'adaptive_video_player.dart';

AdaptiveVideoController createPlatformVideoController() {
  return WebVideoController();
}

class WebVideoController implements AdaptiveVideoController {
  final Player _player = Player(
    configuration: const PlayerConfiguration(title: 'vibes'),
  );
  VideoController? _videoController;

  bool _disposed = false;
  bool _isPlaying = false;
  bool _hasError = false;
  bool _isBuffering = false;
  String? _errorDescription;
  Duration _position = Duration.zero;
  Duration _duration = Duration.zero;

  final List<VoidCallback> _listeners = [];

  WebVideoController() {
    _player.stream.playing.listen((playing) {
      _isPlaying = playing;
      _notifyListeners();
    });

    _player.stream.position.listen((position) {
      _position = position;
      _notifyListeners();
    });

    _player.stream.duration.listen((duration) {
      _duration = duration;
      _notifyListeners();
    });

    _player.stream.error.listen((error) {
      final errorStr = error.toString();
      if (errorStr.contains('The play() request was interrupted') ||
          errorStr.contains('interact with the document first') ||
          errorStr.contains('NotAllowedError')) {
        return;
      }
      _hasError = true;
      _errorDescription = errorStr;
      _notifyListeners();
    });

    _player.stream.buffering.listen((buffering) {
      _isBuffering = buffering;
      _notifyListeners();
    });
  }

  VideoController? get videoController => _videoController;

  @override
  bool get isPlaying => _isPlaying;

  @override
  bool get hasError => _hasError;

  @override
  bool get isBuffering => _isBuffering;

  @override
  String? get errorDescription => _errorDescription;

  @override
  Duration get position => _position;

  @override
  Duration get duration => _duration;

  Future<void>? _initFuture;

  @override
  Future<void> initialize(
    Uri url, {
    Object? file,
    Map<String, String>? headers,
  }) async {
    _videoController = VideoController(_player);
    // Web does not support local files using dart:io File
    _initFuture = _player.open(
      Media(url.toString(), httpHeaders: headers),
      play: false,
    );
    try {
      await _initFuture;
    } catch (error) {
      if (!_disposed) {
        _hasError = true;
        _errorDescription = error.toString();
        _notifyListeners();
      }
    }
  }

  @override
  Future<void> play() async {
    if (_disposed) return;
    if (_initFuture != null) {
      try {
        await _initFuture;
      } catch (_) {
        return;
      }
    }
    if (_disposed) return;
    await _player.play();
  }

  @override
  Future<void> pause() async {
    if (_disposed) return;
    if (_initFuture != null) {
      try {
        await _initFuture;
      } catch (_) {
        return;
      }
    }
    if (_disposed) return;
    await _player.pause();
  }

  @override
  Future<void> seekTo(Duration position) async {
    if (!_disposed) await _player.seek(position);
  }

  @override
  Future<void> setLooping(bool looping) async {
    if (!_disposed) {
      await _player.setPlaylistMode(
        looping ? PlaylistMode.single : PlaylistMode.none,
      );
    }
  }

  @override
  Future<void> setPlaybackRate(double rate) async {
    if (!_disposed) await _player.setRate(rate);
  }

  @override
  Future<void> setVolume(double volume) async {
    if (!_disposed) await _player.setVolume(volume);
  }

  @override
  void dispose() {
    if (_disposed) return;
    _disposed = true;
    _listeners.clear();
    _player.dispose();
  }

  @override
  void addListener(VoidCallback listener) {
    _listeners.add(listener);
  }

  @override
  void removeListener(VoidCallback listener) {
    _listeners.remove(listener);
  }

  void _notifyListeners() {
    if (_disposed) return;
    for (var listener in List<VoidCallback>.from(_listeners)) {
      listener();
    }
  }
}

class PlatformVideoPlayerWidget extends StatelessWidget {
  final AdaptiveVideoController controller;
  final BoxFit fit;
  final bool pauseUponEnteringBackgroundMode;

  const PlatformVideoPlayerWidget({
    super.key,
    required this.controller,
    this.fit = BoxFit.contain,
    this.pauseUponEnteringBackgroundMode = true,
  });

  @override
  Widget build(BuildContext context) {
    final webController = controller as WebVideoController;
    if (webController.videoController == null) {
      return const Center(child: CircularProgressIndicator());
    }

    return Video(
      controller: webController.videoController!,
      fit: fit,
      controls: NoVideoControls,
      fill: Colors.transparent,
      pauseUponEnteringBackgroundMode: pauseUponEnteringBackgroundMode,
    );
  }
}
