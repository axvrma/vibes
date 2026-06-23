import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, Observable } from 'rxjs';
import { MediaApiService } from '../services/media-api.service';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';

import { MetricCardComponent } from '../shared/components/metric-card.component';
import { UploadDialogComponent } from '../shared/components/upload-dialog.component';
import { ConfirmDeleteDialogComponent } from '../shared/components/confirm-delete-dialog.component';
import { VideoPlayerDialogComponent } from '../shared/components/video-player-dialog.component';
import { UpdateTagsDialogComponent } from '../shared/components/update-tags-dialog.component';

import { AuthService } from '../services/auth.service';

export interface Video {
  id: string;
  title: string;
  originalFilename: string;
  duration: number;
  sizeBytes: number;
  category?: { id: string; name: string; color: string; };
  tags: any[];
  thumbnailUrl: string;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule,
    MatMenuModule,
    MetricCardComponent
  ],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss']
})
export class DashboardPage implements OnInit {
  private api = inject(MediaApiService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private auth = inject(AuthService);
  
  summary: any;
  videos: Video[] = [];
  filteredVideos: Video[] = [];
  categories: any[] = [];
  availableTags: any[] = [];
  isLoading = true;
  
  selectedCategoryFilter = 'all';
  displayedColumns = ['thumbnail', 'title', 'category', 'tags', 'duration', 'size', 'actions'];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.api.getSummary().subscribe(s => this.summary = s);
    this.api.getTags().subscribe(t => this.availableTags = t);
    this.api.getCategories(true).subscribe(c => {
      this.categories = c;
      this.loadVideos();
    });
  }

  loadVideos() {
    this.api.getVideos().subscribe(res => {
      this.videos = res.videos;
      this.applyFilters();
      this.isLoading = false;
    });
  }

  applyFilters() {
    if (this.selectedCategoryFilter === 'all') {
      this.filteredVideos = [...this.videos];
    } else if (this.selectedCategoryFilter === 'uncategorized') {
      this.filteredVideos = this.videos.filter(v => !v.category);
    } else {
      this.filteredVideos = this.videos.filter(v => v.category?.id === this.selectedCategoryFilter);
    }
  }

  getTopTags(video: Video): any[] {
    return (video.tags || []).slice(0, 2);
  }

  getThumbnailUrl(url: string | undefined): string {
    if (!url) return 'assets/placeholder.png';
    const token = this.auth.token;
    if (token) {
      return `${url}?token=${token}`;
    }
    return url;
  }

  playVideo(video: Video) {
    let streamUrl = `/api/videos/${video.id}/stream`;
    if (this.auth.token) {
      streamUrl += `?token=${this.auth.token}`;
    }
    this.dialog.open(VideoPlayerDialogComponent, {
      width: '80vw',
      maxWidth: '900px',
      data: { title: video.title || video.originalFilename, streamUrl }
    });
  }

  openUploadDialog() {
    const dialogRef = this.dialog.open(UploadDialogComponent, {
      width: '600px',
      disableClose: true,
      data: { availableTags: this.availableTags }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result) {
        this.loadData();
      }
    });
  }

  deleteVideo(video: any) {
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Video',
        message: `Are you sure you want to delete "${video.title || video.originalFilename}"?`,
        warningText: 'The media file and thumbnail will be permanently deleted.'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.api.deleteVideo(video.id).subscribe({
          next: () => {
            this.snackBar.open('Video deleted successfully.', 'Close', { duration: 3000 });
            this.loadData();
          },
          error: () => {
            this.snackBar.open('Delete failed.', 'Close', { duration: 3000 });
          }
        });
      }
    });
  }

  addTagToVideo(video: any, tagId: string) {
    if (tagId) {
      this.api.attachTag(video.id, tagId).subscribe(() => this.loadVideos());
    }
  }

  removeTagFromVideo(videoId: string, tagId: string) {
    this.api.detachTag(videoId, tagId).subscribe(() => this.loadVideos());
  }

  updateTags(video: Video) {
    const dialogRef = this.dialog.open(UpdateTagsDialogComponent, {
      width: '400px',
      data: {
        videoId: video.id,
        currentTags: video.tags,
        availableTags: this.availableTags
      }
    });

    dialogRef.afterClosed().subscribe(selectedTags => {
      if (!selectedTags) return; // User cancelled
      
      const currentTagIds = (video.tags || []).map(t => t.id);
      const newTagIds = selectedTags as string[];
      
      const tagsToAdd = newTagIds.filter(id => !currentTagIds.includes(id));
      const tagsToRemove = currentTagIds.filter(id => !newTagIds.includes(id));
      
      const requests: Observable<any>[] = [];
      
      tagsToAdd.forEach(id => {
        requests.push(this.api.attachTag(video.id, id));
      });
      
      tagsToRemove.forEach(id => {
        requests.push(this.api.detachTag(video.id, id));
      });
      
      if (requests.length > 0) {
        forkJoin(requests).subscribe({
          next: () => {
            this.snackBar.open('Tags updated successfully.', 'Close', { duration: 3000 });
            this.loadVideos();
          },
          error: () => {
            this.snackBar.open('Failed to update tags.', 'Close', { duration: 3000 });
            this.loadVideos();
          }
        });
      }
    });
  }

  formatBytes(bytes: number) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024, dm = 2, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number) {
    if (!seconds) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

}
