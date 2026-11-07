import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  codec: string;
  audioCodec?: string;
  containerFormat: string;
}
export interface MediaInput {
  fd?: number;
}
const ffprobePath = process.env.FFPROBE_PATH || "ffprobe";
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

function runProcess(
  binary: string,
  args: string[],
  input?: MediaInput,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, {
      stdio:
        input?.fd !== undefined
          ? ["ignore", "pipe", "pipe", input.fd]
          : ["ignore", "pipe", "pipe"],
    });
    let output = "",
      stderr = "",
      settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      err ? reject(err) : resolve(output);
    };
    const timeout = setTimeout(
      () => {
        child.kill("SIGKILL");
        finish(new Error("Media processing timed out"));
      },
      Number(process.env.MEDIA_PROCESS_TIMEOUT_MS || 60000),
    );
    child.stdout!.on("data", (b) => {
      output += b.toString();
      if (output.length > 4 * 1024 * 1024) {
        child.kill("SIGKILL");
        finish(new Error("Probe output limit exceeded"));
      }
    });
    child.stderr!.on("data", (b) => {
      stderr = (stderr + b.toString()).slice(-4000);
    });
    child.on("error", (err) =>
      finish(
        new Error(`Could not start ${path.basename(binary)}: ${err.message}`),
      ),
    );
    child.on("close", (code) =>
      finish(
        code === 0
          ? undefined
          : new Error(`${path.basename(binary)} failed (${code}): ${stderr}`),
      ),
    );
  });
}
let active = 0;
const waiting: (() => void)[] = [];
async function run(
  binary: string,
  args: string[],
  input?: MediaInput,
): Promise<string> {
  if (active >= 2) {
    if (waiting.length >= 32)
      throw new Error("Media processor is busy; retry later");
    await new Promise<void>((resolve) => waiting.push(resolve));
  }
  else {active++;}
  try {
    return await runProcess(binary, args, input);
  } finally {
    const next=waiting.shift();
    if(next)next();else active--;
  }
}
function inputPath(filePath: string, input?: MediaInput) {
  return input?.fd !== undefined
    ? process.platform === "linux"
      ? "/proc/self/fd/3"
      : "/dev/fd/3"
    : filePath;
}
export async function inspectVideo(
  filePath: string,
  input?: MediaInput,
): Promise<VideoMetadata> {
  const data = JSON.parse(
    await run(
      ffprobePath,
      [
        "-v",
        "error",
        "-format_whitelist",
        "mov,matroska,webm,avi",
        "-protocol_whitelist",
        "file,pipe",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        inputPath(filePath, input),
      ],
      input,
    ),
  );
  const streams = data.streams as {
    codec_type: string;
    codec_name: string;
    width?: number;
    height?: number;
  }[];
  const video = streams?.find((s) => s.codec_type === "video");
  if (!video) throw new Error("No video stream found");
  return {
    durationSeconds: Number(data.format?.duration) || 0,
    width: video.width || 0,
    height: video.height || 0,
    codec: video.codec_name || "unknown",
    audioCodec: streams.find((s) => s.codec_type === "audio")?.codec_name,
    containerFormat: data.format?.format_name || "unknown",
  };
}
export async function generateThumbnail(
  filePath: string,
  outputPath: string,
  input?: MediaInput,
): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.${randomUUID()}.jpg`;
  try {
    // First decoded frame also works for clips shorter than one second.
    await run(
      ffmpegPath,
      [
        "-nostdin",
        "-v",
        "error",
        "-y",
        "-format_whitelist",
        "mov,matroska,webm,avi",
        "-threads",
        "1",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        inputPath(filePath, input),
        "-frames:v",
        "1",
        "-vf",
        "scale=480:-2",
        "-threads",
        "1",
        "-q:v",
        "3",
        temporary,
      ],
      input,
    );
    if ((await fs.stat(temporary)).size === 0)
      throw new Error("No thumbnail frame produced");
    await fs.rename(temporary, outputPath);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
export async function cleanupFailedProcessing(
  videoPath?: string,
  thumbnailPath?: string,
) {
  for (const file of [videoPath, thumbnailPath])
    if (file) await fs.rm(file, { force: true }).catch(() => {});
}
