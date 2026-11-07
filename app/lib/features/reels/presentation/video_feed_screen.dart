import 'dart:async';
import 'package:dio/dio.dart';
import '../../auth/presentation/login_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:hive_flutter/hive_flutter.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import '../../../core/config/settings_repository.dart';
import '../domain/video_item.dart';
import '../domain/video_repository.dart';
import '../data/server_video_repository.dart';
import '../data/local_video_repository.dart';
import '../domain/video_state.dart';
import 'settings_screen.dart';
import 'note_editor.dart';
import 'library_screen.dart';
import '../../auth/presentation/mode_selection_screen.dart';
import '../../auth/data/auth_repository.dart';
import 'player/adaptive_video_player.dart';
import 'media_session.dart';
import 'package:audio_service/audio_service.dart';
import '../../../core/services/audio_handler.dart';

class VideoFeedScreen extends StatefulWidget {
  const VideoFeedScreen({super.key});

  @override
  State<VideoFeedScreen> createState() => _VideoFeedScreenState();
}

class _VideoFeedScreenState extends State<VideoFeedScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  VideoRepository _repository = ServerVideoRepository();
  List<VideoItem> _allVideos = [];
  List<VideoItem> _videos = [];
  List<String> _categories = ['All'];
  String _selectedCategory = 'All';
  bool _isLoading = true;
  String? _error;

  final PageController _pageController = PageController();
  int _currentIndex = 0;
  bool _autoPlayBackground = false;
  String _statePrefix = 'video_';
  final Set<int> _ready = {};
  final Map<int, String> _initializationErrors = {};
  final Map<String, double> _downloadProgress = {};
  bool _loadingMore = false;
  bool _overlayOpen = false;
  int _playbackEpoch = 0;
  Future<void> _playbackWork = Future.value();
  DateTime _lastProgressSave = DateTime.fromMillisecondsSinceEpoch(0);

  final Box box = Hive.box('videoData');

  final Map<int, AdaptiveVideoController> _controllers = {};
  final Map<int, VideoState> _videoStates = {};
  final Map<int, bool> _hasNavigatedMap = {};

  AppLifecycleState _lifecycleState = AppLifecycleState.resumed;
  bool _isManuallyPaused = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WakelockPlus.enable();

    setupMediaSessionControls(onNext: _handleNext, onPrev: _handlePrev);

    try {
      audioHandler.onSkipToNext = _handleNext;
      audioHandler.onSkipToPrevious = _handlePrev;
      audioHandler.onPlayCallback = () {
        if (mounted && _isManuallyPaused) {
          setState(() {
            _isManuallyPaused = false;
          });
          _manageControllers();
        }
      };
      audioHandler.onPauseCallback = () {
        if (mounted && !_isManuallyPaused) {
          setState(() {
            _isManuallyPaused = true;
          });
          _manageControllers();
        }
      };
    } catch (_) {}

    if (SettingsRepository().isLocalMode) {
      _repository = LocalVideoRepository();
    }
    _loadVideos();
  }

  @override
  void dispose() {
    _playbackEpoch++;
    WidgetsBinding.instance.removeObserver(this);
    _persistProgress(_currentIndex);
    WakelockPlus.disable();
    _pageController.dispose();
    for (var controller in _controllers.values) {
      controller.dispose();
    }
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed) _persistProgress(_currentIndex);
    setState(() {
      _lifecycleState = state;
    });
    _manageControllers();
  }

  Future<void> _loadVideos() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      if (!SettingsRepository().isLocalMode) {
        final user = await AuthRepository().getUserId();
        _statePrefix = 'network_${SettingsRepository().serverUrl}_${user}_';
      }
      final videos = await _repository.getVideos();
      if (!mounted) return;
      final Set<String> uniqueCategories = {'All'};
      for (var v in videos) {
        if (v.category != null) {
          uniqueCategories.add(v.category!.name);
        }
      }

      setState(() {
        _allVideos = videos;
        _categories = uniqueCategories.toList()
          ..sort((a, b) => a == 'All' ? -1 : a.compareTo(b));
        _isLoading = false;
        _applyCategoryFilter();
      });
      _manageControllers();
      if (_repository is ServerVideoRepository &&
          (_repository as ServerVideoRepository).isOffline) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Offline — showing your saved library. Downloaded videos can still play.',
            ),
          ),
        );
      }
    } catch (e) {
      if (!mounted) return;
      if (e is DioException && [401, 403].contains(e.response?.statusCode)) {
        Navigator.pushReplacement(
          context,
          MaterialPageRoute(builder: (_) => const LoginScreen()),
        );
        return;
      }
      setState(() {
        _error = e.toString();
        _isLoading = false;
      });
    }
  }

  void _applyCategoryFilter() {
    if (_selectedCategory == 'All') {
      _videos = List.from(_allVideos);
    } else {
      _videos = _allVideos
          .where((v) => v.category?.name == _selectedCategory)
          .toList();
    }

    for (var controller in _controllers.values) {
      controller.dispose();
    }
    _controllers.clear();
    _ready.clear();
    _initializationErrors.clear();
    _videoStates.clear();
    _hasNavigatedMap.clear();

    _currentIndex = 0;
    _isManuallyPaused = false;
    if (_pageController.hasClients) {
      _pageController.jumpToPage(0);
    }
    _manageControllers();
  }

  void _onPageChanged(int index) {
    _persistProgress(_currentIndex);
    setState(() {
      _currentIndex = index;
      _isManuallyPaused = false;
    });
    _hasNavigatedMap[index] = false;
    if (index >= _videos.length - 5) _loadMore();
    _manageControllers();
  }

  void _manageControllers() {
    if (_videos.isEmpty) return;
    final prev = _currentIndex - 1;
    final current = _currentIndex;
    final next = _currentIndex + 1;

    // Initialize required
    for (int i in [prev, current, next]) {
      if (i >= 0 && i < _videos.length) {
        if (!_controllers.containsKey(i)) {
          _initializeController(i);
        }
      }
    }

    // Dispose unused
    final keysToRemove = _controllers.keys
        .where((k) => k < prev || k > next)
        .toList();
    for (int k in keysToRemove) {
      final oldController = _controllers[k];
      _controllers.remove(k);
      oldController?.pause();
      _ready.remove(k);
      oldController?.dispose();
    }

    final epoch = ++_playbackEpoch;
    _playbackWork = _playbackWork.catchError((Object _) {}).then((_) async {
      if (!mounted || epoch != _playbackEpoch) return;
      final snapshot = Map<int, AdaptiveVideoController>.from(_controllers);
      for (final entry in snapshot.entries) {
        if (entry.key != _currentIndex ||
            _overlayOpen ||
            _isManuallyPaused ||
            (_lifecycleState != AppLifecycleState.resumed &&
                !_autoPlayBackground)) {
          if (_ready.contains(entry.key)) await entry.value.pause();
        }
      }
      if (!mounted || epoch != _playbackEpoch) return;
      final active = _controllers[_currentIndex];
      final allowed =
          !_overlayOpen &&
          !_isManuallyPaused &&
          (_lifecycleState == AppLifecycleState.resumed || _autoPlayBackground);
      if (active != null &&
          _ready.contains(_currentIndex) &&
          !active.hasError &&
          allowed) {
        await active.play();
        if (epoch != _playbackEpoch) {
          await active.pause();
          return;
        }
      }
      if (_autoPlayBackground && _currentIndex < _videos.length) {
        if (kIsWeb) {
          updateMediaSessionMetadata(_videos[_currentIndex].title, 'Vibes');
        } else {
          try {
            audioHandler.updateMediaItem(
              MediaItem(
                id: _videos[_currentIndex].id,
                title: _videos[_currentIndex].title,
                artist: 'Vibes',
              ),
            );
            if (allowed) {
              audioHandler.play();
            } else {
              audioHandler.pause();
            }
          } catch (_) {}
        }
      } else {
        if (kIsWeb) {
          clearMediaSessionMetadata();
        } else {
          try {
            audioHandler.stop();
          } catch (_) {}
        }
      }
    });
  }

  Future<void> _initializeController(int index) async {
    final video = _videos[index];

    try {
      AdaptiveVideoController controller;
      bool isNew = false;
      if (_controllers.containsKey(index)) {
        controller = _controllers[index]!;
      } else {
        controller = createAdaptiveVideoController();
        _controllers[index] = controller;
        isNew = true;
      }

      // Load VideoState
      VideoState vState =
          video.initialState ??
          VideoState(videoId: video.id, updatedAt: DateTime.now());
      final cached = box.get('$_statePrefix${video.id}');
      if (cached != null &&
          (SettingsRepository().isLocalMode ||
              video.initialState == null ||
              cached['syncPending'] == true)) {
        try {
          final map = Map<String, dynamic>.from(cached);
          vState = VideoState(
            videoId: video.id,
            liked: map['liked'] ?? false,
            note: map['note'] ?? '',
            progressSeconds: map['progressSeconds'] ?? 0.0,
            syncPending: map['syncPending'] ?? false,
            updatedAt: map['updatedAt'] != null
                ? DateTime.parse(map['updatedAt'])
                : DateTime.now(),
          );
        } catch (_) {}
      }
      _videoStates[index] = vState;
      if (vState.syncPending) _syncFavorite(vState);
      if (isNew) {
        _hasNavigatedMap[index] = false;
        controller.addListener(() {
          _videoListener(index);
        });
      }

      // We try to get cached file using the repository
      Object? cachedFile;
      try {
        cachedFile = await _repository.getCachedVideo(video.id);
      } catch (_) {}

      // Construct URI and Headers logic from original code
      Uri streamUri = video.streamUrl;
      final headers = <String, String>{};

      if (cachedFile == null &&
          !SettingsRepository().isLocalMode &&
          _repository is ServerVideoRepository) {
        if (kIsWeb) {
          streamUri = await (_repository as ServerVideoRepository).mediaUri(
            video,
            'stream',
          );
        } else {
          final token = await AuthRepository().getAccessToken();
          if (token != null) headers['Authorization'] = 'Bearer $token';
        }
      }
      if (!mounted || _controllers[index] != controller) return;
      await controller.initialize(
        streamUri,
        file: cachedFile,
        headers: headers,
      );
      if (!mounted || _controllers[index] != controller) return;
      _ready.add(index);
      if (vState.progressSeconds > 0) {
        await controller.seekTo(
          Duration(milliseconds: (vState.progressSeconds * 1000).round()),
        );
      }
      controller.setLooping(!_autoPlayBackground);

      if (mounted) {
        setState(() {});
        _manageControllers();
      }
    } catch (error) {
      if (mounted && index < _videos.length && _videos[index].id == video.id) {
        setState(
          () => _initializationErrors[index] =
              'Could not initialize playback. Check your connection and retry.',
        );
      }
    }
  }

  void _videoListener(int index) {
    if (!mounted) return;
    final controller = _controllers[index];
    if (controller == null) return;

    if (index == _currentIndex) {
      if (DateTime.now().difference(_lastProgressSave).inSeconds >= 10) {
        _lastProgressSave = DateTime.now();
        _persistProgress(index);
      }
      // Auto-advance logic
      if (_autoPlayBackground &&
          !(_hasNavigatedMap[index] ?? false) &&
          controller.duration.inMilliseconds > 0 &&
          controller.position.inMilliseconds >=
              controller.duration.inMilliseconds - 300) {
        _hasNavigatedMap[index] = true;
        if (index < _videos.length - 1) {
          _advanceToNextVideo();
        }
      }
    }
  }

  void _handleNext() {
    if (_currentIndex < _videos.length - 1 && mounted) {
      final newIndex = _currentIndex + 1;
      final isBackground =
          _lifecycleState == AppLifecycleState.paused ||
          _lifecycleState == AppLifecycleState.hidden ||
          _lifecycleState == AppLifecycleState.detached;

      if (isBackground) {
        setState(() {
          _currentIndex = newIndex;
          _isManuallyPaused = false;
        });
        _hasNavigatedMap[newIndex] = false;
        if (_controllers.containsKey(newIndex)) {
          _controllers[newIndex]?.seekTo(Duration.zero);
        }
        _manageControllers();
        if (_pageController.hasClients) {
          _pageController.jumpToPage(newIndex);
        }
      } else {
        if (_pageController.hasClients) {
          _pageController.nextPage(
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      }
    }
  }

  void _handlePrev() {
    if (_currentIndex > 0 && mounted) {
      final newIndex = _currentIndex - 1;
      final isBackground =
          _lifecycleState == AppLifecycleState.paused ||
          _lifecycleState == AppLifecycleState.hidden ||
          _lifecycleState == AppLifecycleState.detached;

      if (isBackground) {
        setState(() {
          _currentIndex = newIndex;
          _isManuallyPaused = false;
        });
        _hasNavigatedMap[newIndex] = false;
        if (_controllers.containsKey(newIndex)) {
          _controllers[newIndex]?.seekTo(Duration.zero);
        }
        _manageControllers();
        if (_pageController.hasClients) {
          _pageController.jumpToPage(newIndex);
        }
      } else {
        if (_pageController.hasClients) {
          _pageController.previousPage(
            duration: MediaQuery.disableAnimationsOf(context)
                ? Duration.zero
                : const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
        }
      }
    }
  }

  void _advanceToNextVideo() {
    _handleNext();
  }

  void _saveState(int index) {
    final state = _videoStates[index];
    final video = _videos[index];
    if (state != null) {
      box.put('$_statePrefix${video.id}', {
        'syncPending': state.syncPending,
        'liked': state.liked,
        'note': state.note,
        'progressSeconds': state.progressSeconds,
        'updatedAt': state.updatedAt.toIso8601String(),
      });
    }
  }

  void _toggleLike(int index) {
    HapticFeedback.mediumImpact();
    setState(() {
      final state =
          _videoStates[index] ??
          VideoState(videoId: _videos[index].id, updatedAt: DateTime.now());
      _videoStates[index] = state.copyWith(
        liked: !state.liked,
        syncPending: true,
      );
    });
    _saveState(index);
    final state = _videoStates[index]!;
    _syncFavorite(state);
  }

  void _syncFavorite(VideoState state) {
    final future = state.liked
        ? _repository.likeVideo(state.videoId)
        : _repository.unlikeVideo(state.videoId);
    future
        .then((_) {
          if (!mounted) return;
          for (final entry in _videoStates.entries.toList()) {
            if (entry.value.videoId == state.videoId &&
                entry.value.liked == state.liked) {
              _videoStates[entry.key] = entry.value.copyWith(
                syncPending: false,
              );
              _saveState(entry.key);
            }
          }
        })
        .catchError((Object error) {
          if (mounted) {
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: const Text(
                  'Could not sync favorite. It is saved on this device.',
                ),
                action: SnackBarAction(
                  label: 'Retry',
                  onPressed: () => _syncFavorite(state),
                ),
              ),
            );
          }
        });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || _repository is! ServerVideoRepository) return;
    final repository = _repository as ServerVideoRepository;
    if (!repository.hasMore) return;
    _loadingMore = true;
    try {
      final more = await repository.loadMore();
      if (mounted) {
        setState(() {
          final ids = _allVideos.map((v) => v.id).toSet();
          _allVideos.addAll(more.where((v) => !ids.contains(v.id)));
          _videos = _selectedCategory == 'All'
              ? List.from(_allVideos)
              : _allVideos
                    .where((v) => v.category?.name == _selectedCategory)
                    .toList();
        });
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: const Text('Could not load more videos.'),
            action: SnackBarAction(label: 'Retry', onPressed: _loadMore),
          ),
        );
      }
    } finally {
      _loadingMore = false;
    }
  }

  void _persistProgress(int index) {
    if (index < 0 || index >= _videos.length) return;
    final controller = _controllers[index];
    if (controller == null || !_ready.contains(index)) return;
    final state = _videoStates[index];
    if (state == null) return;
    final seconds = controller.position.inMilliseconds / 1000;
    _videoStates[index] = state.copyWith(
      progressSeconds: seconds,
      updatedAt: DateTime.now(),
    );
    _saveState(index);
    _repository.saveProgress(state.videoId, seconds).catchError((Object _) {});
  }

  Future<void> _editNote(int index) async {
    final video = _videos[index];
    final state =
        _videoStates[index] ??
        VideoState(videoId: video.id, updatedAt: DateTime.now());
    _overlayOpen = true;
    _manageControllers();
    await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      showDragHandle: true,
      builder: (context) => NoteEditor(
        title: video.title,
        initialNote: state.note,
        draftKey: 'draft_$_statePrefix${video.id}',
        onSave: (text) async {
          await _repository.saveNote(video.id, text);
          if (mounted) {
            setState(
              () => _videoStates[index] = (_videoStates[index] ?? state)
                  .copyWith(note: text, updatedAt: DateTime.now()),
            );
            _saveState(index);
            ScaffoldMessenger.of(
              this.context,
            ).showSnackBar(const SnackBar(content: Text('Note saved')));
          }
        },
      ),
    );
    _overlayOpen = false;
    if (mounted) _manageControllers();
  }

  Future<void> _downloadVideo(int index) async {
    final video = _videos[index];
    if (_downloadProgress.containsKey(video.id)) return;
    setState(() => _downloadProgress[video.id] = 0);
    try {
      await _repository.downloadVideo(
        video,
        onReceiveProgress: (done, total) {
          if (mounted && total > 0) {
            setState(() => _downloadProgress[video.id] = done / total);
          }
        },
      );
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Video available offline on this device'),
          ),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Download failed: $error'),
            action: SnackBarAction(
              label: 'Retry',
              onPressed: () => _downloadVideo(index),
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _downloadProgress.remove(video.id));
    }
  }

  void _navigate(int index) {
    if (index == 1) _openLibrary();
    if (index == 2) _openLibrary(favorites: true);
    if (index == 3) _openSettings();
  }

  Future<void> _openSettings() async {
    _overlayOpen = true;
    _manageControllers();
    await Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => const SettingsScreen()),
    );
    if (mounted) {
      _repository = SettingsRepository().isLocalMode
          ? LocalVideoRepository()
          : ServerVideoRepository();
      _overlayOpen = false;
      _loadVideos();
    }
  }

  Future<void> _openLibrary({bool favorites = false}) async {
    _overlayOpen = true;
    _manageControllers();
    final selected = await Navigator.push<VideoItem>(
      context,
      MaterialPageRoute(builder: (_) => LibraryScreen(favorites: favorites)),
    );
    if (!mounted) return;
    _overlayOpen = false;
    if (selected != null) {
      setState(() {
        if (!_allVideos.any((v) => v.id == selected.id)) {
          _allVideos.add(selected);
        }
        _selectedCategory = 'All';
        _applyCategoryFilter();
      });
      final index = _videos.indexWhere((v) => v.id == selected.id);
      _pageController.jumpToPage(index);
      _onPageChanged(index);
    }
    _manageControllers();
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      key: _scaffoldKey,
      backgroundColor: isDark ? Colors.black : Colors.white,
      drawer: Drawer(
        child: ListView(
          padding: EdgeInsets.zero,
          children: [
            DrawerHeader(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [Color(0xFFFF3D81), Color(0xFF8957FF)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const Text(
                    'vibes',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Your Private Video Universe',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
            ListTile(
              leading: const Icon(Icons.video_library_outlined),
              title: const Text('Library'),
              onTap: () {
                Navigator.pop(context);
                _openLibrary();
              },
            ),
            ListTile(
              leading: const Icon(Icons.favorite_outline),
              title: const Text('Favorites'),
              onTap: () {
                Navigator.pop(context);
                _openLibrary(favorites: true);
              },
            ),
            ListTile(
              leading: const Icon(
                Icons.settings,
                color: Colors.black54,
                size: 24.0,
              ),
              title: const Text('Settings'),
              onTap: () {
                Navigator.pop(context);
                _overlayOpen = true;
                _manageControllers();
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const SettingsScreen()),
                ).then((_) {
                  if (mounted) {
                    _repository = SettingsRepository().isLocalMode
                        ? LocalVideoRepository()
                        : ServerVideoRepository();
                    _overlayOpen = false;
                    _loadVideos();
                  }
                });
              },
            ),
            ListTile(
              leading: const Icon(
                Icons.logout,
                color: Colors.redAccent,
                size: 24.0,
              ),
              title: const Text(
                'Logout',
                style: TextStyle(color: Colors.redAccent),
              ),
              onTap: () async {
                Navigator.pop(context);
                await AuthRepository().logout();
                if (context.mounted) {
                  Navigator.pushAndRemoveUntil(
                    context,
                    MaterialPageRoute(
                      builder: (_) => const ModeSelectionScreen(),
                    ),
                    (route) => false,
                  );
                }
              },
            ),
          ],
        ),
      ),
      bottomNavigationBar: MediaQuery.sizeOf(context).width < 800
          ? NavigationBar(
              selectedIndex: 0,
              onDestinationSelected: _navigate,
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.play_circle_outline),
                  label: 'Feed',
                ),
                NavigationDestination(
                  icon: Icon(Icons.video_library_outlined),
                  label: 'Library',
                ),
                NavigationDestination(
                  icon: Icon(Icons.favorite_outline),
                  label: 'Favorites',
                ),
                NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  label: 'Settings',
                ),
              ],
            )
          : null,
      body: Row(
        children: [
          if (MediaQuery.sizeOf(context).width >= 800)
            NavigationRail(
              selectedIndex: 0,
              onDestinationSelected: _navigate,
              labelType: NavigationRailLabelType.all,
              destinations: const [
                NavigationRailDestination(
                  icon: Icon(Icons.play_circle_outline),
                  label: Text('Feed'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.video_library_outlined),
                  label: Text('Library'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.favorite_outline),
                  label: Text('Favorites'),
                ),
                NavigationRailDestination(
                  icon: Icon(Icons.settings_outlined),
                  label: Text('Settings'),
                ),
              ],
            ),
          Expanded(child: Stack(children: [_buildBody(), _buildTopBar()])),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFFFF3D81)),
      );
    }

    if (_error != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.error, color: Colors.red, size: 64.0),
              const SizedBox(height: 16),
              const Text(
                'An error occurred while loading the feed.',
                style: TextStyle(fontSize: 18),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ElevatedButton(
                onPressed: _loadVideos,
                child: const Text('Retry'),
              ),
              const SizedBox(height: 32),
              Card(
                child: Theme(
                  data: Theme.of(
                    context,
                  ).copyWith(dividerColor: Colors.transparent),
                  child: ExpansionTile(
                    title: const Text('More details'),
                    children: [
                      Padding(
                        padding: const EdgeInsets.all(16.0),
                        child: Text(
                          _error!,
                          style: const TextStyle(color: Colors.redAccent),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_videos.isEmpty) {
      return Center(
        child: Text(
          'No videos here yet. Refresh your folder or connect a library on your server.',
          style: TextStyle(
            color: Theme.of(context).colorScheme.onSurface,
            fontSize: 18,
          ),
        ),
      );
    }

    return PageView.builder(
      controller: _pageController,
      scrollDirection: Axis.vertical,
      onPageChanged: _onPageChanged,
      itemCount: _videos.length,
      itemBuilder: (context, index) {
        final controller = _controllers[index];
        final state =
            _videoStates[index] ??
            VideoState(videoId: _videos[index].id, updatedAt: DateTime.now());

        return VideoPlayerScreen(
          key: ValueKey(_videos[index].id),
          video: _videos[index],
          controller: controller,
          videoState: state,
          isActive: index == _currentIndex,
          initializationError: _initializationErrors[index],
          autoPlayMode: _autoPlayBackground,
          onToggleLike: () => _toggleLike(index),
          onEditNote: () => _editNote(index),
          onDownload: !kIsWeb && !SettingsRepository().isLocalMode
              ? () => _downloadVideo(index)
              : null,
          downloadProgress: _downloadProgress[_videos[index].id],
          onRetry: () {
            _initializationErrors.remove(index);
            _controllers.remove(index)?.dispose();
            _ready.remove(index);
            _initializeController(index);
          },
          onManualPlayPause: (isPaused) {
            _isManuallyPaused = isPaused;
            if (_autoPlayBackground && !kIsWeb) {
              try {
                if (isPaused) {
                  audioHandler.pause();
                } else {
                  audioHandler.play();
                }
              } catch (_) {}
            }
          },
          onNavigateUp: index > 0
              ? () {
                  if (_pageController.hasClients) {
                    _pageController.previousPage(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  }
                }
              : null,
          onNavigateDown: index < _videos.length - 1
              ? () {
                  if (_pageController.hasClients) {
                    _pageController.nextPage(
                      duration: MediaQuery.disableAnimationsOf(context)
                          ? Duration.zero
                          : const Duration(milliseconds: 300),
                      curve: Curves.easeInOut,
                    );
                  }
                }
              : null,
          pauseUponEnteringBackgroundMode: !_autoPlayBackground,
        );
      },
    );
  }

  Widget _buildTopBar() {
    final shadowColor = Colors.black.withValues(alpha: 0.8);
    final shadows = [
      Shadow(color: shadowColor, blurRadius: 2.0),
      Shadow(color: shadowColor, blurRadius: 6.0),
      Shadow(color: shadowColor, blurRadius: 12.0),
    ];

    return Positioned(
      top: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        child: IconTheme(
          data: IconTheme.of(context).copyWith(shadows: shadows),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 20,
                  vertical: 12,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        IconButton(
                          icon: Icon(
                            Icons.menu,
                            color:
                                Theme.of(context).iconTheme.color ??
                                Colors.white,
                            size: 24.0,
                          ),
                          onPressed: () {
                            _scaffoldKey.currentState?.openDrawer();
                          },
                        ),
                        const SizedBox(width: 8),
                        Text(
                          "vibes",
                          style: TextStyle(
                            fontSize: 26,
                            fontWeight: FontWeight.bold,
                            color: const Color(0xFFFF3D81),
                            letterSpacing: -1,
                            shadows: shadows,
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        IconButton(
                          icon: Icon(
                            Icons.play_circle,
                            color: _autoPlayBackground
                                ? const Color(0xFFFF3D81)
                                : (Theme.of(context).iconTheme.color ??
                                      Colors.white),
                            size: 24.0,
                          ),
                          onPressed: () {
                            setState(() {
                              _autoPlayBackground = !_autoPlayBackground;
                              for (var controller in _controllers.values) {
                                controller.setLooping(!_autoPlayBackground);
                              }
                              _manageControllers();
                            });
                          },
                        ),
                        IconButton(
                          icon: Icon(
                            Icons.refresh,
                            color:
                                Theme.of(context).iconTheme.color ??
                                Colors.white,
                            size: 24.0,
                          ),
                          onPressed: _loadVideos,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              if (!SettingsRepository().isLocalMode && _categories.length > 1)
                SizedBox(
                  height: 40,
                  child: ListView.builder(
                    scrollDirection: Axis.horizontal,
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    itemCount: _categories.length,
                    itemBuilder: (context, index) {
                      final category = _categories[index];
                      final isSelected = category == _selectedCategory;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: ChoiceChip(
                          label: Text(category),
                          selected: isSelected,
                          onSelected: (selected) {
                            if (selected && _selectedCategory != category) {
                              setState(() {
                                _selectedCategory = category;
                                _applyCategoryFilter();
                              });
                            }
                          },
                          selectedColor: const Color(0xFFFF3D81),
                          backgroundColor:
                              Theme.of(context).brightness == Brightness.dark
                              ? Colors.white.withValues(alpha: 0.1)
                              : Colors.black.withValues(alpha: 0.05),
                          labelStyle: TextStyle(
                            color: isSelected
                                ? Colors.white
                                : (Theme.of(context).brightness ==
                                          Brightness.dark
                                      ? Colors.white70
                                      : Colors.black87),
                            fontWeight: isSelected
                                ? FontWeight.bold
                                : FontWeight.normal,
                            shadows: isSelected ? [] : shadows,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(20),
                          ),
                        ),
                      );
                    },
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class VideoPlayerScreen extends StatefulWidget {
  final VideoItem video;
  final AdaptiveVideoController? controller;
  final VideoState videoState;
  final VoidCallback onToggleLike;
  final VoidCallback onEditNote;
  final VoidCallback onRetry;
  final String? initializationError;
  final VoidCallback? onDownload;
  final double? downloadProgress;
  final VoidCallback? onNavigateUp;
  final VoidCallback? onNavigateDown;
  final void Function(bool)? onManualPlayPause;
  final bool autoPlayMode;
  final bool isActive;
  final bool pauseUponEnteringBackgroundMode;

  const VideoPlayerScreen({
    super.key,
    required this.video,
    required this.controller,
    required this.videoState,
    required this.onToggleLike,
    required this.onEditNote,
    required this.onRetry,
    this.initializationError,
    this.onDownload,
    this.downloadProgress,
    this.onManualPlayPause,
    this.autoPlayMode = false,
    this.isActive = true,
    this.pauseUponEnteringBackgroundMode = true,
    this.onNavigateUp,
    this.onNavigateDown,
  });

  @override
  State<VideoPlayerScreen> createState() => _VideoPlayerScreenState();
}

class _VideoPlayerScreenState extends State<VideoPlayerScreen>
    with SingleTickerProviderStateMixin {
  bool _showPlayPauseIcon = false;
  bool _isFastForwarding = false;
  bool _muted = false;
  late AnimationController _likeAnimController;
  late Animation<double> _likeScaleAnim;

  @override
  void initState() {
    super.initState();
    _likeAnimController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _likeScaleAnim = Tween<double>(begin: 0.0, end: 1.2).animate(
      CurvedAnimation(parent: _likeAnimController, curve: Curves.elasticOut),
    );
  }

  @override
  void dispose() {
    _likeAnimController.dispose();
    super.dispose();
  }

  void _togglePlayPause() {
    final controller = widget.controller;
    if (controller == null) return;
    HapticFeedback.lightImpact();
    setState(() {
      _showPlayPauseIcon = true;
    });

    if (controller.isPlaying) {
      controller.pause();
      widget.onManualPlayPause?.call(true);
    } else {
      controller.play();
      widget.onManualPlayPause?.call(false);
    }

    Future.delayed(const Duration(milliseconds: 800), () {
      if (mounted) setState(() => _showPlayPauseIcon = false);
    });
  }

  void _onDoubleTapLike() {
    widget.onToggleLike();
    if (!widget.videoState.liked) {
      // It's about to be liked (state hasn't bubbled down yet fully, but we assume it does)
      if (MediaQuery.disableAnimationsOf(context)) return;
      _likeAnimController.forward().then((_) => _likeAnimController.reverse());
    }
  }

  @override
  Widget build(BuildContext context) {
    final shadowColor = Colors.black;

    return Stack(
      fit: StackFit.expand,
      children: [
        if (widget.controller == null)
          _buildLoadingWidget()
        else if (widget.controller!.hasError ||
            widget.initializationError != null)
          _buildErrorWidget()
        else
          _buildVideoPlayer(),

        Positioned.fill(
          child: _BufferingIndicator(controller: widget.controller),
        ),

        Positioned(
          top: 0,
          left: 0,
          right: 0,
          height: 160,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [
                  shadowColor.withValues(alpha: 0.8),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),
        Positioned(
          bottom: 0,
          left: 0,
          right: 0,
          height: 240,
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.bottomCenter,
                end: Alignment.topCenter,
                colors: [
                  shadowColor.withValues(alpha: 0.8),
                  Colors.transparent,
                ],
              ),
            ),
          ),
        ),

        _buildPlayPauseOverlay(),
        _buildSideActions(),
        _buildVideoInfo(),
        Positioned(
          left: 16,
          right: 16,
          bottom: 0,
          child: SafeArea(
            top: false,
            child: _PlaybackControls(controller: widget.controller),
          ),
        ),

        // Like Animation Overlay
        Center(
          child: ScaleTransition(
            scale: _likeScaleAnim,
            child: const Icon(Icons.favorite, color: Colors.red, size: 120.0),
          ),
        ),

        // Fast Forward Overlay
        if (_isFastForwarding)
          Center(
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.6),
                borderRadius: BorderRadius.circular(30),
              ),
              child: const Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '2x',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.fast_forward, color: Colors.white, size: 28),
                ],
              ),
            ),
          ),
      ],
    );
  }

  Widget _buildLoadingWidget() {
    return const Center(
      child: CircularProgressIndicator(color: Color(0xFFFF3D81)),
    );
  }

  Widget _buildErrorWidget() {
    return Center(
      child: Container(
        padding: const EdgeInsets.all(24.0),
        color: Colors.black.withValues(alpha: 0.6),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error, color: Colors.red, size: 48.0),
            const SizedBox(height: 16),
            const Text(
              'Could not play this video.',
              style: TextStyle(color: Colors.white, fontSize: 16),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: widget.onRetry,
              child: const Text('Retry playback'),
            ),
            Card(
              color: Colors.white.withValues(alpha: 0.05),
              child: Theme(
                data: Theme.of(
                  context,
                ).copyWith(dividerColor: Colors.transparent),
                child: ExpansionTile(
                  iconColor: Colors.white,
                  collapsedIconColor: Colors.white70,
                  title: const Text(
                    'More details',
                    style: TextStyle(color: Colors.white70),
                  ),
                  children: [
                    Padding(
                      padding: const EdgeInsets.all(16.0),
                      child: Text(
                        widget.initializationError ??
                            widget.controller!.errorDescription ??
                            "Unknown error",
                        style: const TextStyle(color: Colors.redAccent),
                        textAlign: TextAlign.center,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _setPlaybackRate(double rate) {
    final controller = widget.controller;
    if (controller == null) return;
    controller.setPlaybackRate(rate);
    setState(() {
      _isFastForwarding = rate > 1.0;
    });
  }

  Widget _buildVideoPlayer() {
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.space): _togglePlayPause,
        const SingleActivator(LogicalKeyboardKey.arrowDown): () =>
            widget.onNavigateDown?.call(),
        const SingleActivator(LogicalKeyboardKey.arrowUp): () =>
            widget.onNavigateUp?.call(),
      },
      child: Focus(
        autofocus: widget.isActive,
        canRequestFocus: widget.isActive,
        child: Semantics(
          label:
              'Video player. Space to play or pause; arrow keys to navigate.',
          button: true,
          onTap: _togglePlayPause,
          child: GestureDetector(
            onTap: _togglePlayPause,
            onDoubleTap: () {
              if (!widget.videoState.liked) _onDoubleTapLike();
            },
            onLongPressStart: (_) => _setPlaybackRate(2.0),
            onLongPressEnd: (_) => _setPlaybackRate(1.0),
            onLongPressCancel: () => _setPlaybackRate(1.0),
            child: Center(
              child: AdaptiveVideoPlayerWidget(
                controller: widget.controller!,
                fit: BoxFit.contain,
                pauseUponEnteringBackgroundMode:
                    widget.pauseUponEnteringBackgroundMode,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPlayPauseOverlay() {
    if (!_showPlayPauseIcon || widget.controller == null) {
      return const SizedBox.shrink();
    }
    return Center(
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.6),
          borderRadius: BorderRadius.circular(30),
        ),
        child: Icon(
          widget.controller!.isPlaying ? Icons.pause : Icons.play_arrow,
          color: Colors.white,
          size: 40.0,
        ),
      ),
    );
  }

  Widget _buildSideActions() {
    final shadowColor = Colors.black.withValues(alpha: 0.8);
    final shadows = [
      Shadow(color: shadowColor, blurRadius: 2.0),
      Shadow(color: shadowColor, blurRadius: 6.0),
      Shadow(color: shadowColor, blurRadius: 12.0),
    ];
    return Positioned(
      right: 16,
      bottom: 140,
      child: IconTheme(
        data: IconTheme.of(context).copyWith(shadows: shadows),
        child: Column(
          children: [
            IconButton(
              icon: Icon(
                Icons.favorite,
                color: widget.videoState.liked
                    ? Colors.red
                    : (Theme.of(context).iconTheme.color ?? Colors.white),
                size: 36.0,
              ),
              tooltip: widget.videoState.liked
                  ? 'Remove favorite'
                  : 'Add favorite',
              onPressed: widget.onToggleLike,
            ),
            IconButton(
              tooltip: widget.videoState.note.isEmpty
                  ? 'Add a note'
                  : 'Edit your note',
              onPressed: widget.onEditNote,
              icon: Icon(
                widget.videoState.note.isEmpty
                    ? Icons.note_add_outlined
                    : Icons.edit_note,
                color: Colors.white,
                size: 30,
              ),
            ),
            IconButton(
              tooltip: _muted ? 'Unmute' : 'Mute',
              onPressed: () {
                setState(() => _muted = !_muted);
                widget.controller?.setVolume(_muted ? 0 : 100);
              },
              icon: Icon(
                _muted ? Icons.volume_off : Icons.volume_up,
                color: Colors.white,
              ),
            ),
            if (widget.onDownload != null)
              IconButton(
                tooltip: widget.downloadProgress == null
                    ? 'Download for offline playback'
                    : 'Downloading ${(widget.downloadProgress! * 100).round()} percent',
                onPressed: widget.downloadProgress == null
                    ? widget.onDownload
                    : null,
                icon: widget.downloadProgress == null
                    ? const Icon(Icons.download_outlined, color: Colors.white)
                    : SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          value: widget.downloadProgress! > 0
                              ? widget.downloadProgress
                              : null,
                        ),
                      ),
              ),
            PopupMenuButton<double>(
              tooltip: 'Playback speed',
              icon: const Icon(Icons.speed, color: Colors.white),
              onSelected: _setPlaybackRate,
              itemBuilder: (_) => [
                for (final speed in [.5, 1.0, 1.5, 2.0])
                  PopupMenuItem(value: speed, child: Text('${speed}x')),
              ],
            ),
            const SizedBox(height: 16),
            if (widget.onNavigateUp != null)
              IconButton(
                icon: Icon(
                  Icons.keyboard_arrow_up,
                  color: Theme.of(context).iconTheme.color ?? Colors.white,
                  size: 36.0,
                ),
                onPressed: widget.onNavigateUp,
              ),
            if (widget.onNavigateDown != null)
              IconButton(
                icon: Icon(
                  Icons.keyboard_arrow_down,
                  color: Theme.of(context).iconTheme.color ?? Colors.white,
                  size: 36.0,
                ),
                onPressed: widget.onNavigateDown,
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildVideoInfo() {
    final shadowColor = Colors.black.withValues(alpha: 0.8);
    final shadows = [
      Shadow(color: shadowColor, blurRadius: 2.0),
      Shadow(color: shadowColor, blurRadius: 6.0),
      Shadow(color: shadowColor, blurRadius: 12.0),
    ];
    return Positioned(
      left: 16,
      bottom: 68,
      right: 80,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            widget.video.title,
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              shadows: shadows,
            ),
          ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            children: widget.video.tags.map((t) {
              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: Color(int.parse(t.color.replaceFirst('#', '0xFF'))),
                  borderRadius: BorderRadius.circular(4),
                ),
                child: Text(
                  t.name,
                  style: const TextStyle(color: Colors.white, fontSize: 12),
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }
}

class _BufferingIndicator extends StatefulWidget {
  final AdaptiveVideoController? controller;
  const _BufferingIndicator({this.controller});

  @override
  State<_BufferingIndicator> createState() => _BufferingIndicatorState();
}

class _BufferingIndicatorState extends State<_BufferingIndicator> {
  bool _isBuffering = false;

  @override
  void initState() {
    super.initState();
    _isBuffering = widget.controller?.isBuffering ?? false;
    widget.controller?.addListener(_onControllerUpdate);
  }

  @override
  void didUpdateWidget(_BufferingIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.controller != widget.controller) {
      oldWidget.controller?.removeListener(_onControllerUpdate);
      _isBuffering = widget.controller?.isBuffering ?? false;
      widget.controller?.addListener(_onControllerUpdate);
    }
  }

  void _onControllerUpdate() {
    final buffering = widget.controller?.isBuffering ?? false;
    if (buffering != _isBuffering) {
      if (mounted) setState(() => _isBuffering = buffering);
    }
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_onControllerUpdate);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!_isBuffering) return const SizedBox.shrink();
    return Center(
      child: SizedBox(
        width: MediaQuery.of(context).size.width * 0.3,
        child: const LinearProgressIndicator(
          color: Color(0xFFFF3D81),
          backgroundColor: Colors.white24,
          minHeight: 4,
          borderRadius: BorderRadius.all(Radius.circular(2)),
        ),
      ),
    );
  }
}

class _PlaybackControls extends StatefulWidget {
  final AdaptiveVideoController? controller;
  const _PlaybackControls({this.controller});
  @override
  State<_PlaybackControls> createState() => _PlaybackControlsState();
}

class _PlaybackControlsState extends State<_PlaybackControls> {
  @override
  void initState() {
    super.initState();
    widget.controller?.addListener(_update);
  }

  @override
  void didUpdateWidget(_PlaybackControls old) {
    super.didUpdateWidget(old);
    if (old.controller != widget.controller) {
      old.controller?.removeListener(_update);
      widget.controller?.addListener(_update);
    }
  }

  void _update() {
    if (mounted) setState(() {});
  }

  @override
  void dispose() {
    widget.controller?.removeListener(_update);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final c = widget.controller;
    final duration = c?.duration.inMilliseconds.toDouble() ?? 0;
    final position = (c?.position.inMilliseconds.toDouble() ?? 0).clamp(
      0.0,
      duration,
    );
    return Row(
      children: [
        IconButton(
          tooltip: 'Replay video',
          onPressed: () => c?.seekTo(Duration.zero),
          icon: const Icon(Icons.replay, color: Colors.white),
        ),
        Expanded(
          child: Slider(
            semanticFormatterCallback: (v) => '${(v / 1000).round()} seconds',
            min: 0,
            max: duration > 0 ? duration : 1,
            value: position,
            onChanged: duration > 0
                ? (v) => c?.seekTo(Duration(milliseconds: v.round()))
                : null,
          ),
        ),
        Text(
          '${(position / 1000).round()} / ${(duration / 1000).round()}s',
          style: const TextStyle(color: Colors.white, fontSize: 12),
        ),
      ],
    );
  }
}
