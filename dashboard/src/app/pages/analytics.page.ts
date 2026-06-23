import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MediaApiService } from '../services/media-api.service';

import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MetricCardComponent } from '../shared/components/metric-card.component';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatButtonModule } from '@angular/material/button';

export interface TopVideo {
  id: string;
  title: string;
  original_filename: string;
  total_watch_time?: number;
  likes?: number;
}

export interface Summary {
  totalVideos: number;
  totalSizeBytes: number;
  totalTags: number;
  totalLikes: number;
  totalWatchTime: number;
  totalUsers: number;
  topWatched: TopVideo[];
  topLiked: TopVideo[];
}

@Component({
  selector: 'app-analytics-page',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatIconModule,
    MatTableModule,
    MetricCardComponent,
    MatProgressSpinnerModule,
    MatButtonModule
  ],
  templateUrl: './analytics.page.html',
  styleUrls: ['./analytics.page.scss']
})
export class AnalyticsPage implements OnInit {
  private api = inject(MediaApiService);

  summary: Summary | null = null;
  isLoading = true;

  displayedColumnsWatched = ['title', 'watchTime'];
  displayedColumnsLiked = ['title', 'likes'];

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    this.api.getSummary().subscribe({
      next: (s) => {
        this.summary = s;
        this.isLoading = false;
      },
      error: () => {
        this.isLoading = false;
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
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    if (h > 0) {
      return `${h}h ${m}m ${s}s`;
    }
    return `${m}m ${s}s`;
  }
}
