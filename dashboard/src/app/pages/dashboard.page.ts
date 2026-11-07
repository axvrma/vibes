import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { forkJoin, Observable, Subscription } from 'rxjs';
import { MediaApiService } from '../services/media-api.service';

import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmIconImports } from '@spartan-ng/helm/icon';
import { HlmTableImports } from '@spartan-ng/helm/table';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabelImports } from '@spartan-ng/helm/label';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';


import { HlmDialogService } from '../components/ui/dialog/src/lib/hlm-dialog.service';

import { MetricCardComponent } from '../shared/components/metric-card.component';
import { UploadDialogComponent } from '../shared/components/upload-dialog.component';
import { VideoPlayerDialogComponent } from '../shared/components/video-player-dialog.component';
import { UpdateTagsDialogComponent } from '../shared/components/update-tags-dialog.component';

import { VideoDetailDialogComponent } from '../shared/components/video-detail-dialog.component';
import { AuthService } from '../services/auth.service';
import { ActivatedRoute } from '@angular/router';
import { FeedbackService } from '../shared/components/confirmation-dialog.component';

import { provideIcons } from '@ng-icons/core';
import { lucideUpload, lucideVideo, lucideDatabase, lucideFolder, lucideTag, lucideCirclePlay, lucideEllipsisVertical, lucideTrash, lucideSearch } from '@ng-icons/lucide';

export interface Video {
  id: string;
  title: string;
  originalFilename: string;
  durationSeconds: number;
  sizeBytes: number;
  category?: { id: string; name: string; color: string; };
  tags: any[];
  thumbnailUrl: string;
  sourceType?:string;
  availability?:string;
  browserCompatible?:boolean;
}

@Component({
  selector: 'app-dashboard-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    HlmCardImports,
    HlmButtonImports,
    HlmIconImports,
    HlmTableImports,
    HlmInputImports,
    HlmLabelImports,
    HlmBadgeImports,
    HlmDropdownMenuImports,

    MetricCardComponent
  ],
  providers: [
    provideIcons({ lucideUpload, lucideVideo, lucideDatabase, lucideFolder, lucideTag, lucideCirclePlay, lucideEllipsisVertical, lucideTrash, lucideSearch })
  ],
  templateUrl: './dashboard.page.html'
})
export class DashboardPage implements OnInit, OnDestroy {
  private feedback=inject(FeedbackService);
  private route=inject(ActivatedRoute);
  private request?:Subscription;
  private debounce?:ReturnType<typeof setTimeout>;
  page=1;total=0;hasMore=false;error='';
  viewMode='table';sourceFilter='';availabilityFilter='';tagFilter='';sort='newest';
  libraryId='';
  ngOnDestroy(){this.request?.unsubscribe();clearTimeout(this.debounce);}
  private api = inject(MediaApiService);
  private auth = inject(AuthService);
  private dialogService = inject(HlmDialogService);
  private cdr = inject(ChangeDetectorRef);

  summary: any;
  videos: Video[] = [];
  filteredVideos: Video[] = [];
  categories: any[] = [];
  availableTags: any[] = [];
  isLoading = true;

  searchQuery = '';
  selectedCategoryFilter = 'all';
  selectedVideos: Set<string> = new Set();

  ngOnInit() {
    this.libraryId=this.route.snapshot.queryParamMap.get('libraryId')||'';
    this.loadData();
  }

  loadData() {
    this.isLoading = true;
    forkJoin({
      summary: this.api.getSummary(),
      tags: this.api.getTags(),
      categories: this.api.getCategories(true)
    }).subscribe({
      next: (res) => {
        this.summary = res.summary;
        this.availableTags = res.tags;
        this.categories = res.categories;
        this.loadVideos();
      },
      error: (err) => {
        this.error=err.error?.error?.message||'Could not load your collection. Retry when connected.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadVideos() {
    this.isLoading=true;this.error='';
    this.request?.unsubscribe();
    const params:Record<string,string|number>={page:this.page,limit:24,sort:this.sort};
    if(this.searchQuery.trim())params['search']=this.searchQuery.trim();
    if(this.selectedCategoryFilter==='uncategorized')params['includeUncategorized']='true';
    else if(this.selectedCategoryFilter!=='all')params['categoryId']=this.selectedCategoryFilter;
    if(this.sourceFilter)params['source']=this.sourceFilter;
    if(this.availabilityFilter)params['availability']=this.availabilityFilter;
    if(this.tagFilter)params['tagId']=this.tagFilter;
    if(this.libraryId)params['libraryId']=this.libraryId;
    this.request=this.api.getVideos(params).subscribe({
      next: (res) => {
        this.videos = res.videos;
        this.filteredVideos=res.videos;
        this.total=res.pagination.total;this.hasMore=res.pagination.hasMore;
        this.selectedVideos.clear();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.error=err.error?.error?.message||'Could not load videos. Please retry.';
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  applyFilters() {this.page=1;clearTimeout(this.debounce);this.debounce=setTimeout(()=>this.loadVideos(),250);}
  changePage(delta:number){this.page+=delta;this.loadVideos();}
  onFilterChange(event: Event) {
    const value = (event.target as HTMLSelectElement).value;
    this.selectedCategoryFilter = value;
    this.applyFilters();
  }

  onSearchChange(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.searchQuery = value;
    this.applyFilters();
  }

  toggleSelectAll(event: any) {
    if (event.target.checked) {
      this.selectedVideos = new Set(this.filteredVideos.map(v => v.id));
    } else {
      this.selectedVideos = new Set();
    }
    this.cdr.detectChanges();
  }

  toggleVideoSelection(videoId: string) {
    const newSet = new Set(this.selectedVideos);
    if (newSet.has(videoId)) {
      newSet.delete(videoId);
    } else {
      newSet.add(videoId);
    }
    this.selectedVideos = newSet;
    this.cdr.detectChanges();
  }

  isAllSelected(): boolean {
    return this.filteredVideos.length > 0 && this.selectedVideos.size === this.filteredVideos.length;
  }

  getTopTags(video: Video): any[] {
    return (video.tags || []).slice(0, 2);
  }

  getThumbnailUrl(url:string|undefined){return url||'';}
  playVideo(video:Video){this.api.mediaTicket(video.id,'stream').subscribe({next:ticket=>this.dialogService.open(VideoPlayerDialogComponent,{context:{title:video.title||video.originalFilename,streamUrl:ticket.url},contentClass:'sm:max-w-[900px] w-full p-0 overflow-hidden bg-black border-0'}),error:()=>this.feedback.alert('Could not authorize playback. Please retry.')});}
  details(video:Video){const ref=this.dialogService.open(VideoDetailDialogComponent,{context:{video,categories:this.categories},contentClass:'sm:max-w-xl'});ref.closed$.subscribe(saved=>{if(saved)this.loadData();});}
  bulkCategory='';
  bulkAssignCategory(){this.api.bulkVideoCategory([...this.selectedVideos],this.bulkCategory||null).subscribe({next:()=>{this.selectedVideos.clear();this.loadVideos();},error:()=>this.feedback.alert('Could not assign the selected category.')});}

  openUploadDialog() {
    const dialogRef = this.dialogService.open(UploadDialogComponent, {
      context: { availableTags: this.availableTags,categories:this.categories },
      contentClass: 'sm:max-w-lg'
    });

    dialogRef.closed$.subscribe(result => {
      if (result) {
        this.loadData();
      }
    });
  }

  async deleteVideo(video: Video) {
    if(await this.feedback.confirm(`Are you sure you want to delete "${video.title || video.originalFilename}"?`)) {
      this.api.deleteVideo(video.id).subscribe({
        next: () => {
          this.loadData();
        },
        error: () => {
          this.feedback.alert('Delete failed.');
        }
      });
    }
  }

  updateTags(video: Video) {
    const dialogRef = this.dialogService.open(UpdateTagsDialogComponent, {
      context: {
        videoId: video.id,
        currentTags: video.tags,
        availableTags: this.availableTags
      },
      contentClass: 'sm:max-w-sm'
    });

    dialogRef.closed$.subscribe(selectedTags => {
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
            this.loadVideos();
          },
          error: () => {
            this.feedback.alert('Failed to update tags.');
            this.loadVideos();
          }
        });
      }
    });
  }

  async bulkDelete() {
    if (this.selectedVideos.size === 0) return;
    if (await this.feedback.confirm(`Are you sure you want to delete ${this.selectedVideos.size} video(s)?`)) {
      const requests = Array.from(this.selectedVideos).map(id => this.api.deleteVideo(id));
      forkJoin(requests).subscribe({
        next: () => {
          this.selectedVideos = new Set();
          this.loadData();
        },
        error: () => {
          this.feedback.alert('Delete failed.');
          this.loadData();
        }
      });
    }
  }

  bulkUpdateTags() {
    if (this.selectedVideos.size === 0) return;

    const videosToUpdate = this.videos.filter(v => this.selectedVideos.has(v.id));

    const unionTagIds = new Set<string>();
    videosToUpdate.forEach(v => {
      (v.tags || []).forEach((t: any) => unionTagIds.add(t.id));
    });

    const currentTags = this.availableTags.filter(t => unionTagIds.has(t.id));

    const dialogRef = this.dialogService.open(UpdateTagsDialogComponent, {
      context: {
        videoId: 'bulk',
        currentTags: currentTags,
        availableTags: this.availableTags
      },
      contentClass: 'sm:max-w-sm'
    });

    dialogRef.closed$.subscribe(selectedTags => {
      if (!selectedTags) return; // User cancelled

      const newTagIds = selectedTags as string[];
      const requests: Observable<any>[] = [];

      videosToUpdate.forEach(video => {
        const videoTagIds = (video.tags || []).map(t => t.id);

        const tagsToAdd = newTagIds.filter(id => !videoTagIds.includes(id));
        const tagsToRemove = Array.from(unionTagIds).filter(id => !newTagIds.includes(id) && videoTagIds.includes(id));

        tagsToAdd.forEach(id => {
          requests.push(this.api.attachTag(video.id, id));
        });

        tagsToRemove.forEach(id => {
          requests.push(this.api.detachTag(video.id, id));
        });
      });

      if (requests.length > 0) {
        forkJoin(requests).subscribe({
          next: () => {
            this.selectedVideos = new Set();
            this.loadVideos();
          },
          error: () => {
            this.feedback.alert('Failed to update tags.');
            this.loadVideos();
          }
        });
      } else {
        this.selectedVideos = new Set();
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
