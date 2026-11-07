# Vibes 2.3 API additions

All endpoints below require an active bearer-authenticated account except signed GET/HEAD media URLs. Library, scan and management mutations additionally require administrator authorization.

| Method   | Path under `/api`          | Contract                                                                                                                                     |
| -------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| GET      | `/media-roots`             | Administrator-only configured root IDs/container paths; no arbitrary host paths accepted.                                                    |
| GET/POST | `/libraries`               | List availability/statistics or configure `name`, `rootId`, `relativePath`, `recursive`, `folderCategories`, `enabled`, `defaultCategoryId`. |
| PATCH    | `/libraries/:id`           | Edit settings; source root/path are immutable. Active scans block edits.                                                                     |
| DELETE   | `/libraries/:id`           | Archive configuration, retain videos/state, mark originals unavailable. Recreating the same source reactivates the configuration.            |
| POST     | `/libraries/:id/scans`     | Persist a queued job, return 202; concurrent jobs for one library return 409.                                                                |
| GET      | `/libraries/:id/scans`     | Most recent 30 jobs.                                                                                                                         |
| GET      | `/scans/:id`               | Actual job status/counters and first 100 errors; `offset` retrieves further errors.                                                          |
| POST     | `/scans/:id/cancel`        | Cancel queued work immediately or request cancellation at a safe processing boundary.                                                        |
| POST     | `/videos/:id/media-ticket` | `{kind:"stream"                                                                                                                              | "thumbnail"}` → URL + expiry; ten-minute JWT scoped to user/video/kind and a distinct audience. |
| GET      | `/videos`                  | Existing envelope now includes `pagination`. Default page size 48; maximum 100.                                                              |
| PATCH    | `/videos/:id`              | Editable `title`; marks metadata as manually overridden.                                                                                     |
| PATCH    | `/videos/:id/category`     | Direct `categoryId` (or null), preserved on refresh.                                                                                         |
| PATCH    | `/videos/bulk`             | Transactional `{ids:[...],categoryId:string                                                                                                  | null}`; max 100 IDs.                                                                            |
| GET/PUT  | `/videos/:id/state`        | Existing endpoints now verify visibility and merge omitted fields. Note max 20,000 characters; finite nonnegative progress.                  |
| GET      | `/health`                  | Public minimal readiness response, database check and release version; no filesystem information.                                            |

Video-list query parameters: `page`, `limit`, `search`, `categoryId`, `tagId`, `libraryId`, `source=upload|external`, `availability=available|missing|unavailable`, `collection=all|favorites|continue|recent`, `sort=newest|oldest|title|size`, `includeUncategorized=true`. Ordering is deterministic within a stable dataset; offset pages can move if files are added concurrently. `recent` means newest ordering, not a fabricated date-range metric. Refresh to reconcile concurrent changes.

Existing category/tag/user/upload APIs remain; category list results additionally carry real `video_count`. MP4/H.264 uploads retain title, direct category and tags; failures retain only unsuccessful frontend selections for retry. Uploads are not resumable. Video manifests include source, availability, basic codec compatibility and the current user's state, never a physical media path. The browser compatibility hint covers H.264 MP4, not every possible audio codec/browser combination.

No cookie authorizes state-changing media/library endpoints. Refresh cookies are restricted to authentication and protected by strict same-site settings and origin checks. Query-string access tokens are rejected everywhere. A media ticket cannot authorize API operations, another video, or the other resource type. User activation and video visibility are checked on every media request. A ticket remains usable within its ten-minute window after logout; disabling the account or removing video visibility blocks it immediately. Native headers keep existing authenticated playback support.
