// Incremental scanner and paginated-query benchmark on disposable synthetic records.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "vibes-bench-"));
process.env.DATA_DIR = temp;
process.env.DATABASE_PATH = path.join(temp, "sqlite.db");
process.env.MEDIA_ROOTS = JSON.stringify({ bench: path.join(temp, "media") });
fs.mkdirSync(path.join(temp, "media"));
const require = createRequire(
  new URL("../server/package.json", import.meta.url),
);
const db = require("../server/dist/db").default;
const { initDb } = require("../server/dist/db");
const {
  scanLibrary,
  getJob,
} = require("../server/dist/services/media-library");
const { listVideos } = require("../server/dist/services/video-query");
const count = Number(process.env.BENCH_VIDEOS || 2000);
try {
  initDb();
  db.prepare(
    "INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES ('bench','bench@example.test','hash','admin','now','now')",
  ).run();
  db.prepare(
    "INSERT INTO media_libraries(id,name,root_id,created_at,updated_at) VALUES ('bench','Benchmark','bench','now','now')",
  ).run();
  const insert = db.prepare(
    "INSERT INTO videos(id,title,original_filename,storage_key,source_type,library_id,relative_path,size_bytes,mtime_ms,created_at,updated_at) VALUES (?,?,?,?,'external','bench',?,?,?,'2026-01-01','2026-01-01')",
  );
  db.transaction(() => {
    for (let i = 0; i < count; i++) {
      const filename = `video-${i}.mp4`;
      fs.writeFileSync(path.join(temp, "media", filename), Buffer.alloc(128));
      const stat = fs.statSync(path.join(temp, "media", filename));
      insert.run(
        `video-${i}`,
        `Video ${i}`,
        filename,
        `external:${i}`,
        filename,
        stat.size,
        stat.mtimeMs,
      );
    }
  })();
  db.prepare(
    "INSERT INTO scan_jobs(id,library_id,status,created_at) VALUES ('bench','bench','queued','now')",
  ).run();
  const before = performance.now();
  await scanLibrary("bench");
  const elapsed = performance.now() - before;
  const scan = getJob("bench");
  if (scan.status !== "completed" || scan.skipped_count !== count)
    throw Error(JSON.stringify(scan));
  const samples = [];
  for (let i = 0; i < 100; i++) {
    const before = performance.now();
    const result = listVideos(
      { id: "bench", email: "bench@example.test", role: "admin", is_active: 1 },
      { limit: "48", page: String((i % 20) + 1) },
    );
    samples.push(performance.now() - before);
    if (result.videos.length > 48) throw Error("Unbounded page");
  }
  samples.sort((a, b) => a - b);
  console.log(
    "BENCHMARK_RESULT " +
      JSON.stringify({
        node: process.version,
        platform: process.platform,
        arch: process.arch,
        cpu: os.cpus()[0].model,
        videos: count,
        unchangedScanMs: Math.round(elapsed),
        unchangedSkipped: scan.skipped_count,
        metadataProbes: 0,
        thumbnailGenerations: 0,
        paginatedQueryMedianMs: Number(samples[50].toFixed(2)),
        paginatedQueryP95Ms: Number(samples[95].toFixed(2)),
        pageSize: 48,
        rssMb: Number((process.memoryUsage().rss / 1048576).toFixed(1)),
        scope:
          "Synthetic ready records and 128-byte files; unchanged-scan/query benchmark only, not initial import or playback profiling.",
      }),
  );
} finally {
  db.close();
  fs.rmSync(temp, { recursive: true, force: true });
}
