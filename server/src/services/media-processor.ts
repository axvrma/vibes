import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';

export interface VideoMetadata {
  durationSeconds: number;
  width: number;
  height: number;
  codec: string;
  audioCodec?: string;
  containerFormat: string;
}

const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';
const ffmpegPath = process.env.FFMPEG_PATH || 'ffmpeg';

export async function inspectVideo(filePath: string): Promise<VideoMetadata> {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      filePath
    ];

    const child = spawn(ffprobePath, args);
    let output = '';
    let errorOutput = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`ffprobe exited with code ${code}: ${errorOutput}`));
      }

      try {
        const metadata = JSON.parse(output);
        const format = metadata.format;
        const videoStream = metadata.streams?.find((s: any) => s.codec_type === 'video');
        const audioStream = metadata.streams?.find((s: any) => s.codec_type === 'audio');

        if (!videoStream) {
          return reject(new Error('No video stream found'));
        }

        resolve({
          durationSeconds: parseFloat(format.duration) || 0,
          width: videoStream.width || 0,
          height: videoStream.height || 0,
          codec: videoStream.codec_name || 'unknown',
          audioCodec: audioStream?.codec_name,
          containerFormat: format.format_name || 'unknown',
        });
      } catch (err) {
        reject(new Error(`Failed to parse ffprobe output: ${err}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start ffprobe: ${err.message}`));
    });
  });
}

export async function generateThumbnail(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = [
      '-y', // overwrite output
      '-i', inputPath,
      '-ss', '00:00:01.000', // 1 second in
      '-vframes', '1',
      '-f', 'image2',
      '-q:v', '2',
      outputPath
    ];

    const child = spawn(ffmpegPath, args);
    let errorOutput = '';

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${errorOutput}`));
      }
    });

    child.on('error', (err) => {
      reject(new Error(`Failed to start ffmpeg: ${err.message}`));
    });
  });
}

export async function cleanupFailedProcessing(videoPath?: string, thumbnailPath?: string) {
  if (videoPath) {
    try {
      await fs.unlink(videoPath);
    } catch (e) {
      // ignore
    }
  }
  if (thumbnailPath) {
    try {
      await fs.unlink(thumbnailPath);
    } catch (e) {
      // ignore
    }
  }
}
