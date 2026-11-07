import { Component, Inject, inject, Optional } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpEventType } from '@angular/common/http';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmSpinnerImports } from '@spartan-ng/helm/spinner';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';

import { MediaApiService } from '../../services/media-api.service';

import { provideIcons } from '@ng-icons/core';
import { lucideUpload, lucideCheck, lucideX } from '@ng-icons/lucide';

@Component({
  selector: 'app-upload-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    HlmButtonImports, HlmIconImports,
    HlmInputImports, HlmLabelImports, HlmSpinnerImports
  ],
  providers: [
    provideIcons({ lucideUpload, lucideCheck, lucideX })
  ],
  template: `
    <div class="flex flex-col gap-4 p-6 w-full max-w-lg mx-auto bg-card text-card-foreground rounded-lg">
      <h2 class="text-lg font-semibold tracking-tight">Upload Video</h2>

      <p *ngIf="message" role="status" class="text-sm text-muted-foreground">{{message}}</p>
      <form [formGroup]="uploadForm" class="flex flex-col gap-4">
        <div
          class="flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-8 cursor-pointer transition-colors"
          [ngClass]="{'border-primary bg-primary/5': selectedFiles.length > 0, 'hover:bg-muted': selectedFiles.length === 0}"
          role="button" tabindex="0" aria-label="Choose MP4 videos"
          (keydown.enter)="fileInput.click()" (keydown.space)="$event.preventDefault();fileInput.click()"
          (click)="fileInput.click()"
          (dragover)="onDragOver($event)"
          (drop)="onDrop($event)"
          (dragleave)="onDragLeave($event)"
        >
          <input type="file" #fileInput (change)="onFileSelected($event)" accept="video/mp4" multiple class="hidden" />

          <ng-container *ngIf="selectedFiles.length === 0">
            <ng-icon hlm name="lucideUpload" class="h-12 w-12 text-muted-foreground mb-4"></ng-icon>
            <p class="text-sm font-medium">Drag and drop MP4 files here or click to browse</p>
            <p class="text-xs text-muted-foreground mt-1">Max file size depends on server limits</p>
          </ng-container>

          <ng-container *ngIf="selectedFiles.length > 0">
            <div class="flex flex-col w-full gap-2 max-h-[200px] overflow-y-auto">
              <div class="flex items-center justify-between p-2 rounded-md border bg-background" *ngFor="let file of selectedFiles; let i = index">
                <div class="flex items-center space-x-2 overflow-hidden">
                  <ng-icon hlm name="lucideCheck" class="h-5 w-5 text-green-500 shrink-0"></ng-icon>
                  <div class="flex flex-col overflow-hidden">
                    <span class="text-sm font-medium truncate" [title]="file.name">{{ file.name }}</span>
                    <span class="text-xs text-muted-foreground">{{ formatBytes(file.size) }}</span>
                  </div>
                </div>
                <button type="button" hlmBtn variant="ghost" size="icon" (click)="removeFile(i, $event)" [disabled]="isUploading">
                  <ng-icon hlm name="lucideX" class="h-4 w-4"></ng-icon>
                </button>
              </div>
            </div>
          </ng-container>
        </div>

        <div class="space-y-2" *ngIf="selectedFiles.length <= 1">
          <label hlmLabel>Title (optional)</label>
          <input hlmInput formControlName="title" class="w-full" placeholder="Extracted from filename if empty">
        </div>

        <label class="space-y-2">Category<select formControlName="categoryId" class="w-full rounded-md border bg-background p-2"><option value="">Use tags / no direct category</option><option *ngFor="let category of dialogContext.categories" [value]="category.id">{{category.name}}</option></select></label>
        <div class="space-y-2">
          <label hlmLabel>Tags</label>
          <select formControlName="tags" multiple class="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50">
            <option *ngFor="let tag of dialogContext.availableTags" [value]="tag.id">
              {{tag.name}}
            </option>
          </select>
          <p class="text-xs text-muted-foreground">Hold Ctrl/Cmd to select multiple tags.</p>
        </div>

        <div *ngIf="isUploading" class="space-y-2 pt-2">
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>Uploading {{ currentUploadIndex + 1 }} of {{ selectedFiles.length }}...</span>
            <span>{{uploadProgress}}%</span>
          </div>
          <div class="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div class="h-full bg-primary transition-all duration-300" [style.width.%]="uploadProgress"></div>
          </div>
        </div>
      </form>

      <div class="flex justify-end space-x-2 pt-4">
        <button hlmBtn variant="ghost" (click)="closeDialog()" [disabled]="isUploading">Cancel</button>
        <button hlmBtn (click)="onUpload()" [disabled]="uploadForm.invalid || selectedFiles.length === 0 || isUploading">
          <hlm-spinner *ngIf="isUploading" class="mr-2 h-4 w-4"></hlm-spinner>
          <ng-icon hlm *ngIf="!isUploading" name="lucideUpload" class="mr-2 h-4 w-4"></ng-icon>
          Upload {{ selectedFiles.length > 1 ? selectedFiles.length + ' Files' : '' }}
        </button>
      </div>
    </div>
  `
})
export class UploadDialogComponent {
  private api = inject(MediaApiService);
  private fb = inject(FormBuilder);

  private _dialogRef = inject(BrnDialogRef, { optional: true });
  public dialogContext = injectBrnDialogContext<{ availableTags: any[];categories:any[] }>({ optional: true }) || { availableTags: [],categories:[] };

  uploadForm = this.fb.group({
    title: [''],
    categoryId:[''],
    tags: [[] as string[]]
  });

  selectedFiles: File[] = [];
  isUploading = false;
  currentUploadIndex = 0;
  uploadProgress = 0;
  message='';

  closeDialog(result?: boolean) {
    if (this._dialogRef) {
      this._dialogRef.close(result);
    }
  }

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
    target.classList.add('border-primary');
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('border-primary');
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const target = event.currentTarget as HTMLElement;
    target.classList.remove('border-primary');

    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.addFiles(Array.from(event.dataTransfer.files));
    }
  }

  addFiles(files: File[]) {
    let hasInvalid = false;
    for (const file of files) {
      if (file.type === 'video/mp4' || /\.mp4$/i.test(file.name)) {
        this.selectedFiles.push(file);
      } else {
        hasInvalid = true;
      }
    }
    if (hasInvalid) {
      this.message='Some files were ignored because they are not MP4. Uploads require H.264 video in an MP4 container.';
    }
  }

  removeFile(index: number, event: Event) {
    event.stopPropagation();
    this.selectedFiles.splice(index, 1);
  }

  async onUpload() {
    if (this.selectedFiles.length === 0 || this.uploadForm.invalid) return;
    this.isUploading = true;

    const failed:File[]=[];
    const messages:string[]=[];
    for (let i=0;i<this.selectedFiles.length;i++) {
      this.currentUploadIndex=i;this.uploadProgress=0;
      try {await this.uploadSingleFile(this.selectedFiles[i]);}
      catch(err){failed.push(this.selectedFiles[i]);messages.push(String(err));}
    }
    this.isUploading=false;
    if(failed.length){this.selectedFiles=failed;this.message=messages.join(' ');}
    else this.closeDialog(true);
  }

  uploadSingleFile(file: File): Promise<void> {
    return new Promise((resolve,reject) => {
      const fd = new FormData();
      fd.append('video', file);

      const formVals = this.uploadForm.value;
      if (this.selectedFiles.length === 1 && formVals.title) {
        fd.append('title', formVals.title);
      }
      if(formVals.categoryId)fd.append('categoryId',formVals.categoryId);
      if (formVals.tags && formVals.tags.length > 0) {
        fd.append('tags', JSON.stringify(formVals.tags));
      }

      this.api.uploadVideo(fd).subscribe({
        next: (event: any) => {
          if (event.type === HttpEventType.UploadProgress) {
            this.uploadProgress = Math.round(100 * event.loaded / (event.total || file.size));
          } else if (event.type === HttpEventType.Response) {
            resolve();
          }
        },
        error: (err) => {
          const msg = err.error?.error?.message || err.message;
          reject(`Upload failed for ${file.name}: ${msg}. Retry keeps only unsuccessful files.`);
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
