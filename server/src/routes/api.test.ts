import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import apiRoutes from './api';
import { errorHandler } from '../middleware/error-handler';
import { videoRepo } from '../db/repository';

const app = express();
app.use(express.json());
app.use('/api', apiRoutes);
app.use(errorHandler);

// Mock videoRepo partially for quick tests
vi.mock('../db/repository', () => ({
  videoRepo: {
    getSummary: () => ({ totalVideos: 0, totalSizeBytes: 0, totalTags: 0 }),
    listReadyWithTags: () => []
  },
  tagRepo: {
    listAll: () => []
  },
  stateRepo: {}
}));

describe('API Endpoints', () => {
  it('should return 200 on /api/summary', async () => {
    const response = await request(app).get('/api/summary');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ totalVideos: 0, totalSizeBytes: 0, totalTags: 0 });
  });

  it('should return empty videos array on /api/videos', async () => {
    const response = await request(app).get('/api/videos');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ videos: [] });
  });

  it('should return empty tags array on /api/tags', async () => {
    const response = await request(app).get('/api/tags');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([]);
  });
});
