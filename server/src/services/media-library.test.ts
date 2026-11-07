import {
  beforeAll,
  beforeEach,
  afterAll,
  describe,
  it,
  expect,
  vi,
} from "vitest";
import fs from "fs/promises";
import path from "path";
import db, { initDb } from "../db";
import { randomUUID } from "crypto";
import {
  scanLibrary,
  startScan,
  getJob,
  cancelScan,
  recoverScans,
  stopScans,
} from "./media-library";
import { openBeneath } from "./media-paths";
import { inspectVideo, generateThumbnail } from "./media-processor";
import { stateRepo, videoRepo } from "../db/repository";
vi.mock("./media-processor", () => ({
  inspectVideo: vi.fn(async () => ({
    durationSeconds: 0.3,
    width: 100,
    height: 200,
    codec: "h264",
    containerFormat: "mp4",
  })),
  generateThumbnail: vi.fn(async (_input: string, output: string) => {
    await fs.writeFile(output, "thumbnail");
  }),
}));
const root = path.join(process.env.DATA_DIR!, "media");
let lib = "";
beforeAll(() => {
  initDb();
  db.prepare(
    "INSERT INTO users(id,email,password_hash,role,created_at,updated_at) VALUES ('u','u@example.test','hash','admin','now','now')",
  ).run();
});
beforeEach(async () => {
  await stopScans();
  db.exec(
    "DELETE FROM user_video_state;DELETE FROM videos;DELETE FROM scan_jobs;DELETE FROM media_libraries;",
  );
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(root, { recursive: true });
  vi.mocked(inspectVideo).mockClear();
  vi.mocked(generateThumbnail).mockClear();
  vi.mocked(inspectVideo).mockResolvedValue({
    durationSeconds: 0.3,
    width: 100,
    height: 200,
    codec: "h264",
    containerFormat: "mp4",
  });
  lib = randomUUID();
  db.prepare(
    "INSERT INTO media_libraries(id,name,root_id,created_at,updated_at) VALUES (?,'Test','test','now','now')",
  ).run(lib);
});
afterAll(() => stopScans());
const scan = async () => {
  const id = randomUUID();
  db.prepare(
    "INSERT INTO scan_jobs(id,library_id,status,created_at) VALUES (?,?,'queued','now')",
  ).run(id, lib);
  await scanLibrary(id);
  return getJob(id)!;
};
// scanLibrary can be run deterministically without the worker pump; recoverScans resets its shutdown flag.
const enableWorker = () => recoverScans();
const file = async (name = "a.mp4", contents = "video") => {
  await fs.mkdir(path.dirname(path.join(root, name)), { recursive: true });
  await fs.writeFile(path.join(root, name), contents);
};
const videos = () => db.prepare("SELECT * FROM videos").all() as any[];
describe("external library engine", () => {
  beforeEach(() => enableWorker());
  it("imports nested supported files, records metadata and folder categories", async () => {
    await file("Technology/a.mp4");
    const result = await scan();
    expect(result.status).toBe("completed");
    expect(result.added_count).toBe(1);
    expect(videos()[0]).toMatchObject({
      source_type: "external",
      relative_path: "Technology/a.mp4",
      availability: "available",
      duration_seconds: 0.3,
    });
    expect(
      db
        .prepare("SELECT name FROM categories WHERE id=?")
        .get(videos()[0].category_id),
    ).toEqual({ name: "Technology" });
  });
  it("is idempotent and skips expensive processing on repeat", async () => {
    await file();
    await scan();
    const second = await scan();
    expect(second.skipped_count).toBe(1);
    expect(videos()).toHaveLength(1);
    expect(inspectVideo).toHaveBeenCalledTimes(1);
    expect(generateThumbnail).toHaveBeenCalledTimes(1);
  });
  it("updates changed files preserving user metadata, likes and notes", async () => {
    await file();
    await scan();
    const id = videos()[0].id;
    stateRepo.upsertState({
      user_id: "u",
      video_id: id,
      liked: 1,
      note: "keep",
      progress_seconds: 2,
      updated_at: "now",
    });
    db.prepare(
      "UPDATE videos SET title='My title',metadata_overridden=1 WHERE id=?",
    ).run(id);
    await file("a.mp4", "changed content");
    expect((await scan()).updated_count).toBe(1);
    expect(videos()[0].title).toBe("My title");
    expect(stateRepo.getState("u", id)).toMatchObject({
      liked: 1,
      note: "keep",
      progress_seconds: 2,
    });
  });
  it("retains identity on an unambiguous same-filesystem rename", async () => {
    await file();
    await scan();
    const id = videos()[0].id;
    await fs.rename(path.join(root, "a.mp4"), path.join(root, "b.mp4"));
    await scan();
    expect(videos()).toHaveLength(1);
    expect(videos()[0]).toMatchObject({
      id,
      relative_path: "b.mp4",
      availability: "available",
    });
  });
  it("marks missing after a successful scan but never deletes records", async () => {
    await file();
    await scan();
    await fs.unlink(path.join(root, "a.mp4"));
    expect((await scan()).missing_count).toBe(1);
    expect(videos()[0].availability).toBe("missing");
  });
  it("preserves records for a disconnected root", async () => {
    await file();
    await scan();
    await fs.rename(root, `${root}-offline`);
    try {
      expect((await scan()).status).toBe("failed");
      expect(videos()[0].availability).toBe("available");
    } finally {
      await fs.rename(`${root}-offline`, root);
    }
  });
  it("rejects a replacement empty mount root", async () => {
    await file();
    await scan();
    await fs.rename(root, `${root}-offline`);
    await fs.mkdir(root);
    try {
      expect((await scan()).status).toBe("failed");
      expect(videos()[0].availability).toBe("available");
    } finally {
      await fs.rmdir(root);
      await fs.rename(`${root}-offline`, root);
    }
  });
  it("records corrupt-file failures without marking other files missing", async () => {
    await file();
    await scan();
    await fs.unlink(path.join(root, "a.mp4"));
    await file("bad.mkv");
    vi.mocked(inspectVideo).mockRejectedValueOnce(new Error("Corrupt media"));
    const job = await scan();
    expect(job.status).toBe("failed");
    expect(job.failed_count).toBe(1);
    expect(videos()[0].availability).toBe("available");
  });
  it("rejects traversal, hidden paths, symlink leaves and ancestors", async () => {
    await file();
    await fs.symlink(path.join(root, "a.mp4"), path.join(root, "link.mp4"));
    await fs.symlink(root, path.join(root, "escape"));
    for (const rel of [
      "../secret",
      "/etc/passwd",
      "a/../../secret",
      ".hidden",
      "link.mp4",
      "escape/a.mp4",
    ])
      await expect(openBeneath("test", rel)).rejects.toThrow();
    const job = await scan();
    expect(job.added_count).toBe(1);
    expect(job.status).toBe("failed");
  });
  it("does not recurse when disabled and ignores temporary/hidden files", async () => {
    db.prepare("UPDATE media_libraries SET recursive=0 WHERE id=?").run(lib);
    await file("nested/a.mp4");
    await file(".secret.mp4");
    await file("movie.mp4.part");
    await file("a.webm");
    expect((await scan()).added_count).toBe(1);
  });
  it("prevents concurrent refresh and cancels queued work", () => {
    const job = startScan(lib);
    expect(() => startScan(lib)).toThrow("active scan");
    cancelScan(job.id);
    expect(getJob(job.id)?.status).toBe("cancelled");
  });
  it("recovers interrupted work on restart without marking videos missing", () => {
    const id = randomUUID();
    db.prepare(
      "INSERT INTO scan_jobs(id,library_id,status,created_at) VALUES (?,?,'running','now')",
    ).run(id, lib);
    recoverScans();
    expect(getJob(id)?.status).toBe("interrupted");
  });
  it("leaves uploaded videos untouched", async () => {
    videoRepo.create({
      id: "upload",
      title: "Upload",
      original_filename: "up.mp4",
      storage_key: "up.mp4",
      created_at: "now",
      updated_at: "now",
    });
    await scan();
    expect(videoRepo.getById("upload")).toMatchObject({
      source_type: "upload",
      availability: "available",
    });
  });
});

describe('mounted filesystem identities',()=>{
 beforeEach(()=>enableWorker());
 it('preserves identity when a mounted filesystem changes the inode during a move',async()=>{
   await file();await scan();const original=videos()[0];const stat=await fs.stat(path.join(root,'a.mp4'));
   await fs.copyFile(path.join(root,'a.mp4'),path.join(root,'moved.mp4'));
   await fs.utimes(path.join(root,'moved.mp4'),stat.atime,stat.mtime);
   await fs.unlink(path.join(root,'a.mp4'));
   await scan();expect(videos()).toHaveLength(1);expect(videos()[0].id).toBe(original.id);expect(videos()[0].relative_path).toBe('moved.mp4');
 });
 it('does not attach personal state to an ambiguous matching copy',async()=>{
   await file('a.mp4','identical');await file('b.mp4','identical');await scan();expect(videos()).toHaveLength(2);
   const old=videos().find(v=>v.relative_path==='a.mp4');const stat=await fs.stat(path.join(root,'a.mp4'));
   await fs.copyFile(path.join(root,'a.mp4'),path.join(root,'c.mp4'));await fs.utimes(path.join(root,'c.mp4'),stat.atime,stat.mtime);await fs.unlink(path.join(root,'a.mp4'));await scan();
   expect(videos()).toHaveLength(3);expect(videos().find(v=>v.relative_path==='c.mp4').id).not.toBe(old.id);expect(videos().find(v=>v.id===old.id).availability).toBe('missing');
 });
});

describe("scan fault boundaries", () => {
  beforeEach(() => enableWorker());
  it("treats directory permission errors as incomplete scans", async () => {
    await file();
    await scan();
    await fs.unlink(path.join(root, "a.mp4"));
    const original = fs.readdir;
    const spy = vi.spyOn(fs, "readdir").mockImplementation((async (
      ...args: any[]
    ) => {
      const err = Object.assign(new Error("Permission denied"), {
        code: "EACCES",
      });
      throw err;
    }) as typeof original);
    try {
      const job = await scan();
      expect(job.status).toBe("failed");
      expect(videos()[0].availability).toBe("available");
    } finally {
      spy.mockRestore();
    }
  });
  it("cancels running work without marking missing or committing a partial file", async () => {
    await file();
    let release: ((value: any) => void) | undefined;
    vi.mocked(inspectVideo).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          release = resolve;
        }),
    );
    const job = startScan(lib);
    await vi.waitFor(() => expect(release).toBeDefined());
    cancelScan(job.id);
    release!({
      durationSeconds: 1,
      width: 10,
      height: 10,
      codec: "h264",
      containerFormat: "mp4",
    });
    await vi.waitFor(() => expect(getJob(job.id)?.status).toBe("cancelled"));
    expect(videos()).toHaveLength(0);
    expect(getJob(job.id)?.missing_count).toBe(0);
  });
});
