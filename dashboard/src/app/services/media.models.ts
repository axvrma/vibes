export interface MediaTag {
  id: string;
  name: string;
  color: string;
}
export interface MediaCategory extends MediaTag {
  slug: string;
  is_active: number;
}
export interface ScanJob {
  id: string;
  library_id: string;
  status: string;
  started_at: string | null;
  completed_at: string | null;
  discovered_count: number;
  added_count: number;
  updated_count: number;
  missing_count: number;
  skipped_count: number;
  failed_count: number;
  duration_ms: number | null;
  error_summary: string | null;
}
export interface MediaLibrary {
  id: string;
  name: string;
  root_id: string;
  relative_path: string;
  authorized_path: string;
  enabled: number;
  recursive: number;
  folder_categories: number;
  default_category_id: string | null;
  available: boolean;
  video_count: number;
  total_size_bytes: number;
  lastScan: ScanJob | null;
  lastSuccessfulScan: ScanJob | null;
}
export interface LibraryConfig {
  name: string;
  rootId: string;
  relativePath: string;
  enabled: boolean;
  recursive: boolean;
  folderCategories: boolean;
  defaultCategoryId: string | null;
}
export interface MediaVideo {
  id: string;
  title: string;
  originalFilename: string;
  durationSeconds: number;
  sizeBytes: number;
  category?: MediaCategory;
  tags: MediaTag[];
  thumbnailUrl: string;
  streamUrl: string;
  sourceType: 'upload' | 'external';
  availability: string;
  libraryId?: string;
  browserCompatible?: boolean;
}
export interface VideoPage {
  videos: MediaVideo[];
  pagination: { page: number; limit: number; total: number; hasMore: boolean };
}
export interface Overview {
  topWatched: {
    id: string;
    title: string;
    original_filename: string;
    total_watch_time?: number;
  }[];
  topLiked: {
    id: string;
    title: string;
    original_filename: string;
    likes?: number;
  }[];
  totalVideos: number;
  totalSizeBytes: number;
  totalTags: number;
  totalLikes: number;
  totalWatchTime: number;
  totalUsers: number;
  indexedVideos: number;
  uploadedVideos: number;
  libraries: number;
  failedScans: number;
  processingQueue: number;
  recentScans: (ScanJob & { library_name: string })[];
  recentAdditions: {
    id: string;
    title: string;
    source_type: string;
    created_at: string;
  }[];
}
