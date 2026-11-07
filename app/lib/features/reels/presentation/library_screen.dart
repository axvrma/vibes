import 'dart:async';
import 'dart:io';
import '../../../core/config/local_folder_access.dart';
import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';
import '../../../core/config/settings_repository.dart';
import '../data/local_video_repository.dart';
import '../data/server_video_repository.dart';
import '../domain/video_item.dart';

class LibraryScreen extends StatefulWidget {
  final bool favorites;
  const LibraryScreen({super.key, this.favorites = false});
  @override
  State<LibraryScreen> createState() => _LibraryScreenState();
}

class _LibraryScreenState extends State<LibraryScreen> {
  final _server = ServerVideoRepository();
  final _search = TextEditingController();
  List<VideoItem> _videos = [];
  bool _loading = true, _grid = true, _more = false;
  int _page = 1;
  String _collection = 'all', _error = '', _category = '', _tag = '';
  List<Map<String, dynamic>> _categories = [], _tags = [];
  final Map<String, Future<Uri>> _previews = {};
  final Map<String, Future<String?>> _localPreviews = {};
  Timer? _debounce;
  int _generation = 0;
  bool get _local => SettingsRepository().isLocalMode;
  @override
  void initState() {
    super.initState();
    _collection = widget.favorites ? 'favorites' : 'all';
    _load();
    if (!_local) _filters();
  }

  Future<void> _filters() async {
    try {
      final result = await _server.libraryFilters();
      if (mounted) {
        setState(() {
          _categories = result['categories']!;
          _tags = result['tags']!;
        });
      }
    } catch (_) {}
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load({bool more = false}) async {
    final gen = ++_generation;
    if (!more) {
      _page = 1;
      _previews.clear();
    }
    setState(() {
      _loading = true;
      _error = '';
    });
    try {
      var result = _local
          ? await LocalVideoRepository().getVideos()
          : await _server.getPage(
              page: _page,
              filters: {
                'search': _search.text.trim(),
                'collection': _collection,
                if (_category.isNotEmpty) 'categoryId': _category,
                if (_tag.isNotEmpty) 'tagId': _tag,
                'availability': 'available',
              },
            );
      if (_local) {
        result = result.where((v) {
          final state = Hive.box(
            'videoData',
          ).get('video_${v.id}', defaultValue: <String, dynamic>{});
          return v.title.toLowerCase().contains(_search.text.toLowerCase()) &&
              (_collection != 'favorites' || state['liked'] == true) &&
              (_collection != 'continue' ||
                  (state['progressSeconds'] ?? 0) > 0);
        }).toList();
      }
      if (!mounted || gen != _generation) return;
      setState(() {
        _videos = more ? [..._videos, ...result] : result;
        _more = !_local && _server.hasMore;
        _loading = false;
      });
    } catch (_) {
      if (mounted && gen == _generation) {
        setState(() {
          _error =
              'Your library is unavailable. Check your connection or folder access, then retry.';
          _loading = false;
        });
      }
    }
  }

  void _changed() {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () => _load());
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: Text(widget.favorites ? 'Favorites' : 'Your library'),
      actions: [
        IconButton(
          tooltip: _grid ? 'List view' : 'Grid view',
          onPressed: () => setState(() => _grid = !_grid),
          icon: Icon(_grid ? Icons.view_list : Icons.grid_view),
        ),
        IconButton(
          tooltip: 'Refresh library',
          onPressed: () => _load(),
          icon: const Icon(Icons.refresh),
        ),
      ],
    ),
    body: SafeArea(
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: _search,
                  onChanged: (_) => _changed(),
                  decoration: const InputDecoration(
                    labelText: 'Search your videos',
                    prefixIcon: Icon(Icons.search),
                    border: OutlineInputBorder(),
                  ),
                ),
                const SizedBox(height: 12),
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      for (final entry in {
                        'all': 'All videos',
                        'favorites': 'Favorites',
                        'continue': 'Continue watching',
                        if (!_local) 'recent': 'Recently added',
                      }.entries)
                        Padding(
                          padding: const EdgeInsets.only(right: 8),
                          child: ChoiceChip(
                            label: Text(entry.value),
                            selected: _collection == entry.key,
                            onSelected: (_) {
                              setState(() => _collection = entry.key);
                              _load();
                            },
                          ),
                        ),
                      if (!_local) ...[
                        DropdownButton<String>(
                          value: _category,
                          hint: const Text('Category'),
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('All categories'),
                            ),
                            for (final cat in _categories)
                              DropdownMenuItem(
                                value: cat['id'],
                                child: Text(cat['name']),
                              ),
                          ],
                          onChanged: (value) {
                            setState(() => _category = value ?? '');
                            _load();
                          },
                        ),
                        const SizedBox(width: 12),
                        DropdownButton<String>(
                          value: _tag,
                          items: [
                            const DropdownMenuItem(
                              value: '',
                              child: Text('All tags'),
                            ),
                            for (final tag in _tags)
                              DropdownMenuItem(
                                value: tag['id'],
                                child: Text(tag['name']),
                              ),
                          ],
                          onChanged: (value) {
                            setState(() => _tag = value ?? '');
                            _load();
                          },
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (_error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                children: [
                  Text(_error),
                  TextButton(
                    onPressed: () => _load(),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
          if (_loading) const LinearProgressIndicator(),
          Expanded(
            child: !_loading && _videos.isEmpty
                ? const Center(
                    child: Text('No videos here yet. Try another filter.'),
                  )
                : LayoutBuilder(
                    builder: (context, constraints) {
                      if (!_grid) {
                        return ListView.builder(
                          itemCount: _videos.length,
                          itemBuilder: (context, index) =>
                              _tile(_videos[index]),
                        );
                      }
                      final columns = (constraints.maxWidth / 240)
                          .floor()
                          .clamp(2, 6);
                      return GridView.builder(
                        padding: const EdgeInsets.all(16),
                        gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                          crossAxisCount: columns,
                          childAspectRatio: 1.1,
                          crossAxisSpacing: 12,
                          mainAxisSpacing: 12,
                        ),
                        itemCount: _videos.length,
                        itemBuilder: (context, index) {
                          final v = _videos[index];
                          return Card(
                            clipBehavior: Clip.antiAlias,
                            child: InkWell(
                              onTap: () => Navigator.pop(context, v),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Expanded(child: _preview(v)),
                                  Padding(
                                    padding: const EdgeInsets.all(12),
                                    child: Text(
                                      v.title,
                                      maxLines: 2,
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      );
                    },
                  ),
          ),
          if (_more)
            Padding(
              padding: const EdgeInsets.all(12),
              child: FilledButton(
                onPressed: _loading
                    ? null
                    : () {
                        _page++;
                        _load(more: true);
                      },
                child: const Text('Load more'),
              ),
            ),
        ],
      ),
    ),
  );
  Widget _tile(VideoItem v) => ListTile(
    leading: SizedBox(width: 80, child: _preview(v)),
    title: Text(v.title),
    subtitle: Text(
      '${(v.sizeBytes / 1e6).toStringAsFixed(1)} MB · ${_local
          ? 'On this device'
          : v.sourceType == 'external'
          ? 'Server library'
          : 'Uploaded'}',
    ),
    onTap: () => Navigator.pop(context, v),
  );
  Widget _preview(VideoItem v) {
    if (_local) {
      return FutureBuilder<String?>(
        future: _localPreviews.putIfAbsent(
          v.id,
          () => LocalFolderAccess.thumbnail(v.id, v.streamUrl),
        ),
        builder: (context, snapshot) => snapshot.data != null
            ? Image.file(
                File(snapshot.data!),
                fit: BoxFit.cover,
                errorBuilder: (_, _, _) => const Icon(Icons.movie_outlined),
              )
            : Semantics(
                label: 'Local video',
                child: Container(
                  color: Theme.of(context).colorScheme.surfaceContainerHighest,
                  child: const Center(
                    child: Icon(Icons.movie_outlined, size: 36),
                  ),
                ),
              ),
      );
    }
    return FutureBuilder<Uri>(
      future: _previews.putIfAbsent(
        v.id,
        () => _server.mediaUri(v, 'thumbnail'),
      ),
      builder: (context, snapshot) => snapshot.hasData
          ? Image.network(
              snapshot.data.toString(),
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) => const Icon(Icons.movie_outlined),
            )
          : const Center(child: Icon(Icons.movie_outlined)),
    );
  }
}
