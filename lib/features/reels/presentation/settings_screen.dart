import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:permission_handler/permission_handler.dart';
import '../../../core/config/settings_repository.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({super.key});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  final _settings = SettingsRepository();
  late TextEditingController _urlController;
  late bool _isLocalMode;
  String? _localFolderPath;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: _settings.serverUrl);
    _isLocalMode = _settings.isLocalMode;
    _localFolderPath = _settings.localFolderPath;
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  Future<void> _pickFolder() async {
    // Request permissions
    bool hasPermission = false;
    if (await Permission.manageExternalStorage.request().isGranted) {
      hasPermission = true;
    } else if (await Permission.storage.request().isGranted) {
      hasPermission = true;
    }

    if (hasPermission) {
      String? selectedDirectory = await FilePicker.platform.getDirectoryPath();
      if (selectedDirectory != null) {
        setState(() {
          _localFolderPath = selectedDirectory;
        });
        await _settings.setLocalFolderPath(selectedDirectory);
      }
    } else {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Storage permission is required to pick a folder'))
        );
      }
    }
  }

  Future<void> _saveAndPop() async {
    await _settings.setServerUrl(_urlController.text);
    await _settings.setLocalMode(_isLocalMode);
    if (mounted) {
      Navigator.of(context).pop(true);
    }
  }

  @override
  Widget build(BuildContext context) {
    // Use PopScope for back button intercept (Android system back button)
    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        await _saveAndPop();
      },
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Settings'),
          backgroundColor: const Color(0xFF0A0A0F),
          leading: IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: _saveAndPop,
          ),
        ),
        body: ListView(
          padding: const EdgeInsets.all(16.0),
          children: [
            SwitchListTile(
              title: const Text('Local Folder Mode', style: TextStyle(color: Colors.white)),
              subtitle: const Text('Play videos directly from the device', style: TextStyle(color: Colors.grey)),
              activeColor: const Color(0xFFE040FB),
              value: _isLocalMode,
              onChanged: (val) {
                setState(() {
                  _isLocalMode = val;
                });
              },
            ),
            const Divider(color: Colors.grey),
            if (_isLocalMode) ...[
              ListTile(
                title: const Text('Local Folder Path', style: TextStyle(color: Colors.white)),
                subtitle: Text(_localFolderPath ?? 'No folder selected', style: const TextStyle(color: Colors.grey)),
                trailing: ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFE040FB)),
                  onPressed: _pickFolder,
                  child: const Text('Pick Folder', style: TextStyle(color: Colors.white)),
                ),
              ),
            ] else ...[
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 8.0),
                child: Text('Server URL', style: TextStyle(color: Colors.white, fontSize: 16)),
              ),
              TextField(
                controller: _urlController,
                style: const TextStyle(color: Colors.white),
                decoration: const InputDecoration(
                  hintText: 'http://10.0.2.2:3000/api',
                  hintStyle: TextStyle(color: Colors.grey),
                  enabledBorder: OutlineInputBorder(borderSide: BorderSide(color: Colors.grey)),
                  focusedBorder: OutlineInputBorder(borderSide: BorderSide(color: Color(0xFFE040FB))),
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Enter the full URL including /api. For emulator use http://10.0.2.2:3000/api. For physical device, use your machine IP like http://192.168.1.5:3000/api.',
                style: TextStyle(color: Colors.grey, fontSize: 12),
              )
            ],
          ],
        ),
      ),
    );
  }
}
