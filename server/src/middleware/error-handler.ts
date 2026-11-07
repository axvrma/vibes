import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export class AppError extends Error {
  constructor(public code: string, message: string, public statusCode: number = 400) {
    super(message);
  }
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Error handling request:', req.method, req.path, err.statusCode, err.message);

  if (err instanceof ZodError) return res.status(400).json({error:{code:'INVALID_INPUT',message:err.issues.map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}});
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') return res.status(409).json({error:{code:'DUPLICATE',message:'This name or source already exists.'}});
  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') return res.status(400).json({error:{code:'INVALID_REFERENCE',message:'The selected category, tag or video does not exist.'}});
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
