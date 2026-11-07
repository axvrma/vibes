import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hive_flutter/hive_flutter.dart';
import 'package:vibes/features/auth/presentation/mode_selection_screen.dart';

void main() {
  late Directory temp;
  setUp(() async {
    temp = await Directory.systemTemp.createTemp('vibes-modes');
    Hive.init(temp.path);
    await Hive.openBox('settingsData');
  });
  tearDown(() async {
    await Hive.close();
    await temp.delete(recursive: true);
  });
  testWidgets('explains both modes and renders at a narrow viewport', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(375, 812);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(const MaterialApp(home: ModeSelectionScreen()));
    expect(find.text('On this device'), findsOneWidget);
    expect(find.text('Connect to my Vibes server'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.tap(find.text('Connect to my Vibes server'));
    await tester.pumpAndSettle();
    expect(find.text('Continue to Login'), findsOneWidget);
    await tester.enterText(find.byType(TextField), 'ftp://bad.example/api');
    await tester.tap(find.text('Continue to Login'));
    await tester.pumpAndSettle();
    expect(find.textContaining('HTTP or HTTPS'), findsOneWidget);
  });
  testWidgets(
    'cancelled folder selection stays in onboarding without a broad permission request',
    (tester) async {
      var picked = false;
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(
            const MethodChannel('vibes/local-library'),
            (call) async {
              picked = call.method == 'pickFolder';
              return null;
            },
          );
      await tester.pumpWidget(const MaterialApp(home: ModeSelectionScreen()));
      await tester.tap(find.text('On this device'));
      await tester.pumpAndSettle();
      expect(picked, isTrue);
      expect(find.text('On this device'), findsOneWidget);
    },
  );
}
