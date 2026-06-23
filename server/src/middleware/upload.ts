import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { AppError } from './error-handler';

const dataDir = process.env.DATA_DIR || path.join(__dirname, '../../../data');
const uploadsDir = path.join(dataDir, 'uploads');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    const filename = `${uuidv4()}${ext}`;
    cb(null, filename);
  }
});

const MAX_MB = parseInt(process.env.MAX_UPLOAD_MB || '1024', 10);

export const upload = multer({
  storage,
  limits: {
    fileSize: MAX_MB * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['video/mp4', 'video/quicktime', 'video/x-m4v'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return cb(new AppError('INVALID_FORMAT', 'Only MP4/MOV files are allowed in v1', 400));
    }
    cb(null, true);
  }
});
