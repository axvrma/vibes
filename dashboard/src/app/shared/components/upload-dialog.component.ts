import { Component, Inject, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';

import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';

import { MediaApiService } from '../../services/media-api.service';

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatDialogModule, MatIconModule,
    MatProgressBarModule, MatInputModule, MatFormFieldModule,
    MatSelectModule
  ],
  template: `
    <h2 mat-dialog-title>Upload Video</h2>
    <mat-dialog-content>
      <form [formGroup]="uploadForm" class="upload-form">
        <div 
          class="file-drop-zone" 
          [class.has-file]="selectedFiles.length > 0"
          (click)="fileInput.click()"
          (dragover)="onDragOver($event)"
          (drop)="onDrop($event)"
          (dragleave)="onDragLeave($event)"
        >
          <input type="file" #fileInput (change)="onFileSelected($event)" accept="video/mp4" multiple style="display: none;" />
          
          <ng-container *ngIf="selectedFiles.length === 0">
            <mat-icon class="upload-icon">cloud_upload</mat-icon>
            <p class="drop-text">Drag and drop MP4 files here or click to browse</p>
            <p class="limit-text">Max file size depends on server limits</p>
          </ng-container>

          <ng-container *ngIf="selectedFiles.length > 0">
            <div class="file-list">
              <div class="file-item" *ngFor="let file of selectedFiles; let i = index">
                <mat-icon class="success">check_circle</mat-icon>
                <div class="file-info">
                  <span class="file-name" [title]="file.name">{{ file.name }}</span>
                  <span class="file-size">{{ formatBytes(file.size) }}</span>
                </div>
                <button mat-icon-button color="warn" (click)="removeFile(i, $event)" [disabled]="isUploading">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            </div>
          </ng-container>
        </div>
        
        <mat-form-field appearance="outline" class="full-width mt-3" *ngIf="selectedFiles.length <= 1">
          <mat-label>Title (optional)</mat-label>
          <input matInput formControlName="title" placeholder="Extracted from filename if empty">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tags</mat-label>
          <mat-select formControlName="tags" multiple>
            <mat-option *ngFor="let tag of data.availableTags" [value]="tag.id">
              <span class="tag-color-dot" [style.background-color]="tag.color"></span>
              {{tag.name}}
            </mat-option>
          </mat-select>
        </mat-form-field>
        
        <div *ngIf="isUploading" class="progress-section">
          <div class="progress-header">
            <span>Uploading {{ currentUploadIndex + 1 }} of {{ selectedFiles.length }}...</span>
            <span>{{uploadProgress}}%</span>
          </div>
          <mat-progress-bar mode="determinate" [value]="uploadProgress"></mat-progress-bar>
        </div>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close [disabled]="isUploading">Cancel</button>
      <button mat-flat-button color="primary" (click)="onUpload()" [disabled]="uploadForm.invalid || selectedFiles.length === 0 || isUploading">
        <mat-icon>upload</mat-icon> Upload {{ selectedFiles.length > 1 ? selectedFiles.length + ' Files' : '' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .upload-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: 400px;
      margin-top: 8px;
    }

    .file-drop-zone {
      border: 2px dashed var(--app-outline);
      border-radius: 12px;
      padding: 32px 24px;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s ease;
      background-color: var(--app-surface-container);

      &:hover, &.drag-over {
        border-color: var(--app-primary);
        background-color: var(--app-surface-container-high);
      }

      &.has-file {
        border-style: solid;
        border-color: var(--app-success);
        background-color: color-mix(in srgb, var(--app-success) 5%, transparent);
      }
    }

    .upload-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: var(--app-text-secondary);
      margin-bottom: 16px;

      &.success {
        color: var(--app-success);
      }
    }

    .drop-text {
      font-size: 16px;
      font-weight: 500;
      color: var(--app-text-primary);
      margin: 0 0 8px 0;
    }

    .limit-text, .file-size {
      font-size: 12px;
      color: var(--app-text-secondary);
      margin: 0;
    }

    .file-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      max-height: 200px;
      overflow-y: auto;
      text-align: left;
    }

    .file-item {
      display: flex;
      align-items: center;
      background: var(--app-surface);
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid var(--app-outline-variant);
    }

    .file-item mat-icon.success {
      margin-right: 12px;
      margin-bottom: 0;
      width: 24px;
      height: 24px;
      font-size: 24px;
    }

    .file-info {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
    }

    .file-name {
      font-size: 14px;
      font-weight: 500;
      color: var(--app-text-primary);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .full-width {
      width: 100%;
    }
    
    .mt-3 {
      margin-top: 16px;
    }

    .tag-color-dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }

    .progress-section {
      margin-top: 8px;

      .progress-header {
        display: flex;
        justify-content: space-between;
        font-size: 12px;
        color: var(--app-text-secondary);
        margin-bottom: 8px;
      }
    }
  `]
})
export class UploadDialogComponent {
  private api = inject(MediaApiService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  
  uploadForm = this.fb.group({ 
    title: [''],
    tags: [[] as string[]]
  });
  
  selectedFiles: File[] = [];
  isUploading = false;
  currentUploadIndex = 0;
  uploadProgress = 0;

  constructor(
    public dialogRef: MatDialogRef<UploadDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { availableTags: any[] }
  ) {}

  onFileSelected(event: any) {
    const files = event.target.files;
    if (files && files.length > 0) {
      this.addFiles(Array.from(files));
    }
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.add('drag-over');
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('drag-over');
    
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  addFiles(files: File[]) {
    let hasInvalid = false;
    for (const file of files) {
      if (file.type === 'video/mp4') {
        this.selectedFiles.push(file);
      } else {
        hasInvalid = true;
      }
    }
    if (hasInvalid) {
      this.snackBar.open('Some files were ignored because they are not MP4', 'Close', { duration: 3000 });
    }
  }

  removeFile(index: number, event: Event) {
    event.stopPropagation();
    this.selectedFiles.splice(index, 1);
  }

  async onUpload() {
    if (this.selectedFiles.length === 0 || this.uploadForm.invalid) return;
    this.isUploading = true;

    for (let i = 0; i < this.selectedFiles.length; i++) {
      this.currentUploadIndex = i;
      this.uploadProgress = 0;
      await this.uploadSingleFile(this.selectedFiles[i]);
    }

    this.isUploading = false;
    this.snackBar.open('Uploads completed!', 'Close', { duration: 3000 });
    this.dialogRef.close(true); // Return true to indicate success
  }

  uploadSingleFile(file: File): Promise<void> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append('video', file);
      
      const formVals = this.uploadForm.value;
      if (this.selectedFiles.length === 1 && formVals.title) {
        fd.append('title', formVals.title);
      }
      if (formVals.tags && formVals.tags.length > 0) {
        fd.append('tags', JSON.stringify(formVals.tags));
      }

      this.api.uploadVideo(fd).subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            this.uploadProgress = Math.round(100 * event.loaded / event.total);
          } else if (event.type === HttpEventType.Response) {
            resolve();
          }
        },
        error: (err) => {
          const msg = err.error?.error?.message || err.message;
          this.snackBar.open(`Upload failed for ${file.name}: ${msg}`, 'Close', { duration: 5000 });
          resolve(); // Continue to next file even if one fails
        }
      });
    });
  }

  formatBytes(bytes: number) {
    if (bytes === 0) return '0 B';
    const k = 1024, dm = 2, sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }
}
