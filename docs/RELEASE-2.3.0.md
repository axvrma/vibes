# Vibes 2.3.0 release candidate

Vibes — Your Private Video Universe. Your space. Your stories. Your vibe.

- Adds administrator-configured external libraries, read-only trusted roots, a persistent single-worker scan queue, incremental processing, per-file errors, cancellation/history, restart recovery and conservative missing-media handling.
- Adds migration 005, preserving uploaded IDs, user state and the existing data volume. Renames retain identity when a bounded content fingerprint, size and modification time identify one missing prior source, including mounted filesystems that change inodes. Configuration removal archives records and reconnection reuses them.
- Replaces URL access tokens with scoped short-lived media tickets in browsers; native bearer headers remain. Fixes inactive-user access, malformed HTTP ranges and partial state updates that erased likes/notes/progress.
- Adds paginated server search, source/category/tag/availability filters, personal favorites and continue-watching collections. Dashboard gains overview, Media Libraries, grid/table layouts, bulk category assignment, editable details, consistent Helm dialogs, upload failure retry and a theme setting.
- Flutter keeps both modes, adds recursive discovery, stable bounded-content local fingerprints, persisted local state, system-scoped folder access, a draft-preserving notes editor, personal library and adaptive navigation. Playback stays on media_kit with bounded controller disposal, sequential pause/play changes, seek/replay/mute/speed and keyboard support.
- Preserves the marketing hero/demo and original rose/violet brand. Adds canonical tokens, vector logo variants, platform launchers/splash artwork, licensed local Inter fonts and accurate acquisition-mode/library explanations.
- Preserves `/app/`, `/dashboard/`, `/api/`, the gateway and loopback port 9001. Adds health checks, safe optional mounts, online backup CLI and upgrade/rollback instructions.

Compatibility: upgrade clients and API together; query-string access tokens are no longer accepted. Explicit production secrets and exact browser origins are required. Existing users may need to sign in again if previous deployments used fallback secrets. No resumable uploads, transcoding, scheduled scans, public social features, or deployment are claimed.

Release status and blockers are recorded in `VALIDATION-2.3.md`. Native hardware, background playback, performance and permissions require their respective platform validation before a general production release.
