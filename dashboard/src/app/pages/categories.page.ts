import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MediaApiService } from '../services/media-api.service';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDeleteDialogComponent } from '../shared/components/confirm-delete-dialog.component';

@Component({
  selector: 'app-categories-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSlideToggleModule,
    MatListModule,
    MatDialogModule
  ],
  templateUrl: './categories.page.html',
  styleUrls: ['./categories.page.scss']
})
export class CategoriesPage implements OnInit {
  private api = inject(MediaApiService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  
  categories: any[] = [];
  availableTags: any[] = [];
  allVideos: any[] = [];
  
  isEditing = false;
  isCreating = false;
  editingId: string | null = null;
  currentTags: any[] = []; // Used to display tags for the category being edited
  
  categoryForm = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    color: ['#3f51b5'],
    sort_order: [0],
    is_active: [1]
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getCategories(true).subscribe(res => {
      this.categories = res;
    });
    this.api.getTags().subscribe(t => this.availableTags = t);
    // Fetch videos to calculate video counts per category
    this.api.getVideos().subscribe(res => {
      this.allVideos = res.videos || [];
    });
  }

  getVideoCount(categoryId: string): number {
    return this.allVideos.filter(v => v.category && v.category.id === categoryId).length;
  }

  generateSlug() {
    if (this.isCreating) {
      const name = this.categoryForm.value.name || '';
      this.categoryForm.patchValue({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      });
    }
  }

  createNewCategory() {
    this.isCreating = true;
    this.isEditing = false;
    this.editingId = null;
    this.currentTags = [];
    this.categoryForm.reset({ color: '#3f51b5', sort_order: 0, is_active: 1 });
  }

  editCategory(cat: any) {
    this.isEditing = true;
    this.isCreating = false;
    this.editingId = cat.id;
    this.currentTags = cat.tags || [];
    
    this.categoryForm.patchValue({
      name: cat.name,
      slug: cat.slug,
      color: cat.color,
      sort_order: cat.sort_order,
      is_active: cat.is_active
    });
  }

  cancelEdit() {
    this.isEditing = false;
    this.isCreating = false;
    this.editingId = null;
    this.currentTags = [];
    this.categoryForm.reset();
  }

  onSubmit() {
    if (this.categoryForm.valid) {
      if (this.isEditing && this.editingId) {
        this.api.updateCategory(this.editingId, this.categoryForm.value).subscribe({
          next: () => {
            this.snackBar.open('Category updated successfully.', 'Close', { duration: 3000 });
            this.cancelEdit();
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      } else if (this.isCreating) {
        this.api.createCategory(this.categoryForm.value).subscribe({
          next: () => {
            this.snackBar.open('Category created successfully.', 'Close', { duration: 3000 });
            this.cancelEdit();
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      }
    }
  }

  deleteCategory(event: Event, cat: any) {
    event.stopPropagation();
    const count = this.getVideoCount(cat.id);
    
    if (count > 0) {
      // Safety measure: Delete button should be disabled, but if triggered, prevent it.
      this.snackBar.open(`Cannot delete category "${cat.name}" because it has ${count} associated videos. Reassign videos first.`, 'Close', { duration: 5000 });
      return;
    }

    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Category',
        message: `Are you sure you want to delete category "${cat.name}"?`,
        warningText: 'This action cannot be undone.'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.api.deleteCategory(cat.id).subscribe({
          next: () => {
            this.snackBar.open('Category deleted.', 'Close', { duration: 3000 });
            if (this.editingId === cat.id) {
              this.cancelEdit();
            }
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      }
    });
  }

  addTagToCategory(categoryId: string, tagId: string) {
    if (tagId) {
      this.api.assignTagToCategory(categoryId, tagId).subscribe(() => {
        // Refresh local view immediately
        this.loadData();
        // Optimistic UI update for current editing state
        const tag = this.availableTags.find(t => t.id === tagId);
        if (tag && !this.currentTags.some(t => t.id === tagId)) {
          this.currentTags.push(tag);
        }
      });
    }
  }

  removeTagFromCategory(categoryId: string, tagId: string) {
    this.api.removeTagFromCategory(categoryId, tagId).subscribe(() => {
      this.loadData();
      this.currentTags = this.currentTags.filter(t => t.id !== tagId);
    });
  }

  handleError(err: any) {
    this.snackBar.open(err.error?.error?.message || 'Operation failed', 'Close', { duration: 5000 });
  }
}
