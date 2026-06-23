import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 400) {
    super(message);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error handling request:', req.method, req.url, err.statusCode, err.message);

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message
      }
    });
  }

  // Multer errors
  if (err.name === 'MulterError') {
    return res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message: err.message
      }
    });
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'An unexpected error occurred.'
    }
  });
}
