import db from "../db";
import path from "path";
import fs from "fs/promises";
import { randomUUID, createHash } from "crypto";
import { AppError } from "../middleware/error-handler";
import { inspectVideo, generateThumbnail } from "./media-processor";
import { libraryPath, openBeneath, mediaTypes } from "./media-paths";
import { videoRepo, VideoRecord } from "../db/repository";

export interface MediaLibrary {
  id: string;
  name: string;
  root_id: string;
  relative_path: string;
  enabled: number;
  archived: number;
  root_device: string | null;
  root_inode: string | null;
  recursive: number;
  folder_categories: number;
  default_category_id: string | null;
  created_at: string;
  updated_at: string;
}
export interface ScanJob {
  id: string;
  library_id: string;
  status: string;
  cancel_requested: number;
  discovered_count: number;
  added_count: number;
  updated_count: number;
  skipped_count: number;
  missing_count: number;
  failed_count: number;
  started_at: string | null;
  completed_at: string | null;
  duration_ms: number | null;
  error_summary: string | null;
}
const now = () => new Date().toISOString();
export const getLibrary = (id: string) =>
  db.prepare("SELECT * FROM media_libraries WHERE id=?").get(id) as
    MediaLibrary | undefined;
export const getJob = (id: string) =>
  db.prepare("SELECT * FROM scan_jobs WHERE id=?").get(id) as
    ScanJob | undefined;
let working = false,
  stopping = false;
let activeTask: Promise<void> | undefined;
export function recoverScans() {
  db.prepare(
    "UPDATE scan_jobs SET status='interrupted', completed_at=?, error_summary='Server restarted; refresh again. No missing records were marked.' WHERE status='running'",
  ).run(now());
  stopping = false;
  void pump();
}
export function startScan(libraryId: string): ScanJob {
  const lib = getLibrary(libraryId);
  if (!lib) throw new AppError("NOT_FOUND", "Media library not found", 404);
  if (!lib.enabled || lib.archived)
    throw new AppError(
      "DISABLED",
      "Enable this library before refreshing",
      409,
    );
  if (stopping) throw new AppError("STOPPING", "Server is shutting down", 503);
  const id = randomUUID();
  try {
    db.prepare(
      "INSERT INTO scan_jobs(id,library_id,status,created_at) VALUES (?,?,'queued',?)",
    ).run(id, libraryId, now());
  } catch {
    throw new AppError(
      "SCAN_ACTIVE",
      "This library already has an active scan",
      409,
    );
  }
  setImmediate(() => void pump());
  return getJob(id)!;
}
export function cancelScan(id: string) {
  const job = getJob(id);
  if (!job) throw new AppError("NOT_FOUND", "Scan not found", 404);
  if (job.status === "queued")
    db.prepare(
      "UPDATE scan_jobs SET status='cancelled', cancel_requested=1, completed_at=? WHERE id=?",
    ).run(now(), id);
  else db.prepare("UPDATE scan_jobs SET cancel_requested=1 WHERE id=?").run(id);
}
async function pump() {
  if (working || stopping) return;
  working = true;
  try {
    while (!stopping) {
      const job = db
        .prepare(
          "SELECT * FROM scan_jobs WHERE status='queued' ORDER BY created_at LIMIT 1",
        )
        .get() as ScanJob | undefined;
      if (!job) break;
      activeTask = scanLibrary(job.id);
      await activeTask;
    }
  } finally {
    working = false;
    activeTask = undefined;
  }
}
export async function stopScans() {
  stopping = true;
  await activeTask;
}

export async function scanLibrary(jobId: string): Promise<void> {
  const job = getJob(jobId)!;
  const lib = getLibrary(job.library_id)!;
  const started = Date.now();
  const claim = db
    .prepare(
      "UPDATE scan_jobs SET status='running', started_at=? WHERE id=? AND status='queued'",
    )
    .run(now(), jobId);
  if (claim.changes !== 1) return;
  const counts = {
    discovered: 0,
    added: 0,
    updated: 0,
    skipped: 0,
    missing: 0,
    failed: 0,
  };
  let trustworthy = true;
  const seen = new Set<string>();
  const checkpoint = () =>
    db
      .prepare(
        "UPDATE scan_jobs SET discovered_count=?,added_count=?,updated_count=?,skipped_count=?,missing_count=?,failed_count=? WHERE id=?",
      )
      .run(
        counts.discovered,
        counts.added,
        counts.updated,
        counts.skipped,
        counts.missing,
        counts.failed,
        jobId,
      );
  const cancelled = () => stopping || !!getJob(jobId)?.cancel_requested;
  const fail = (relative: string, error: unknown) => {
    counts.failed++;
    // FFmpeg messages may contain physical paths. Store useful but sanitized errors.
    const message = (
      error instanceof Error ? error.message : "File processing failed"
    )
      .replaceAll(libraryPath(lib.root_id, ""), "[root]")
      .slice(0, 2000);
    db.prepare(
      "INSERT INTO scan_errors(job_id,relative_path,message) VALUES (?,?,?)",
    ).run(jobId, relative, message);
    checkpoint();
  };
  const joined = (rel: string) =>
    [lib.relative_path, rel].filter(Boolean).join("/");
  let rootHandle: Awaited<ReturnType<typeof openBeneath>> | undefined;
  const directories: { relative: string; dev: number; ino: number }[] = [];
  try {
    rootHandle = await openBeneath(lib.root_id, lib.relative_path, true);
    const identity = await rootHandle.stat();
    if (
      lib.root_device &&
      (lib.root_device !== String(identity.dev) ||
        lib.root_inode !== String(identity.ino))
    )
      throw new Error(
        "Library root identity changed; original mount may be disconnected",
      );
    if (!lib.root_device)
      db.prepare(
        "UPDATE media_libraries SET root_device=?,root_inode=? WHERE id=?",
      ).run(String(identity.dev), String(identity.ino), lib.id);
    const visit = async (relative: string): Promise<void> => {
      if (cancelled()) return;
      const directory = await openBeneath(lib.root_id, joined(relative), true);
      try {
        const stat = await directory.stat();
        directories.push({ relative, dev: stat.dev, ino: stat.ino });
        const location =
          process.platform === "linux"
            ? `/proc/self/fd/${directory.fd}`
            : libraryPath(lib.root_id, joined(relative));
        const entries = await fs.readdir(location, { withFileTypes: true });
        for (const entry of entries) {
          if (cancelled()) return;
          if (
            entry.name.startsWith(".") ||
            /(?:\.part|\.tmp|~)$/i.test(entry.name)
          )
            continue;
          const rel = relative ? `${relative}/${entry.name}` : entry.name;
          if (entry.isSymbolicLink()) {
            trustworthy = false;
            continue;
          }
          if (entry.isDirectory()) {
            if (lib.recursive) {
              try {
                await visit(rel);
              } catch (err) {
                trustworthy = false;
                fail(rel, err);
              }
            }
            continue;
          }
          if (
            !entry.isFile() ||
            !mediaTypes[path.extname(entry.name).toLowerCase()]
          )
            continue;
          counts.discovered++;
          seen.add(rel);
          let file: Awaited<ReturnType<typeof openBeneath>> | undefined;
          try {
            file = await openBeneath(lib.root_id, joined(rel));
            const stat = await file.stat();
            // Read at most 128 KiB only for new/changed paths. Mounted filesystems
            // may change inodes on a rename, so inode numbers are not durable IDs.
            const unchanged = (record: VideoRecord | undefined) =>
              !!record &&
              record.size_bytes === stat.size &&
              record.mtime_ms === stat.mtimeMs &&
              record.processing_status === "ready";
            let fingerprint: string;
            let existing = db
              .prepare(
                "SELECT * FROM videos WHERE library_id=? AND relative_path=?",
              )
              .get(lib.id, rel) as VideoRecord | undefined;
            if (unchanged(existing)) fingerprint = existing!.fingerprint || "";
            else {
              const first = Buffer.alloc(Math.min(stat.size, 65536));
              const last = Buffer.alloc(Math.min(stat.size, 65536));
              const a = await file.read(first, 0, first.length, 0);
              const b = await file.read(
                last,
                0,
                last.length,
                Math.max(0, stat.size - last.length),
              );
              fingerprint =
                "sample-v1:" +
                createHash("sha256")
                  .update(String(stat.size))
                  .update(first.subarray(0, a.bytesRead))
                  .update(last.subarray(0, b.bytesRead))
                  .digest("hex");
            }
            // Reattach only an unambiguous unchanged-content candidate whose old
            // path has actually disappeared. Ambiguity preserves both records.
            if (!existing) {
              const moved = db
                .prepare(
                  "SELECT * FROM videos WHERE library_id=? AND fingerprint=? AND deleted_at IS NULL",
                )
                .all(lib.id, fingerprint) as VideoRecord[];
              if (
                moved.length === 1 &&
                moved[0].size_bytes === stat.size &&
                Math.abs((moved[0].mtime_ms || 0) - stat.mtimeMs) < 1
              ) {
                let oldExists = true;
                try {
                  const old = await openBeneath(
                    lib.root_id,
                    joined(moved[0].relative_path!),
                  );
                  await old.close();
                } catch (err) {
                  if ((err as NodeJS.ErrnoException).code === "ENOENT")
                    oldExists = false;
                }
                if (!oldExists) {
                  existing = moved[0];
                  db.prepare(
                    "UPDATE videos SET relative_path=?,original_filename=? WHERE id=?",
                  ).run(rel, entry.name, existing.id);
                }
              }
            }
            if (existing?.deleted_at) {
              counts.skipped++;
              continue;
            }
            if (
              existing &&
              existing.size_bytes === stat.size &&
              existing.mtime_ms === stat.mtimeMs &&
              existing.processing_status === "ready"
            ) {
              db.prepare(
                "UPDATE videos SET last_observed_scan=?,availability='available' WHERE id=?",
              ).run(jobId, existing.id);
              counts.skipped++;
              continue;
            }
            const id = existing?.id || randomUUID();
            const metadata = await inspectVideo(
              libraryPath(lib.root_id, joined(rel)),
              { fd: file.fd },
            );
            const thumbnail = `${id}.jpg`;
            const thumbPath = path.join(
              process.env.DATA_DIR || path.join(__dirname, "../../../data"),
              "thumbnails",
              thumbnail,
            );
            await generateThumbnail(
              libraryPath(lib.root_id, joined(rel)),
              thumbPath,
              { fd: file.fd },
            );
            const after = await file.stat();
            if (after.size !== stat.size || after.mtimeMs !== stat.mtimeMs)
              throw new Error("File changed during processing; retry refresh");
            if (cancelled()) return;
            db.transaction(() => {
              let category = lib.default_category_id;
              if (lib.folder_categories && rel.includes("/")) {
                const name = rel.split("/")[0];
                let cat = db
                  .prepare("SELECT id FROM categories WHERE name=?")
                  .get(name) as { id: string } | undefined;
                if (!cat) {
                  cat = { id: randomUUID() };
                  db.prepare(
                    "INSERT INTO categories(id,name,slug,color,sort_order,is_active,created_at,updated_at) VALUES (?,?,?,?,0,1,?,?)",
                  ).run(
                    cat.id,
                    name,
                    `folder-${cat.id}`,
                    "#8957ff",
                    now(),
                    now(),
                  );
                }
                category = cat.id;
              }
              if (!existing)
                videoRepo.create({
                  id,
                  title: path.parse(entry.name).name,
                  original_filename: entry.name,
                  storage_key: `external:${id}`,
                  mime_type: mediaTypes[path.extname(entry.name).toLowerCase()],
                  size_bytes: stat.size,
                  duration_seconds: metadata.durationSeconds,
                  width: metadata.width,
                  height: metadata.height,
                  codec: metadata.codec,
                  audio_codec: metadata.audioCodec,
                  thumbnail_path: thumbnail,
                  processing_status: "ready",
                  category_id: category || undefined,
                  created_at: now(),
                  updated_at: now(),
                });
              db.prepare(
                `UPDATE videos SET source_type='external',library_id=?,relative_path=?,size_bytes=?,mtime_ms=?,fingerprint=?,availability='available',last_observed_scan=?,duration_seconds=?,width=?,height=?,codec=?,audio_codec=?,thumbnail_path=?,processing_status='ready',processing_error=NULL,category_id=CASE WHEN metadata_overridden=1 THEN category_id ELSE ? END,updated_at=? WHERE id=?`,
              ).run(
                lib.id,
                rel,
                stat.size,
                stat.mtimeMs,
                fingerprint,
                jobId,
                metadata.durationSeconds,
                metadata.width,
                metadata.height,
                metadata.codec,
                metadata.audioCodec || null,
                thumbnail,
                category,
                now(),
                id,
              );
            })();
            existing ? counts.updated++ : counts.added++;
          } catch (err) {
            trustworthy = false;
            fail(rel, err);
          } finally {
            await file?.close();
            checkpoint();
          }
        }
      } finally {
        await directory.close();
      }
    };
    await visit("");
    if (cancelled()) {
      db.prepare(
        "UPDATE scan_jobs SET status=?,completed_at=?,duration_ms=?,error_summary='Scan stopped; missing records were not marked' WHERE id=?",
      ).run(
        stopping ? "interrupted" : "cancelled",
        now(),
        Date.now() - started,
        jobId,
      );
      return;
    }
    // A disconnected/replaced drive or changed directory invalidates missing detection.
    for (const dir of directories) {
      const check = await openBeneath(lib.root_id, joined(dir.relative), true);
      try {
        const stat = await check.stat();
        if (stat.ino !== dir.ino || stat.dev !== dir.dev)
          throw new Error("Directory changed during scan");
      } finally {
        await check.close();
      }
    }
    if (trustworthy) {
      const prior = db
        .prepare(
          "SELECT id,relative_path FROM videos WHERE library_id=? AND deleted_at IS NULL AND availability!='missing'",
        )
        .all(lib.id) as { id: string; relative_path: string }[];
      db.transaction(() => {
        for (const v of prior)
          if (!seen.has(v.relative_path)) {
            db.prepare(
              "UPDATE videos SET availability='missing' WHERE id=?",
            ).run(v.id);
            counts.missing++;
          }
      })();
    }
    checkpoint();
    db.prepare(
      "UPDATE scan_jobs SET status=?,completed_at=?,duration_ms=?,error_summary=? WHERE id=?",
    ).run(
      trustworthy ? "completed" : "failed",
      now(),
      Date.now() - started,
      trustworthy
        ? null
        : "Some paths could not be trusted or processed. Missing records were not marked; inspect scan errors.",
      jobId,
    );
  } catch (err) {
    fail("", err);
    db.prepare(
      "UPDATE scan_jobs SET status='failed',completed_at=?,duration_ms=?,error_summary='Library unavailable or scan incomplete. Existing records preserved.' WHERE id=?",
    ).run(now(), Date.now() - started, jobId);
  } finally {
    await rootHandle?.close();
  }
}
