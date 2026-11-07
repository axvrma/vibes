import { Router } from "express";
import { z } from "zod";
import { randomUUID } from "crypto";
import db from "../db";
import { authorizeRoles } from "../middleware/auth";
import { AppError } from "../middleware/error-handler";
import {
  libraryPath,
  openBeneath,
  trustedRoots,
} from "../services/media-paths";
import {
  cancelScan,
  getJob,
  getLibrary,
  MediaLibrary,
  startScan,
} from "../services/media-library";
const router = Router();
router.use(["/media-roots", "/libraries", "/scans"], authorizeRoles("admin"));
const schema = z
  .object({
    name: z.string().trim().min(1).max(100),
    rootId: z.string().min(1).max(64),
    relativePath: z.string().max(1000).default(""),
    enabled: z.boolean().default(true),
    recursive: z.boolean().default(true),
    folderCategories: z.boolean().default(true),
    defaultCategoryId: z.string().uuid().nullable().default(null),
  })
  .strict();
const history = (id: string) =>
  db
    .prepare(
      "SELECT * FROM scan_jobs WHERE library_id=? ORDER BY created_at DESC LIMIT 30",
    )
    .all(id);
router.get("/media-roots", (_req, res) =>
  res.json({ roots: trustedRoots().map((r) => ({ id: r.id, path: r.path })) }),
);
router.get("/libraries", async (_req, res, next) => {
  try {
    const libraries = db
      .prepare("SELECT * FROM media_libraries WHERE archived=0 ORDER BY name")
      .all() as MediaLibrary[];
    const result = await Promise.all(
      libraries.map(async (lib) => {
        let available = false;
        try {
          const handle = await openBeneath(
            lib.root_id,
            lib.relative_path,
            true,
          );
          await handle.close();
          available = true;
        } catch {}
        const stats = db
          .prepare(
            "SELECT COUNT(*) AS video_count,COALESCE(SUM(size_bytes),0) AS total_size_bytes FROM videos WHERE library_id=? AND deleted_at IS NULL",
          )
          .get(lib.id) as object;
        return {
          ...lib,
          ...stats,
          authorized_path: libraryPath(lib.root_id, lib.relative_path),
          available,
          lastScan: history(lib.id)[0] || null,
          lastSuccessfulScan:
            db
              .prepare(
                "SELECT * FROM scan_jobs WHERE library_id=? AND status='completed' ORDER BY completed_at DESC LIMIT 1",
              )
              .get(lib.id) || null,
        };
      }),
    );
    res.json({ libraries: result });
  } catch (err) {
    next(err);
  }
});
router.post("/libraries", (req, res, next) => {
  try {
    const data = schema.parse(req.body);
    libraryPath(data.rootId, data.relativePath);
    const old = db
      .prepare(
        "SELECT * FROM media_libraries WHERE root_id=? AND relative_path=? AND archived=1",
      )
      .get(data.rootId, data.relativePath) as MediaLibrary | undefined;
    if (old) {
      db.prepare(
        "UPDATE media_libraries SET archived=0,enabled=?,name=?,recursive=?,folder_categories=?,default_category_id=?,updated_at=? WHERE id=?",
      ).run(
        +data.enabled,
        data.name,
        +data.recursive,
        +data.folderCategories,
        data.defaultCategoryId,
        new Date().toISOString(),
        old.id,
      );
      res.status(201).json({ library: getLibrary(old.id) });
      return;
    }
    const id = randomUUID(),
      now = new Date().toISOString();
    db.prepare(
      "INSERT INTO media_libraries(id,name,root_id,relative_path,enabled,recursive,folder_categories,default_category_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      data.name,
      data.rootId,
      data.relativePath,
      +data.enabled,
      +data.recursive,
      +data.folderCategories,
      data.defaultCategoryId,
      now,
      now,
    );
    res.status(201).json({ library: getLibrary(id) });
  } catch (err) {
    next(err);
  }
});
router.patch("/libraries/:id", (req, res, next) => {
  try {
    const lib = getLibrary(req.params.id);
    if (!lib) throw new AppError("NOT_FOUND", "Library not found", 404);
    if (
      db
        .prepare(
          "SELECT 1 FROM scan_jobs WHERE library_id=? AND status IN ('queued','running')",
        )
        .get(lib.id)
    )
      throw new AppError(
        "SCAN_ACTIVE",
        "Wait for or cancel the active scan before editing",
        409,
      );
    // Source identity is immutable. Create a new configuration for a different root.
    const data = schema
      .omit({ rootId: true, relativePath: true })
      .partial()
      .parse(req.body);
    db.prepare(
      "UPDATE media_libraries SET name=?,enabled=?,recursive=?,folder_categories=?,default_category_id=?,updated_at=? WHERE id=?",
    ).run(
      data.name ?? lib.name,
      data.enabled === undefined ? lib.enabled : +data.enabled,
      data.recursive === undefined ? lib.recursive : +data.recursive,
      data.folderCategories === undefined
        ? lib.folder_categories
        : +data.folderCategories,
      data.defaultCategoryId === undefined
        ? lib.default_category_id
        : data.defaultCategoryId,
      new Date().toISOString(),
      lib.id,
    );
    res.json({ library: getLibrary(lib.id) });
  } catch (err) {
    next(err);
  }
});
router.delete("/libraries/:id", (req, res, next) => {
  try {
    if (!getLibrary(req.params.id))
      throw new AppError("NOT_FOUND", "Library not found", 404);
    if (
      db
        .prepare(
          "SELECT 1 FROM scan_jobs WHERE library_id=? AND status IN ('queued','running')",
        )
        .get(req.params.id)
    )
      throw new AppError("SCAN_ACTIVE", "Cancel the active scan first", 409);
    // Detach configuration, retaining all records, user state and original media.
    db.transaction(() => {
      db.prepare(
        "UPDATE videos SET availability='unavailable' WHERE library_id=?",
      ).run(req.params.id);
      db.prepare(
        "UPDATE media_libraries SET enabled=0,archived=1 WHERE id=?",
      ).run(req.params.id);
    })();
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});
router.post("/libraries/:id/scans", (req, res, next) => {
  try {
    res.status(202).json({ job: startScan(req.params.id) });
  } catch (err) {
    next(err);
  }
});
router.get("/libraries/:id/scans", (req, res) =>
  res.json({ jobs: history(req.params.id) }),
);
router.get("/scans/:id", (req, res, next) => {
  const job = getJob(req.params.id);
  if (!job) return next(new AppError("NOT_FOUND", "Scan not found", 404));
  const page = Math.max(0, Number(req.query.offset) || 0);
  res.json({
    job,
    errors: db
      .prepare(
        "SELECT relative_path,message FROM scan_errors WHERE job_id=? ORDER BY id LIMIT 100 OFFSET ?",
      )
      .all(job.id, page),
  });
});
router.post("/scans/:id/cancel", (req, res, next) => {
  try {
    cancelScan(req.params.id);
    res.json({ job: getJob(req.params.id) });
  } catch (err) {
    next(err);
  }
});
export default router;
