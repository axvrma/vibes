import db from "../db";
import { VideoRecord } from "../db/repository";
import { AuthUser } from "../middleware/auth";
export function canViewVideo(user: AuthUser, video: VideoRecord): boolean {
  if (user.role === "admin") return true;
  return !!db
    .prepare(
      `SELECT 1 FROM categories c WHERE c.is_active=1 AND (c.id=? OR c.id IN (SELECT ct.category_id FROM category_tags ct JOIN video_tags vt ON vt.tag_id=ct.tag_id WHERE vt.video_id=?)) LIMIT 1`,
    )
    .get(video.category_id || null, video.id);
}
