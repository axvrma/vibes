import db from "../db";
import { z } from "zod";
import { _attachDetailsToVideos, VideoRecord } from "../db/repository";
import { AuthUser } from "../middleware/auth";
export const videoQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(48),
  search: z.string().max(200).optional(),
  categoryId: z.string().optional(),
  tagId: z.string().optional(),
  libraryId: z.string().optional(),
  source: z.enum(["upload", "external"]).optional(),
  availability: z.enum(["available", "missing", "unavailable"]).optional(),
  collection: z.enum(["all", "favorites", "continue", "recent"]).default("all"),
  sort: z.enum(["newest", "oldest", "title", "size"]).default("newest"),
  includeUncategorized: z.enum(["true", "false"]).optional(),
});
export function listVideos(user: AuthUser, query: unknown) {
  const q = videoQuery.parse(query);
  const where = ["v.deleted_at IS NULL", "v.processing_status='ready'"];
  const params: (string | number)[] = [];
  if (user.role !== "admin")
    where.push(
      `EXISTS(SELECT 1 FROM categories c WHERE c.is_active=1 AND (c.id=v.category_id OR c.id IN (SELECT ct.category_id FROM category_tags ct JOIN video_tags vt ON vt.tag_id=ct.tag_id WHERE vt.video_id=v.id)))`,
    );
  const filter = (sql: string, value: string | undefined) => {
    if (value) {
      where.push(sql);
      params.push(value);
    }
  };
  if (q.search) {
    where.push(
      "(v.title LIKE ? ESCAPE '\\' OR v.original_filename LIKE ? ESCAPE '\\' OR EXISTS(SELECT 1 FROM video_tags vt JOIN tags t ON t.id=vt.tag_id WHERE vt.video_id=v.id AND t.name LIKE ? ESCAPE '\\'))",
    );
    const search = `%${q.search.replace(/[\\%_]/g, "\\$&")}%`;
    params.push(search, search, search);
  }
  if (q.categoryId) {
    where.push(
      "(v.category_id=? OR v.id IN (SELECT vt.video_id FROM video_tags vt JOIN category_tags ct ON vt.tag_id=ct.tag_id WHERE ct.category_id=?))",
    );
    params.push(q.categoryId, q.categoryId);
  }
  if (q.includeUncategorized === "true")
    where.push(
      "v.category_id IS NULL AND NOT EXISTS(SELECT 1 FROM video_tags vt JOIN category_tags ct ON ct.tag_id=vt.tag_id WHERE vt.video_id=v.id)",
    );
  filter("v.library_id=?", q.libraryId);
  filter("v.source_type=?", q.source);
  filter("v.availability=?", q.availability);
  filter(
    "EXISTS(SELECT 1 FROM video_tags vt WHERE vt.video_id=v.id AND vt.tag_id=?)",
    q.tagId,
  );
  if (q.collection === "favorites") {
    where.push(
      "EXISTS(SELECT 1 FROM user_video_state s WHERE s.video_id=v.id AND s.user_id=? AND s.liked=1)",
    );
    params.push(user.id);
  }
  if (q.collection === "continue") {
    where.push(
      "EXISTS(SELECT 1 FROM user_video_state s WHERE s.video_id=v.id AND s.user_id=? AND s.progress_seconds>0 AND (v.duration_seconds IS NULL OR s.progress_seconds < v.duration_seconds-1))",
    );
    params.push(user.id);
  }
  const order = {
    newest: "v.created_at DESC,v.id",
    oldest: "v.created_at ASC,v.id",
    title: "v.title COLLATE NOCASE,v.id",
    size: "v.size_bytes DESC,v.id",
  }[q.sort];
  const clause = where.join(" AND ");
  const total = (
    db
      .prepare(`SELECT COUNT(*) AS count FROM videos v WHERE ${clause}`)
      .get(...params) as { count: number }
  ).count;
  const rows = db
    .prepare(
      `SELECT v.* FROM videos v WHERE ${clause} ORDER BY ${order} LIMIT ? OFFSET ?`,
    )
    .all(...params, q.limit, (q.page - 1) * q.limit) as VideoRecord[];
  const videos = _attachDetailsToVideos(rows).map((v) => {
    const state = db
      .prepare(
        "SELECT liked,note,progress_seconds,updated_at FROM user_video_state WHERE user_id=? AND video_id=?",
      )
      .get(user.id, v.id) || { liked: 0, note: "", progress_seconds: 0 };
    return {
      id: v.id,
      title: v.title,
      originalFilename: v.original_filename,
      durationSeconds: v.duration_seconds,
      width: v.width,
      height: v.height,
      codec: v.codec,
      audioCodec: v.audio_codec,
      sizeBytes: v.size_bytes,
      thumbnailUrl: `/api/videos/${v.id}/thumbnail`,
      streamUrl: `/api/videos/${v.id}/stream`,
      category: v.category,
      tags: v.tags,
      sourceType: v.source_type,
      libraryId: v.library_id,
      availability: v.availability,
      browserCompatible: v.mime_type === "video/mp4" && v.codec === "h264",
      createdAt: v.created_at,
      updatedAt: v.updated_at,
      state,
    };
  });
  return {
    videos,
    pagination: {
      page: q.page,
      limit: q.limit,
      total,
      hasMore: q.page * q.limit < total,
    },
  };
}
