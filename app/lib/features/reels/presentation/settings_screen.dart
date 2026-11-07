import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../../../core/config/local_folder_access.dart';
import '../../../core/config/settings_repository.dart';
import '../../auth/data/auth_repository.dart';
import '../../auth/presentation/mode_selection_screen.dart';
import '../data/video_cache_manager.dart';
import 'package:dio/dio.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _settings = SettingsRepository();
  late TextEditingController _urlController;
  late bool _isLocalMode;
  late bool _isDarkMode;
  String? _localFolderPath;
  bool _canPop = false;
  int _cacheBytes = 0;
  final _cache = VideoCacheManager();

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: _settings.serverUrl);
    _isLocalMode = _settings.isLocalMode;
    _isDarkMode = _settings.isDarkMode;
    _localFolderPath = _settings.localFolderPath;
    if (!kIsWeb) {
      _cache.sizeBytes().then((bytes) {
        if (mounted) setState(() => _cacheBytes = bytes);
      });
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _pickFolder() async {
    if (kIsWeb) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Local Folder Mode is not supported on Web.'),
          ),
        );
      }
      return;
    }

    // Request permissions
    try {
      String? selectedDirectory = await LocalFolderAccess.pick();
      if (selectedDirectory != null) {
        setState(() {
          _localFolderPath = selectedDirectory;
        });
        await _settings.setLocalFolderPath(selectedDirectory);
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open the folder: $error')),
        );
      }
    }
  }

  Future<void> _saveAndPop() async {
    if (!_isLocalMode) await _settings.setServerUrl(_urlController.text);
    await _settings.setLocalMode(_isLocalMode);
    if (mounted) {
      setState(() => _canPop = true);
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) Navigator.of(context).pop(true);
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    // Use PopScope for back button intercept (Android system back button)
    return PopScope(
      canPop: _canPop,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _saveAndPop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Settings'),
          leading: IconButton(
            icon: Icon(
              Icons.arrow_back,
              color:
                  Theme.of(context).appBarTheme.foregroundColor ?? Colors.white,
              size: 24.0,
            ),
            onPressed: _saveAndPop,
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            SwitchListTile(
              title: const Text('App Theme (Dark Mode)'),
              subtitle: const Text(
                'Toggle between light and dark theme',
                style: TextStyle(color: Colors.grey),
              ),
              activeThumbColor: const Color(0xFFFF3D81),
              value: _isDarkMode,
              onChanged: (val) async {
                setState(() {
                  _isDarkMode = val;
                });
                await _settings.setIsDarkMode(val);
              },
            ),
            SwitchListTile(
              title: const Text('Include local subfolders'),
              subtitle: const Text(
                'Discover videos recursively when refreshing this device’s folder.',
              ),
              value: _settings.recursiveLocalScan,
              onChanged: (value) async {
                await _settings.setRecursiveLocalScan(value);
                setState(() {});
              },
            ),
            const Divider(color: Colors.grey),
            if (!kIsWeb) ...[
              SwitchListTile(
                title: const Text('On this device'),
                subtitle: const Text(
                  'Play videos directly from the device',
                  style: TextStyle(color: Colors.grey),
                ),
                activeThumbColor: const Color(0xFFFF3D81),
                value: _isLocalMode,
                onChanged: (val) {
                  setState(() {
                    _isLocalMode = val;
                  });
                },
              ),
              const Divider(color: Colors.grey),
            ],
            if (_isLocalMode) ...[
              ListTile(
                title: const Text('Local Folder Path'),
                subtitle: Text(
                  _localFolderPath ?? 'No folder selected',
                  style: const TextStyle(color: Colors.grey),
                ),
                trailing: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF3D81),
                  ),
                  onPressed: _pickFolder,
                  child: const Text(
                    'Pick Folder',
                    style: TextStyle(color: Color(0xFF211725)),
                  ),
                ),
              ),
            ] else ...[
              ListTile(
                title: const Text('Connection diagnostics'),
                subtitle: const Text(
                  'Check whether your configured Vibes API is reachable.',
                ),
                trailing: TextButton(
                  onPressed: () async {
                    String message;
                    try {
                      await _settings.setServerUrl(_urlController.text);
                      final response = await Dio(
                        BaseOptions(
                          connectTimeout: const Duration(seconds: 8),
                          receiveTimeout: const Duration(seconds: 8),
                        ),
                      ).get('${_settings.serverUrl}/health');
                      message =
                          response.data is Map &&
                              response.data['status'] == 'ok'
                          ? 'Connected to Vibes ${response.data['version'] ?? ''}.'
                          : 'The server responded, but its health endpoint was unexpected.';
                    } catch (_) {
                      message =
                          'Could not reach your Vibes API. Check the server URL, network, TLS certificate and /api gateway routing.';
                    }
                    if (!context.mounted) return;
                    showDialog<void>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Connection status'),
                        content: Text(message),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context),
                            child: const Text('Close'),
                          ),
                        ],
                      ),
                    );
                  },
                  child: const Text('Check server'),
                ),
              ),
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0),
                child: Text('Server URL', style: TextStyle(fontSize: 16)),
              ),
              TextField(
                controller: _urlController,
                decoration: const InputDecoration(
                  hintText: 'http://10.0.2.2:3000/api',
                  hintStyle: TextStyle(color: Colors.grey),
                  enabledBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: Colors.grey),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderSide: BorderSide(color: Color(0xFFFF3D81)),
                  ),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter the full URL including /api. For emulator use http://10.0.2.2:3000/api. For physical device, use your machine IP like http://192.168.1.5:3000/api.',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              ),
            ],
            if (!kIsWeb) ...[
              const Divider(),
              ListTile(
                title: const Text('Downloaded videos'),
                subtitle: Text(
                  '${(_cacheBytes / 1048576).toStringAsFixed(1)} MB stored on this device. Downloads are manual; no background downloads.',
                ),
                trailing: TextButton(
                  onPressed: () async {
                    final remove = await showDialog<bool>(
                      context: context,
                      builder: (context) => AlertDialog(
                        title: const Text('Remove downloaded copies?'),
                        content: const Text(
                          'Your originals and personal notes stay safe. Only downloaded video copies on this device are removed.',
                        ),
                        actions: [
                          TextButton(
                            onPressed: () => Navigator.pop(context, false),
                            child: const Text('Cancel'),
                          ),
                          FilledButton(
                            onPressed: () => Navigator.pop(context, true),
                            child: const Text('Remove downloads'),
                          ),
                        ],
                      ),
                    );
                    if (remove == true) {
                      await _cache.clearDownloads();
                      if (mounted) setState(() => _cacheBytes = 0);
                    }
                  },
                  child: const Text('Manage cache'),
                ),
              ),
              ListTile(
                title: const Text('Cache limit'),
                trailing: DropdownButton<int>(
                  value: _settings.cacheLimitMb,
                  items: [
                    for (final mb in [256, 512, 1024, 2048, 4096])
                      DropdownMenuItem(value: mb, child: Text('$mb MB')),
                  ],
                  onChanged: (value) async {
                    if (value != null) {
                      await _settings.setCacheLimitMb(value);
                      setState(() {});
                    }
                  },
                ),
              ),
            ],
            const SizedBox(height: 32),
            if (!kIsWeb)
              ElevatedButton.icon(
                onPressed: () async {
                  await _settings.setHasSelectedMode(false);
                  await AuthRepository().logout();
                  if (context.mounted) {
                    Navigator.of(context).pushAndRemoveUntil(
                      MaterialPageRoute(
                        builder: (_) => const ModeSelectionScreen(),
                      ),
                      (route) => false,
                    );
                  }
                },
                icon: const Icon(
                  Icons.swap_horiz,
                  color: Colors.redAccent,
                  size: 24.0,
                ),
                label: const Text('Change App Mode'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.redAccent.withValues(alpha: 0.2),
                  foregroundColor: Colors.redAccent,
                  side: const BorderSide(color: Colors.redAccent),
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
