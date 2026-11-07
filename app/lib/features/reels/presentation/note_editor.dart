import 'package:flutter/material.dart';
import 'package:hive_flutter/hive_flutter.dart';

abstract class NoteDraftStore {
  String? read(String key);
  Future<void> write(String key, String value);
  Future<void> remove(String key);
}

class HiveNoteDraftStore implements NoteDraftStore {
  Box get box => Hive.box('videoData');
  @override
  String? read(String key) => box.get(key);
  @override
  Future<void> write(String key, String value) => box.put(key, value);
  @override
  Future<void> remove(String key) => box.delete(key);
}

class NoteEditor extends StatefulWidget {
  final String title, initialNote, draftKey;
  final NoteDraftStore? drafts;
  final Future<void> Function(String) onSave;
  const NoteEditor({
    super.key,
    required this.title,
    required this.initialNote,
    required this.draftKey,
    required this.onSave,
    this.drafts,
  });
  @override
  State<NoteEditor> createState() => _NoteEditorState();
}

class _NoteEditorState extends State<NoteEditor> {
  late final TextEditingController _text;
  bool _saving = false;
  String? _error;
  late final NoteDraftStore store = widget.drafts ?? HiveNoteDraftStore();
  @override
  void initState() {
    super.initState();
    _text = TextEditingController(
      text: store.read(widget.draftKey) ?? widget.initialNote,
    );
    _text.addListener(_draft);
  }

  void _draft() {
    store.write(widget.draftKey, _text.text).catchError((Object error) {
      if (mounted) {
        setState(
          () => _error =
              'Could not persist this draft. Keep the editor open and retry saving.',
        );
      }
    });
  }

  @override
  void dispose() {
    _text.removeListener(_draft);
    _text.dispose();
    super.dispose();
  }

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await widget.onSave(_text.text);
      await store.remove(widget.draftKey);
      if (mounted) Navigator.pop(context, true);
    } catch (_) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error =
              'Could not save. Your draft is safe on this device. Retry when connected.';
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => SafeArea(
    child: Padding(
      padding: EdgeInsets.fromLTRB(
        24,
        24,
        24,
        24 + MediaQuery.viewInsetsOf(context).bottom,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'A note to yourself',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 8),
            Text(widget.title, maxLines: 2, overflow: TextOverflow.ellipsis),
            const SizedBox(height: 20),
            TextField(
              controller: _text,
              autofocus: true,
              minLines: 4,
              maxLines: 8,
              maxLength: 20000,
              readOnly: _saving,
              decoration: const InputDecoration(
                labelText: 'Your note',
                hintText: 'What would you like to remember?',
                border: OutlineInputBorder(),
              ),
            ),
            const SizedBox(height: 8),
            Text(
              _error ??
                  'Drafts stay on this device if you close before saving.',
              style: TextStyle(
                color: _error == null
                    ? null
                    : Theme.of(context).colorScheme.error,
              ),
            ),
            const SizedBox(height: 20),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _saving ? null : () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
                const SizedBox(width: 12),
                FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(
                    _saving
                        ? 'Saving…'
                        : _error == null
                        ? 'Save note'
                        : 'Retry save',
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    ),
  );
}
