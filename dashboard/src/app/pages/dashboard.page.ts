import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';
import { MediaApiService } from '../services/media-api.service';
import { AuthService } from '../services/auth.service';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialogModule } from '@angular/material/dialog';
import { environment } from '../../environments/environment';

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
    MatProgressBarModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule,
    MatDialogModule
  ],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <h1>Dashboard</h1>
      </header>

      <div class="summary-cards">
        <mat-card>
          <mat-card-content>
            <h3>Total Videos</h3>
            <p class="stat">{{ summary?.totalVideos || 0 }}</p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <h3>Storage Used</h3>
            <p class="stat">{{ formatBytes(summary?.totalSizeBytes || 0) }}</p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <h3>Total Likes</h3>
            <p class="stat">{{ summary?.totalLikes || 0 }}</p>
          </mat-card-content>
        </mat-card>
        <mat-card>
          <mat-card-content>
            <h3>Watch Time</h3>
            <p class="stat">{{ formatDuration(summary?.totalWatchTime || 0) }}</p>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="sessions-section" style="margin-bottom: 24px;">
        <mat-card class="table-card">
          <mat-card-header>
            <mat-card-title>Users & Active Sessions</mat-card-title>
          </mat-card-header>
          <mat-card-content>
            <table mat-table [dataSource]="sessions" class="mat-elevation-z0">
              <ng-container matColumnDef="email">
                <th mat-header-cell *matHeaderCellDef> User Email </th>
                <td mat-cell *matCellDef="let element"> {{element.email}} </td>
              </ng-container>
              <ng-container matColumnDef="deviceName">
                <th mat-header-cell *matHeaderCellDef> Device Name </th>
                <td mat-cell *matCellDef="let element"> 
                  <strong>{{element.device_name}}</strong>
                </td>
              </ng-container>
              <ng-container matColumnDef="createdAt">
                <th mat-header-cell *matHeaderCellDef> Logged In </th>
                <td mat-cell *matCellDef="let element"> {{element.created_at | date:'short'}} </td>
              </ng-container>
              <ng-container matColumnDef="actions">
                <th mat-header-cell *matHeaderCellDef> Actions </th>
                <td mat-cell *matCellDef="let element"> 
                  <button mat-stroked-button color="warn" (click)="revokeSession(element)">
                    <mat-icon>logout</mat-icon> Logout Device
                  </button>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedSessionColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedSessionColumns;"></tr>
            </table>
          </mat-card-content>
        </mat-card>
      </div>

      <div class="content-grid">
        <div class="main-col">
          <mat-card class="table-card">
            <mat-card-header>
              <mat-card-title>Videos</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="filters">
                <mat-form-field appearance="outline">
                  <mat-label>Filter by Category</mat-label>
                  <mat-select [(value)]="selectedCategoryFilter" (selectionChange)="applyFilters()">
                    <mat-option value="all">All Categories</mat-option>
                    <mat-option value="uncategorized">Uncategorized</mat-option>
                    <mat-option *ngFor="let cat of categories" [value]="cat.id">{{cat.name}}</mat-option>
                  </mat-select>
                </mat-form-field>
              </div>

              <table mat-table [dataSource]="filteredVideos" class="mat-elevation-z0">
                <ng-container matColumnDef="thumbnail">
                  <th mat-header-cell *matHeaderCellDef> Thumbnail </th>
                  <td mat-cell *matCellDef="let element"> 
                    <img [src]="getThumbnailUrl(element)" width="60" height="80" class="thumb" /> 
                  </td>
                </ng-container>

                <ng-container matColumnDef="title">
                  <th mat-header-cell *matHeaderCellDef> Title / Filename </th>
                  <td mat-cell *matCellDef="let element"> 
                    <strong>{{element.title}}</strong><br>
                    <small class="text-muted">{{element.originalFilename}}</small>
                  </td>
                </ng-container>

                <ng-container matColumnDef="tags">
                  <th mat-header-cell *matHeaderCellDef> Tags </th>
                  <td mat-cell *matCellDef="let element"> 
                    <div>
                      <mat-chip-set>
                        <mat-chip *ngFor="let tag of element.tags" [style.background-color]="tag.color" [style.color]="'#fff'" (removed)="removeTagFromVideo(element.id, tag.id)">
                          {{tag.name}}
                          <button matChipRemove><mat-icon>cancel</mat-icon></button>
                        </mat-chip>
                      </mat-chip-set>
                      <mat-form-field appearance="outline" class="tag-select-field">
                        <mat-label>Add tag</mat-label>
                        <mat-select (selectionChange)="addTagToVideo(element, $event.value)">
                          <mat-option *ngFor="let tag of availableTags" [value]="tag.id">{{tag.name}}</mat-option>
                        </mat-select>
                      </mat-form-field>
                    </div>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let element"> 
                    <button mat-icon-button color="warn" (click)="deleteVideo(element)">
                      <mat-icon>delete</mat-icon>
                    </button>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
              </table>
            </mat-card-content>
          </mat-card>
        </div>

        <div class="side-col">
          <mat-card class="upload-card">
            <mat-card-header>
              <mat-card-title>Upload Video</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="uploadForm" (ngSubmit)="onUpload()">
                <div class="file-input-container">
                  <button type="button" mat-stroked-button (click)="fileInput.click()">Select File</button>
                  <input type="file" #fileInput (change)="onFileSelected($event)" accept="video/mp4" style="display: none;" />
                  <p *ngIf="selectedFile" class="file-name">{{ selectedFile.name }} ({{ formatBytes(selectedFile.size) }})</p>
                </div>
                
                <mat-form-field appearance="outline" class="full-width mt-2">
                  <mat-label>Title (optional)</mat-label>
                  <input matInput formControlName="title">
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width mt-2">
                  <mat-label>Tags</mat-label>
                  <mat-select formControlName="tags" multiple>
                    <mat-option *ngFor="let tag of availableTags" [value]="tag.id">{{tag.name}}</mat-option>
                  </mat-select>
                </mat-form-field>
                
                <div *ngIf="uploadProgress > 0 && uploadProgress < 100" class="progress-container">
                  <mat-progress-bar mode="determinate" [value]="uploadProgress"></mat-progress-bar>
                  <span class="progress-text">{{uploadProgress}}%</span>
                </div>

                <button mat-flat-button color="primary" type="submit" [disabled]="uploadForm.invalid || !selectedFile || isUploading" class="full-width mt-2">
                  <mat-icon>upload</mat-icon> Upload
                </button>
              </form>
            </mat-card-content>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container { padding: 24px; max-width: 1400px; margin: 0 auto; }
    .header h1 { font-weight: 300; margin-bottom: 24px; }
    .summary-cards { display: grid; grid-template-columns: repeat(4, 1fr); gap: 24px; margin-bottom: 24px; }
    .stat { font-size: 32px; font-weight: bold; color: #E040FB; margin: 0; }
    .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
    .full-width { width: 100%; }
    .mt-2 { margin-top: 16px; }
    .thumb { object-fit: cover; border-radius: 4px; background: #eee; }
    .text-muted { color: #888; }
    .file-input-container { padding: 16px; border: 2px dashed #ccc; border-radius: 4px; text-align: center; }
    .file-name { margin-top: 8px; font-size: 14px; word-break: break-all; }
    .progress-container { margin-top: 16px; }
    .progress-text { font-size: 12px; color: #666; display: block; text-align: right; margin-top: 4px; }
    .category-select { width: 150px; }
    .tag-select-field { width: 120px; margin-left: 8px; margin-top: 8px; }
    .filters { margin-bottom: 16px; }
  `]
})
export class DashboardPage implements OnInit {
  private api = inject(MediaApiService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private authService = inject(AuthService);
  
  summary: any;
  videos: any[] = [];
  filteredVideos: any[] = [];
  categories: any[] = [];
  availableTags: any[] = [];
  sessions: any[] = [];
  
  selectedCategoryFilter = 'all';
  displayedColumns = ['thumbnail', 'title', 'tags', 'actions'];
  displayedSessionColumns = ['email', 'deviceName', 'createdAt', 'actions'];
  
  uploadForm = this.fb.group({ 
    title: [''],
    tags: [[] as string[]]
  });
  selectedFile: File | null = null;
  isUploading = false;
  uploadProgress = 0;

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getSummary().subscribe(s => this.summary = s);
    this.api.getTags().subscribe(t => this.availableTags = t);
    this.api.getCategories(true).subscribe(c => {
      this.categories = c;
      this.loadVideos();
    });
    this.loadSessions();
  }

  loadSessions() {
    this.authService.getSessions().subscribe({
      next: (res) => {
        this.sessions = res.sessions;
      },
      error: () => {
        this.snackBar.open('Failed to load sessions', 'Close', { duration: 3000 });
      }
    });
  }

  revokeSession(session: any) {
    if (confirm(`Are you sure you want to logout device ${session.device_name} for ${session.email}?`)) {
      this.authService.revokeSession(session.id).subscribe({
        next: () => {
          this.snackBar.open('Device logged out.', 'Close', { duration: 3000 });
          this.loadSessions();
        },
        error: () => {
          this.snackBar.open('Failed to logout device.', 'Close', { duration: 3000 });
        }
      });
    }
  }

  loadVideos() {
    this.api.getVideos().subscribe(res => {
      this.videos = res.videos;
      this.applyFilters();
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



  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
    }
  }

  onUpload() {
    if (!this.selectedFile || this.uploadForm.invalid) return;
    this.isUploading = true;
    this.uploadProgress = 0;

    const fd = new FormData();
    fd.append('video', this.selectedFile);
    
    const formVals = this.uploadForm.value;
    if (formVals.title) fd.append('title', formVals.title);
    if (formVals.tags && formVals.tags.length > 0) fd.append('tags', JSON.stringify(formVals.tags));

    this.api.uploadVideo(fd).subscribe({
      next: (event: any) => {
        if (event.type === HttpEventType.UploadProgress) {
          this.uploadProgress = Math.round(100 * event.loaded / event.total);
        } else if (event.type === HttpEventType.Response) {
          this.isUploading = false;
          this.selectedFile = null;
          this.uploadProgress = 0;
          this.uploadForm.reset({ tags: [] });
          this.snackBar.open('Upload successful!', 'Close', { duration: 3000 });
          this.loadData();
        }
      },
      error: (err) => {
        this.isUploading = false;
        this.uploadProgress = 0;
        const msg = err.error?.error?.message || err.message;
        this.snackBar.open(`Upload failed: ${msg}`, 'Close', { duration: 5000 });
      }
    });
  }

  deleteVideo(video: any) {
    if (confirm(`Are you sure you want to delete ${video.title}?`)) {
      this.api.deleteVideo(video.id).subscribe({
        next: () => {
          this.snackBar.open('Video deleted.', 'Close', { duration: 3000 });
          this.loadData();
        },
        error: () => {
          this.snackBar.open('Delete failed.', 'Close', { duration: 3000 });
        }
      });
    }
  }

  addTagToVideo(video: any, tagId: string) {
    if (tagId) {
      this.api.attachTag(video.id, tagId).subscribe(() => this.loadVideos());
    }
  }

  removeTagFromVideo(videoId: string, tagId: string) {
    this.api.detachTag(videoId, tagId).subscribe(() => this.loadVideos());
  }

  formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
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

  getThumbnailUrl(video: any): string {
    return video.thumbnailUrl;
  }
}
