import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-video-player-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  template: `
    <div class="video-dialog-header">
      <h2 mat-dialog-title>{{ data.title || 'Video Player' }}</h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      <video [src]="data.streamUrl" controls autoplay class="video-player"></video>
    </mat-dialog-content>
  `,
  styles: [`
    .video-dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 0 16px;
    }
    .video-dialog-header h2 {
      margin: 0;
      font-size: 18px;
    }
    mat-dialog-content {
      padding: 0;
      background: #000;
      display: flex;
      justify-content: center;
      align-items: center;
      overflow: hidden;
    }
    .video-player {
      width: 100%;
      height: 100%;
      max-height: 80vh;
      object-fit: contain;
    }
  `]
})
export class VideoPlayerDialogComponent {
  constructor(
    public dialogRef: MatDialogRef<VideoPlayerDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { title: string; streamUrl: string }
  ) {}
}
