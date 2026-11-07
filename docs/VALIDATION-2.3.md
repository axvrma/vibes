# Vibes 2.3 validation and release assessment

Validation date: **5 November 2026**, Asia/Kolkata. Baseline and starting HEAD: **2d99f038eca82901bd787eb697017c9aa4570941**. The initial working tree was clean. No later commit or user edit was discarded. This is a local release candidate, not a published release or a claim of general production readiness.

## Baseline findings

The existing media_kit/Hive architecture, two Flutter modes, Angular 22/Tailwind 4/Helm, Express/SQLite, upload implementation, gateway/volume and mature React website were retained. Audit/matrix: [V2.3-AUDIT.md](V2.3-AUDIT.md).

- Website baseline: typecheck/lint, 10 unit tests, production build/prerender passed.
- Flutter baseline: the existing single extension test passed. Dependency resolution updated the lock to versions compatible with installed Flutter 3.41.6/Dart 3.11.4.
- Dashboard baseline: production build passed with a 699.08 kB initial-bundle budget warning. Tests could not compile: stale starter assertions, missing culori/date-fns dependencies.
- Backend baseline validation initially failed: better-sqlite3 11 cannot compile under Node 26. Node 22.17 was used instead. Original API smoke tests also assumed unauthenticated access; replaced with real authenticated tests on disposable databases.
- Native Android validation exposed a missing Kotlin plugin and an obsolete file-picker plugin lacking an Android namespace. Both were fixed; no framework was changed.

## Completed checks

| Surface/check                               | Result                   | Scope                                                                                                                                                                                                                    |
| ------------------------------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Backend TypeScript build                    | Passed                   | Node 22.17, strict TypeScript, Express/SQLite retained.                                                                                                                                                                  |
| Backend tests                               | **34 passed**, 4 files   | Real auth/API/ranges/state/tickets, scanner fault handling, CLI and populated v2.2-shaped migration/idempotence.                                                                                                         |
| Angular production build                    | Passed                   | Angular 22.2, Helm/Tailwind retained; lazy feature routes. Initial bundle ~715 kB, existing 500 kB warning remains.                                                                                                      |
| Dashboard ChromeHeadless tests              | **53 passed**            | Existing shared tests plus shell, authorized-root forms and scan failures; stale starter assertions repaired.                                                                                                            |
| Flutter analyzer                            | Passed, **no issues**    | App and regression tests.                                                                                                                                                                                                |
| Flutter tests                               | **13 passed**            | Notes drafts/save/retry, local recursion/identity/state/missing folders, paginated queries, filtering, session retry, offline metadata, mode selection/narrow layout and existing extension test.                        |
| Flutter web production build                | Passed                   | `/app/` base, `/api`, JavaScript build; SDK Wasm dry run succeeds but Wasm runtime not tested.                                                                                                                           |
| Android debug APK                           | Passed                   | Actual Gradle/Kotlin build after dependency/plugin fixes. Not release-signed or hardware-tested.                                                                                                                         |
| Website typecheck/lint/unit/build/prerender | Passed                   | **10 unit tests**, original hero and interactive previews preserved.                                                                                                                                                     |
| Website Playwright                          | **23 passed, 3 skipped** | Existing intentional input-method skips; Chromium desktop/mobile, axe AA checks, notes dialog, responsive widths and video interactions.                                                                                 |
| Base + media-override Compose configuration | Passed                   | Checked with disposable test secrets; optional host path is not created automatically.                                                                                                                                   |
| Docker API/dashboard/Flutter image builds   | Passed                   | Separate `vibes-23-validation` image project.                                                                                                                                                                            |
| Real Docker/browser integration             | Passed                   | 17 check groups, uniquely named disposable network/volume/containers, real FFmpeg/FFprobe and sample MP4.                                                                                                                |
| Brand assets                                | Passed                   | 9 SVG masters parsed; 35 Apple launcher exports checked for expected dimensions and no alpha; Windows/dashboard ICO containers verified. Adaptive Android and splash resources generated through existing Flutter tools. |
| Dependency audit                            | Runtime **0 findings**   | Server all dependencies: 0. Dashboard runtime: 0. Website runtime: 0. Dashboard development dependencies: 14 moderate + 2 high, principally Spartan CLI/Nx/Zod tooling, not shipped in the static image.                 |
| Whitespace validation                       | Passed                   | `git diff --check`.                                                                                                                                                                                                      |

The Docker integration exercises gateway health/SPA routes, real external import and folder categories, scoped thumbnail/Range playback, rejected query access tokens, duplicate refresh, archive/reconnect, rename identity, likes/notes preservation, online SQLite backup, restart persistence, missing files, actual MP4/H.264 upload/playback and OS-enforced read-only mounts. Browser checks sign in to the real dashboard, search/filter, open details, test a 375-pixel layout and reject unauthenticated administrative navigation. Flutter web onboarding is exercised through browser semantics and excludes unsupported local-folder mode.

The browser network check found and fixed default Flutter CDN access. Renderer files, bundled Inter and engine-fallback Roboto now load from this deployment; the onboarding check observes **zero external resource requests**. Additional script/glyph font coverage requires local font assets. The web viewport permits zoom.

Screenshots in [screenshots/](screenshots/) are actual disposable-test applications, not invented product screens. The marketing site's screenshot explicitly labels the sample-data environment. No production deployment, DNS, TLS configuration, user volume or real media was changed.

## Performance evidence

`node scripts/benchmark.mjs` creates a disposable database and 2,000 synthetic, already-indexed 128-byte files. It measures unchanged-file scanning and 100 bounded 48-item queries, not initial indexing, media decoding or a full production library.

Last run on Apple M1 Pro, arm64 macOS, Node 22.17:

- Unchanged scan: **1,999 ms**, all 2,000 files skipped; **0 probes / 0 thumbnail generations**.
- Query median: **0.69 ms**; p95: **1.78 ms**.
- Process RSS: **75.7 MB** (not peak memory).
- An earlier run measured 1,396 ms / 0.70 ms median / 1.79 ms p95. Concurrent builds affect these local results; these are repeated observations, not a claimed speedup.
- Actual single-clip Docker import in the repeated fingerprint integration: **102 ms**; unchanged repeat: **7 ms** in the final privacy integration run. These are small-fixture observations, not drive-throughput guarantees.
- Removed the previous six-icon dependency's **1,993,404-byte** web font; standard Flutter icons and the vector-derived mark now serve those uses. The new UI additionally bundles Inter/Roboto; this is an asset-specific reduction, not a claim that every total bundle shrank.
- Angular initial output grew from ~699 kB to ~715 kB with added capabilities; the budget warning is disclosed. No initial-load speedup claimed.

The feed now disposes old controllers immediately, keeps at most three neighboring controllers, and sequences pause-before-play operations. These bounds are code-level controls, not hardware frame-time, initialization-latency or background-audio benchmark results. Native memory, frame stability, orientation, audio sessions and lifecycle restoration still require platform profiling.

## Known limits and release blockers

1. **General release blocker:** iOS/macOS builds and native permissions/playback have not been validated because Xcode is incomplete. Windows/Linux binaries and real-device Android/iOS background audio, orientation, lifecycle and codec behavior remain unverified. Android debug compilation and web onboarding do not establish hardware readiness.
2. No signed release packages, store submission, deployed TLS/Nginx Proxy Manager install, Safari/Firefox testing or current Lighthouse score is claimed. Historical website Lighthouse numbers remain historical.
3. A missing drive is handled conservatively. Intentional root identity changes need operator reauthorization described in the upgrade guide. Cross-filesystem moves cannot reliably preserve identity; bounded external/local fingerprints may conflate same-size files with identical first/last 64 KiB. Android document identity depends on its provider.
4. Scan queue is single-process/single-server. One job runs at a time; at most two media subprocesses run including uploads. Cancellation waits for a safe boundary or processing timeout. Scan history/error retention is currently unbounded in SQLite; UI history retrieves the latest 30 jobs and errors are paginated 100 at a time.
5. Libraries are refreshed explicitly. No filesystem watchers, scheduled scans, transcoding or resumable uploads are implemented or advertised. Browser codec support varies. Local desktop thumbnails need an installed ffmpeg on Windows/Linux; native thumbnail/scoped-folder code on Apple awaits device validation.
6. Downloads are manual; there is no automatic download policy or Wi-Fi scheduler. Existing downloads are preserved; the configured limit applies to new downloaded video copies. Offline copies cannot be remotely revoked. Network progress sync is best effort; local progress remains in Hive. Notes preserve failed/unsaved drafts locally for retry.
7. Ten-minute scoped media tickets remain bearer capabilities until expiry unless account activation/visibility changes. Long playback that opens a new request after expiry may need the playback Retry action to obtain a fresh ticket. General API operations cannot use tickets.
8. Pagination is bounded offset pagination, so concurrent additions can shift pages. Refresh reconciles it; no cursor-stability guarantee.
9. The dashboard's development dependency audit findings and initial-bundle warning remain maintenance work. They are separate from the clean runtime audit. No claim of zero findings across every development tool is made.

Assessment: **implemented and locally validated as a 2.3 release candidate; not approved as a generally production-ready cross-platform release.** Complete the native platform/hardware matrix and deployment acceptance checks before promoting it. [Upgrade, backups and rollback](UPGRADE-2.3.md), [API contracts](API-2.3.md) and [release notes](RELEASE-2.3.0.md) provide the operational handoff.
