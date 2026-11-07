import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import '../../../core/config/local_folder_access.dart';
import '../../../core/config/settings_repository.dart';
import '../../reels/presentation/video_feed_screen.dart';
import 'login_screen.dart';

class ModeSelectionScreen extends StatefulWidget {
  const ModeSelectionScreen({super.key});

  @override
  State<ModeSelectionScreen> createState() => _ModeSelectionScreenState();
}

class _ModeSelectionScreenState extends State<ModeSelectionScreen> {
  final _settings = SettingsRepository();
  final _urlController = TextEditingController();
  bool _showNetworkInput = false;

  @override
  void initState() {
    super.initState();
    _urlController.text = _settings.serverUrl;
    if (kIsWeb) {
      _showNetworkInput = true;
    }
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _selectLocalMode() async {
    if (kIsWeb) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text(
              'Local Folder Mode is not supported on Web. Please use Network Mode.',
            ),
          ),
        );
      }
      return;
    }

    try {
      String? selectedDirectory = await LocalFolderAccess.pick();
      if (selectedDirectory != null) {
        await _settings.setLocalFolderPath(selectedDirectory);
        await _settings.setLocalMode(true);
        await _settings.setHasSelectedMode(true);
        if (mounted) {
          Navigator.of(context).pushReplacement(
            MaterialPageRoute(builder: (_) => const VideoFeedScreen()),
          );
        }
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not open the folder: $error')),
        );
      }
    }
  }

  Future<void> _selectNetworkMode() async {
    final url = _urlController.text.trim();
    if (url.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a server URL')),
      );
      return;
    }

    try {
      await _settings.setServerUrl(url);
    } on FormatException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text(error.message)));
      }
      return;
    }
    await _settings.setLocalMode(false);
    await _settings.setHasSelectedMode(true);

    if (mounted) {
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const LoginScreen()));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Select Mode'),
        backgroundColor: Theme.of(context).colorScheme.surface,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                kIsWeb ? 'Connect to Vibes Server' : 'Select Mode',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 48),

              if (!_showNetworkInput && !kIsWeb) ...[
                ElevatedButton.icon(
                  onPressed: _selectLocalMode,
                  icon: const Icon(
                    Icons.folder_outlined,
                    color: Colors.white,
                    size: 24.0,
                  ),
                  label: const Text(
                    'On this device',
                    style: TextStyle(fontSize: 16),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF3D81),
                    foregroundColor: const Color(0xFF211725),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Enjoy videos stored locally on your device. No account needed.',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),

                OutlinedButton.icon(
                  onPressed: () {
                    setState(() {
                      _showNetworkInput = true;
                    });
                  },
                  icon: const Icon(
                    Icons.dns_outlined,
                    color: Colors.white,
                    size: 24.0,
                  ),
                  label: const Text(
                    'Connect to my Vibes server',
                    style: TextStyle(fontSize: 16),
                  ),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: Theme.of(context).colorScheme.onSurface,
                    side: const BorderSide(color: Color(0xFFFF3D81)),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Stream and organize videos from your private media server.',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                  textAlign: TextAlign.center,
                ),
              ] else ...[
                const Text(
                  'Enter Server URL',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _urlController,
                  style: TextStyle(
                    color: Theme.of(context).colorScheme.onSurface,
                  ),
                  decoration: const InputDecoration(
                    hintText: 'http://10.0.2.2:3000/api',
                    hintStyle: TextStyle(color: Colors.grey),
                    border: OutlineInputBorder(),
                    focusedBorder: OutlineInputBorder(
                      borderSide: BorderSide(color: Color(0xFFFF3D81)),
                    ),
                    prefixIcon: Icon(
                      Icons.link,
                      color: Colors.grey,
                      size: 24.0,
                    ),
                  ),
                  keyboardType: TextInputType.url,
                ),
                const SizedBox(height: 8),
                const Text(
                  'e.g. http://192.168.1.5:3000/api',
                  style: TextStyle(color: Colors.grey, fontSize: 12),
                ),
                const SizedBox(height: 32),
                ElevatedButton(
                  onPressed: _selectNetworkMode,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFFF3D81),
                    foregroundColor: const Color(0xFF211725),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(8),
                    ),
                  ),
                  child: const Text(
                    'Continue to Login',
                    style: TextStyle(fontSize: 16),
                  ),
                ),
                const SizedBox(height: 16),
                if (!kIsWeb)
                  TextButton(
                    onPressed: () {
                      setState(() {
                        _showNetworkInput = false;
                      });
                    },
                    child: const Text('Back to Mode Selection'),
                  ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
