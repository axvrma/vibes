import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BrnDialogRef, injectBrnDialogContext } from '@spartan-ng/brain/dialog';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { MediaApiService } from '../../services/media-api.service';
import { MediaCategory, MediaVideo } from '../../services/media.models';
import { forkJoin } from 'rxjs';
@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, HlmButtonImports, HlmInputImports],
  template: `<section class="p-6 space-y-5">
    <h2 class="text-xl font-semibold">Video details</h2>
    <p class="text-sm text-muted-foreground">
      {{
        video.sourceType === 'external'
          ? 'External library · original file is read-only'
          : 'Vibes-managed upload'
      }}
      · {{ video.availability }}
    </p>
    <label class="block"
      >Title<input
        hlmInput
        class="mt-2 w-full"
        [(ngModel)]="title"
        maxlength="300" /></label
    ><label class="block"
      >Category<select
        class="mt-2 w-full border rounded-md bg-background p-2"
        [(ngModel)]="categoryId"
      >
        <option [ngValue]="null">None</option>
        @for (cat of data.categories; track cat.id) {
          <option [value]="cat.id">{{ cat.name }}</option>
        }
      </select></label
    >
    <dl class="text-sm space-y-2">
      <dt class="text-muted-foreground">Original filename</dt>
      <dd class="break-all">{{ video.originalFilename }}</dd>
      <dt class="text-muted-foreground">Logical size / duration</dt>
      <dd>
        {{ (video.sizeBytes / 1e6).toFixed(1) }} MB /
        {{ video.durationSeconds || 0 }} seconds
      </dd>
    </dl>
    @if (video.browserCompatible === false) {
      <p class="text-sm text-muted-foreground">
        Playback depends on your browser's codec support. No automatic
        transcoding.
      </p>
    }
    @if (error) {
      <p role="alert" class="text-destructive">{{ error }}</p>
    }
    <div class="flex justify-end gap-3">
      <button
        hlmBtn
        variant="outline"
        (click)="ref.close()"
        [disabled]="saving"
      >
        Close</button
      ><button hlmBtn (click)="save()" [disabled]="saving || !title.trim()">
        {{ saving ? 'Saving…' : 'Save metadata' }}
      </button>
    </div>
  </section>`,
})
export class VideoDetailDialogComponent {
  ref = inject(BrnDialogRef);
  data = injectBrnDialogContext<{
    video: MediaVideo;
    categories: MediaCategory[];
  }>();
  private api = inject(MediaApiService);
  video = this.data.video;
  title = this.video.title;
  categoryId = this.video.category?.id || null;
  saving = false;
  error = '';
  save() {
    this.saving = true;
    this.error = '';
    forkJoin([
      this.api.updateVideoTitle(this.video.id, this.title),
      this.api.updateVideoCategory(this.video.id, {
        categoryId: this.categoryId,
      }),
    ]).subscribe({
      next: () => this.ref.close(true),
      error: () => {
        this.saving = false;
        this.error = 'Could not save all changes. Retry to finish.';
      },
    });
  }
}
