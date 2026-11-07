import {
  Component,
  OnInit,
  OnDestroy,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { MediaApiService } from '../services/media-api.service';
import {
  LibraryConfig,
  MediaLibrary,
  MediaCategory,
  ScanJob,
} from '../services/media.models';
import { FeedbackService } from '../shared/components/confirmation-dialog.component';
import { forkJoin, Subscription, timer, exhaustMap } from 'rxjs';
@Component({
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    HlmButtonImports,
    HlmCardImports,
    HlmInputImports,
  ],
  templateUrl: './libraries.page.html',
})
export class LibrariesPage implements OnInit, OnDestroy {
  private api = inject(MediaApiService);
  private feedback = inject(FeedbackService);
  private cdr = inject(ChangeDetectorRef);
  libraries: MediaLibrary[] = [];
  roots: { id: string; path: string }[] = [];
  categories: MediaCategory[] = [];
  error = '';
  loading = true;
  busy = false;
  editing: MediaLibrary | null = null;
  showForm = false;
  form: LibraryConfig = {
    name: '',
    rootId: '',
    relativePath: '',
    enabled: true,
    recursive: true,
    folderCategories: true,
    defaultCategoryId: null,
  };
  history: ScanJob[] = [];
  historyName = '';
  scanErrors: { relative_path: string; message: string }[] = [];
  private poll?: Subscription;
  ngOnInit() {
    this.load();
  }
  ngOnDestroy() {
    this.poll?.unsubscribe();
  }
  load() {
    forkJoin({
      libraries: this.api.getLibraries(),
      roots: this.api.getMediaRoots(),
      categories: this.api.getCategories(true),
    }).subscribe({
      next: (r) => {
        this.libraries = r.libraries.libraries;
        this.roots = r.roots.roots;
        this.categories = r.categories;
        this.loading = false;
        this.cdr.markForCheck();
        this.watch();
      },
      error: (e) => this.failed(e),
    });
  }
  watch() {
    const active = this.libraries.some(
      (l) => l.lastScan && ['queued', 'running'].includes(l.lastScan.status),
    );
    if (active && !this.poll)
      this.poll = timer(1500, 1500)
        .pipe(exhaustMap(() => this.api.getLibraries()))
        .subscribe({
          next: (r) => {
            this.libraries = r.libraries;
            this.cdr.markForCheck();
            if (
              !this.libraries.some(
                (l) =>
                  l.lastScan &&
                  ['queued', 'running'].includes(l.lastScan.status),
              )
            ) {
              this.poll?.unsubscribe();
              this.poll = undefined;
            }
          },
          error: (e) => {
            this.poll?.unsubscribe();
            this.poll = undefined;
            this.failed(e);
          },
        });
  }
  failed(e: unknown) {
    this.loading = false;
    this.busy = false;
    this.error =
      (e as { error?: { error?: { message?: string } } }).error?.error
        ?.message || 'Could not reach your server. Retry when connected.';
    this.cdr.markForCheck();
  }
  add() {
    this.editing = null;
    this.form = {
      name: '',
      rootId: this.roots[0]?.id || '',
      relativePath: '',
      enabled: true,
      recursive: true,
      folderCategories: true,
      defaultCategoryId: null,
    };
    this.showForm = true;
  }
  edit(lib: MediaLibrary) {
    this.editing = lib;
    this.form = {
      name: lib.name,
      rootId: lib.root_id,
      relativePath: lib.relative_path,
      enabled: !!lib.enabled,
      recursive: !!lib.recursive,
      folderCategories: !!lib.folder_categories,
      defaultCategoryId: lib.default_category_id,
    };
    this.showForm = true;
  }
  save() {
    this.busy = true;
    this.error = '';
    const { rootId, relativePath, ...patch } = this.form;
    const action = this.editing
      ? this.api.updateLibrary(this.editing.id, patch)
      : this.api.createLibrary(this.form);
    action.subscribe({
      next: () => {
        this.busy = false;
        this.showForm = false;
        this.load();
      },
      error: (e) => this.failed(e),
    });
  }
  refresh(lib: MediaLibrary) {
    this.api
      .startScan(lib.id)
      .subscribe({ next: () => this.load(), error: (e) => this.failed(e) });
  }
  active(lib: MediaLibrary) {
    return (
      !!lib.lastScan && ['queued', 'running'].includes(lib.lastScan.status)
    );
  }
  cancel(lib: MediaLibrary) {
    if (lib.lastScan)
      this.api
        .cancelScan(lib.lastScan.id)
        .subscribe({ next: () => this.load(), error: (e) => this.failed(e) });
  }
  toggle(lib: MediaLibrary) {
    this.api
      .updateLibrary(lib.id, { enabled: !lib.enabled })
      .subscribe({ next: () => this.load(), error: (e) => this.failed(e) });
  }
  async remove(lib: MediaLibrary) {
    if (
      await this.feedback.confirm(
        `Remove ${lib.name}'s configuration? Indexed records and personal notes stay preserved. Its external videos will be unavailable until configured again. Original files will stay on disk.`,
      )
    )
      this.api
        .removeLibrary(lib.id)
        .subscribe({ next: () => this.load(), error: (e) => this.failed(e) });
  }
  scans(lib: MediaLibrary) {
    this.historyName = lib.name;
    this.scanErrors = [];
    this.api.getScans(lib.id).subscribe({
      next: (r) => {
        this.history = r.jobs;
        this.cdr.markForCheck();
      },
      error: (e) => this.failed(e),
    });
  }
  errors(job: ScanJob) {
    this.api.getScan(job.id).subscribe({
      next: (r) => {
        this.scanErrors = r.errors;
        this.cdr.markForCheck();
      },
      error: (e) => this.failed(e),
    });
  }
  bytes(n: number) {
    return n >= 1e9
      ? `${(n / 1e9).toFixed(2)} GB`
      : `${(n / 1e6).toFixed(1)} MB`;
  }
}
