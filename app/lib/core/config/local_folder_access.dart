import 'dart:io';
import 'package:path_provider/path_provider.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:file_picker/file_picker.dart';

class LocalFolderAccess {
  static const channel = MethodChannel('vibes/local-library');
  static Future<String?> pick() async {
    if (kIsWeb) throw UnsupportedError('Use Network Mode in a browser.');
    if (Platform.isAndroid || Platform.isIOS || Platform.isMacOS) {
      return channel.invokeMethod<String>('pickFolder');
    }
    return FilePicker.platform.getDirectoryPath();
  }

  static Future<String?> thumbnail(String id, Uri uri) async {
    if (kIsWeb) return null;
    try {
      if (Platform.isAndroid || Platform.isIOS || Platform.isMacOS) {
        return await channel.invokeMethod<String>('thumbnail', {
          'id': id,
          'uri': uri.toString(),
        });
      }
      final folder = Directory(
        '${(await getTemporaryDirectory()).path}/vibes-thumbnails',
      );
      await folder.create(recursive: true);
      final output = File('${folder.path}/$id.jpg');
      if (await output.exists()) return output.path;
      final process = await Process.start('ffmpeg', [
        '-nostdin',
        '-v',
        'error',
        '-i',
        uri.toFilePath(),
        '-frames:v',
        '1',
        '-vf',
        'scale=480:-2',
        output.path,
      ]);
      process.stdout.drain<void>();
      process.stderr.drain<void>();
      final code = await process.exitCode.timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          process.kill();
          return -1;
        },
      );
      if (code == 0 && await output.exists()) return output.path;
    } catch (_) {}
    return null;
  }

  static Future<void> restore() async {
    if (!kIsWeb && (Platform.isIOS || Platform.isMacOS)) {
      await channel.invokeMethod<void>('restoreAccess');
    }
  }
}
