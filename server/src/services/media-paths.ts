import path from "path";
import fs from "fs";
import fsp, { FileHandle } from "fs/promises";
import { AppError } from "../middleware/error-handler";

export interface TrustedRoot {
  id: string;
  path: string;
}
export function trustedRoots(): TrustedRoot[] {
  const config: unknown = JSON.parse(process.env.MEDIA_ROOTS || "{}");
  if (!config || typeof config !== "object" || Array.isArray(config))
    throw new Error(
      "MEDIA_ROOTS must be an object of root IDs to absolute container paths",
    );
  return Object.entries(config).map(([id, root]) => {
    if (
      !/^[\w-]{1,64}$/.test(id) ||
      typeof root !== "string" ||
      !path.isAbsolute(root)
    )
      throw new Error("Invalid trusted media root");
    return { id, path: path.resolve(root) };
  });
}
export function relativeParts(relative: string): string[] {
  if (
    relative.includes("\\") ||
    relative.includes("\0") ||
    path.isAbsolute(relative)
  )
    throw new AppError(
      "INVALID_PATH",
      "Use a relative path beneath an authorized root",
    );
  if (relative === "") return [];
  const parts = relative.split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || p.startsWith(".")))
    throw new AppError(
      "INVALID_PATH",
      "Hidden and traversing paths are not allowed",
    );
  return parts;
}
export function libraryPath(rootId: string, relative: string): string {
  const root = trustedRoots().find((r) => r.id === rootId);
  if (!root)
    throw new AppError(
      "INVALID_ROOT",
      "This root is not configured on the server",
    );
  return path.join(root.path, ...relativeParts(relative));
}

// On the production Linux container, walk relative to open directory descriptors.
// No ancestor or leaf can be replaced with a symlink between validation and use.
export async function openBeneath(
  rootId: string,
  relative: string,
  directory = false,
): Promise<FileHandle> {
  const root = trustedRoots().find((r) => r.id === rootId);
  if (!root)
    throw new AppError(
      "INVALID_ROOT",
      "This root is not configured on the server",
    );
  const parts = relativeParts(relative);
  let current = await fsp.open(
    root.path,
    fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW,
  );
  let physical = await fsp.realpath(root.path);
  try {
    for (let i = 0; i < parts.length; i++) {
      const isDir = i < parts.length - 1 || directory;
      const candidate =
        process.platform === "linux"
          ? `/proc/self/fd/${current.fd}/${parts[i]}`
          : path.join(physical, parts[i]);
      // Portable development fallback: verify each ancestor and inode before/after.
      if (
        process.platform !== "linux" &&
        (await fsp.realpath(physical)) !== physical
      )
        throw new AppError("INVALID_PATH", "Symlinks are not permitted");
      const next = await fsp.open(
        candidate,
        fs.constants.O_RDONLY |
          fs.constants.O_NOFOLLOW |
          (isDir ? fs.constants.O_DIRECTORY : fs.constants.O_NONBLOCK),
      );
      try {
        if (process.platform !== "linux") {
          physical = path.join(physical, parts[i]);
          const actual = await fsp.realpath(physical);
          const [opened, linked] = await Promise.all([
            next.stat(),
            fsp.lstat(physical),
          ]);
          if (
            actual !== physical ||
            opened.ino !== linked.ino ||
            opened.dev !== linked.dev
          )
            throw new AppError(
              "INVALID_PATH",
              "Media path changed during access",
            );
        }
      } catch (err) {
        await next.close();
        throw err;
      }
      await current.close();
      current = next;
    }
    const stat = await current.stat();
    if (directory ? !stat.isDirectory() : !stat.isFile())
      throw new AppError("INVALID_PATH", "Unsupported file type");
    return current;
  } catch (err) {
    await current.close();
    throw err;
  }
}
export const mediaTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".webm": "video/webm",
  ".m4v": "video/mp4",
  ".avi": "video/x-msvideo",
};
