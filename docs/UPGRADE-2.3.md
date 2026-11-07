# Vibes 2.3 upgrade and recovery

The supported topology remains `/app/` (Flutter), `/dashboard/` (Angular), `/api/` (Express) behind the gateway on loopback port **9001**. This guide changes checked-out configuration only; no deployment has been performed for you.

## Before upgrading

Record your current commit/image digests and Compose project name. The default project remains `vibes`; its existing `vibes_data` volume declaration is retained (normally Docker names it `vibes_vibes_data`). Do not change the project name or run `down -v` against your installation. Keep your media mounted read-only. Verify an optional drive really is mounted before enabling its override; a directory existing alone is insufficient evidence.

Use Node 22.17+ in the 22.x line for backend development (better-sqlite3 11). Angular remains 22.2, Tailwind 4 and Helm. Flutter web JavaScript is built and tested. The upgraded file picker passes the SDK Wasm dry run, but a Wasm runtime build has not been validated.

## Consistent backup

Create a host backup directory outside application data. With the new server image built, use SQLite's online backup API against your running database:

```sh
cd infra
docker compose exec server node dist/cli/backup.js /app/data/pre-2.3.db
docker compose cp server:/app/data/pre-2.3.db ./backups/pre-2.3.db
```

The **old** v2.2 image does not contain that CLI. Before its first upgrade, stop writes and take a cold backup instead:

```sh
mkdir -p backups
docker compose stop server
# Use your actual existing data-volume name; never select another installation's volume.
docker run --rm -v vibes_vibes_data:/source:ro -v "$PWD/backups:/backup" alpine \
  tar czf /backup/vibes-pre-2.3-data.tgz -C /source .
docker compose start server
```

Cold backups include SQLite, any WAL/SHM files, uploaded originals, thumbnails and application state. An online SQLite backup covers the database only; additionally back up uploads/thumbnails during a maintenance window for a consistent full restoration. Back up external originals independently; they are never copied into the Vibes volume. Do not copy an actively written `sqlite.db` alone. Migration snapshots now use `VACUUM INTO`, so committed WAL data is included.

## Configure and upgrade

```sh
cd infra
cp .env.example .env
# Edit .env with separate secrets, each generated using openssl rand -hex 32.
# Preserve the previous AUTH_* values if they were already configured.
# Set CORS_ORIGIN to the exact browser origin(s), no trailing slash.
# AUTH_COOKIE_SECURE=true for HTTPS; explicitly false for HTTP-only local testing.
docker compose config -q
docker compose up -d --build
docker compose exec server node dist/cli/create-admin.js
curl -fsS http://127.0.0.1:9001/api/health
```

Migrations 001–004 retain their history. New migration **005_media_libraries** adds libraries, scan jobs/errors and source metadata/indexes; existing videos default to uploaded/available. Existing video IDs and per-user state are unchanged. No migration removes media. A snapshot is created before applying 005. Upgrade app, dashboard and API together: bearer query parameters are intentionally no longer accepted.

Production startup requires explicit access-token and refresh-pepper secrets (32+ characters). Replacing previously implicit fallback values invalidates sessions; users log in again, while records remain. Do not print secrets or commit `.env`.

## Optional SSD library

```sh
# On the Docker host, verify this is the intended mounted drive:
findmnt /mnt/ssds/nas-drive
# Set MEDIA_HOST_PATH in .env if the path differs.
docker compose -f docker-compose.yml -f docker-compose.media.yml config -q
docker compose -f docker-compose.yml -f docker-compose.media.yml up -d --build
```

The override binds `/mnt/ssds/nas-drive/Media/Vibes:/media/vibes:ro` by default and refuses to create a missing host path. The application volume stays writable at `/app/data`. Optional indexing never runs automatically at startup and the base stack does not require the mount. If a drive is absent during container creation, omit the override to keep the base service available. Existing library records remain and refresh reports unavailable.

In Dashboard → Media Libraries, choose authorized root `vibes`, optionally a relative subfolder, then **Refresh Library**. Browser clients cannot submit host paths. To add roots, add explicit read-only mounts and extend the server's `MEDIA_ROOTS` JSON object (for example `{"vibes":"/media/vibes","archive":"/media/archive"}`). Configure these on the host, not in the browser. Library source identities are immutable. Removing configuration archives it; reconnecting the same root ID/relative path reuses its configuration and indexed identities.

A root's device/inode identity is pinned on its first successful access to prevent an unmounted drive's empty mountpoint from marking videos missing. An intentional replacement/remount whose identity changes requires operator review and reauthorization: stop scans, confirm the correct mount, back up the DB, then clear **only** that library's `root_device`/`root_inode` using SQLite before refreshing. This is an explicit operator operation, never automatic. A future UI reauthorization flow is not claimed.

Folder-based categories use the first folder under the library. Manual category/title overrides survive scans. MP4/MOV/MKV/WEBM/M4V/AVI containers may be indexed; browser codec support varies. Uploads preserve the existing MP4/H.264 contract. Nothing is automatically transcoded. Missing records, failed scans and cancelled scans never remove source files or personal state. An unambiguous matching content fingerprint, size and modification time can retain rename identity even if a mounted filesystem changes inodes. New/changed paths read at most the first/last 64 KiB for this fingerprint; unchanged paths are not hashed. Ambiguous candidates keep separate records. Moves across libraries are not matched.

## Nginx Proxy Manager / TLS

Keep the loopback gateway binding `127.0.0.1:9001:80`. Point a TLS-terminating proxy at that port on the Docker host. A proxy in a separate container cannot reach the host's loopback through its own `127.0.0.1`; use an explicitly shared private network or a deliberately restricted host interface instead. Never expose an internal bind accidentally. Set `Host` and `X-Forwarded-Proto` accurately. The gateway forwards upload/range requests without buffering; TLS proxy upload limits and 300-second timeouts must also allow your chosen upload sizes. Use `https://vibes.axvrma.com` only if it is actually your deployment hostname and set `CORS_ORIGIN` accordingly.

Only trust proxy headers from your configured proxy/network. The base API is not host-published. Media is authorized with bearer headers on native clients and ten-minute per-video/per-kind tickets in browsers. Tickets are bearer capabilities: avoid sharing them. API/gateway logs omit query strings; thumbnails are privately cached. Dashboard refresh cookies are HttpOnly, SameSite=Strict and Secure by default; authentication mutations also check Origin/Fetch Metadata. Other mutations require an Authorization header, so cookies do not authorize them.

Static app/dashboard assets use SPA fallbacks. HTML should be revalidated on deploy; hashed assets can be cached. Avoid caching authenticated `/api` responses at an external proxy. Configure HSTS at your TLS edge only after confirming HTTPS works. No certificate or DNS change is automated here.

## Rollback

Stop the stack without deleting volumes. Preserve the failed-upgrade data as a second backup. Restore the pre-upgrade **full cold archive** into the same application volume, then return to the recorded v2.2 commit/images and matching configuration. Restore only while the API is stopped. Do not mix a restored DB with a different set of uploads. Do not run v2.2 against a DB whose downgrade compatibility you have not verified. An online DB-only backup requires the corresponding media backup. External read-only originals are unaffected. Post-backup metadata changes are lost on restoration, so export or preserve the current DB before rollback.

## Validation commands

```sh
cd server && npm ci && npm run build && npm test
cd ../dashboard && npm ci && npm run build
CHROME_BIN=/path/to/chrome npm test -- --watch=false --browsers=ChromeHeadless
cd ../app && flutter pub get && flutter analyze && flutter test
flutter build web --base-href /app/ --dart-define=API_URL=/api
cd ../website && npm ci && npm run check && npm run test:e2e
cd .. && node scripts/benchmark.mjs
# Build images under this disposable project name before the isolated integration test:
docker compose -p vibes-23-validation -f infra/docker-compose.yml build
CHROME_PATH=/path/to/chrome node scripts/docker-smoke.mjs
```

The integration test creates and removes only its own uniquely named containers, network and disposable volume. It never uses `vibes_data` or your external media. See `VALIDATION-2.3.md` for actual results and limitations.
