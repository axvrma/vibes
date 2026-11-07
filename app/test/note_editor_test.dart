import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:vibes/features/reels/presentation/note_editor.dart';

class MemoryDrafts implements NoteDraftStore {
  final values = <String, String>{};
  @override
  String? read(String key) => values[key];
  @override
  Future<void> write(String key, String value) async {
    values[key] = value;
  }

  @override
  Future<void> remove(String key) async {
    values.remove(key);
  }
}

void main() {
  testWidgets(
    'restores drafts, retains failed saves, and retries successfully',
    (tester) async {
      final drafts = MemoryDrafts();
      drafts.values['draft'] = 'Unsent thought';
      var attempts = 0;
      String? saved;
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: NoteEditor(
              title: 'A video',
              initialNote: 'Old note',
              draftKey: 'draft',
              drafts: drafts,
              onSave: (text) async {
                attempts++;
                if (attempts == 1) throw Exception('offline');
                saved = text;
              },
            ),
          ),
        ),
      );
      expect(find.text('Unsent thought'), findsOneWidget);
      await tester.enterText(find.byType(TextField), 'My thought');
      await tester.tap(find.text('Save note'));
      await tester.pumpAndSettle();
      expect(find.textContaining('Your draft is safe'), findsOneWidget);
      expect(drafts.read('draft'), 'My thought');
      await tester.tap(find.text('Retry save'));
      await tester.pumpAndSettle();
      expect(saved, 'My thought');
      expect(drafts.read('draft'), isNull);
    },
  );
  testWidgets('keeps unsaved text across editor disposal', (tester) async {
    final drafts = MemoryDrafts();
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: NoteEditor(
            title: 'Video',
            initialNote: '',
            draftKey: 'draft',
            drafts: drafts,
            onSave: (_) async {},
          ),
        ),
      ),
    );
    await tester.enterText(find.byType(TextField), 'Do not lose this');
    await tester.pumpWidget(const SizedBox());
    expect(drafts.read('draft'), 'Do not lose this');
  });
}
