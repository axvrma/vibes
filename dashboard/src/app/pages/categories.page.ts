import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';

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
    MatTableModule,
    MatInputModule,
    MatFormFieldModule,
    MatSelectModule,
    MatChipsModule,
    MatSnackBarModule,
    MatSlideToggleModule
  ],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <h1>Category Management</h1>
      </header>

      <div class="content-grid">
        <div class="main-col">
          <mat-card class="table-card">
            <mat-card-header>
              <mat-card-title>Categories</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <table mat-table [dataSource]="categories" class="mat-elevation-z0">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef> Name & Slug </th>
                  <td mat-cell *matCellDef="let element"> 
                    <div class="color-indicator" [style.background-color]="element.color"></div>
                    <strong>{{element.name}}</strong><br>
                    <small class="text-muted">{{element.slug}}</small>
                  </td>
                </ng-container>

                <ng-container matColumnDef="order">
                  <th mat-header-cell *matHeaderCellDef> Sort Order </th>
                  <td mat-cell *matCellDef="let element"> {{element.sort_order}} </td>
                </ng-container>

                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef> Status </th>
                  <td mat-cell *matCellDef="let element">
                    <mat-slide-toggle [checked]="element.is_active === 1" (change)="toggleActive(element)">
                      {{element.is_active ? 'Active' : 'Inactive'}}
                    </mat-slide-toggle>
                  </td>
                </ng-container>

                <ng-container matColumnDef="tags">
                  <th mat-header-cell *matHeaderCellDef> Assigned Tags </th>
                  <td mat-cell *matCellDef="let element"> 
                    <mat-chip-set>
                      <mat-chip *ngFor="let tag of element.tags" [style.background-color]="tag.color" [style.color]="'#fff'" (removed)="removeTagFromCategory(element.id, tag.id)">
                        {{tag.name}}
                        <button matChipRemove><mat-icon>cancel</mat-icon></button>
                      </mat-chip>
                    </mat-chip-set>
                    <mat-form-field appearance="outline" class="tag-select-field">
                      <mat-label>Add tag</mat-label>
                      <mat-select (selectionChange)="addTagToCategory(element.id, $event.value)">
                        <mat-option *ngFor="let tag of availableTags" [value]="tag.id">{{tag.name}}</mat-option>
                      </mat-select>
                    </mat-form-field>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let element"> 
                    <button mat-icon-button color="primary" (click)="editCategory(element)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteCategory(element)">
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
          <mat-card class="form-card">
            <mat-card-header>
              <mat-card-title>{{ isEditing ? 'Edit Category' : 'Create Category' }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="categoryForm" (ngSubmit)="onSubmit()">
                <mat-form-field appearance="outline" class="full-width mt-2">
                  <mat-label>Name</mat-label>
                  <input matInput formControlName="name" (input)="generateSlug()" required>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width mt-2">
                  <mat-label>Slug</mat-label>
                  <input matInput formControlName="slug" required>
                </mat-form-field>

                <div class="color-picker-row mt-2">
                  <label>Color:</label>
                  <input type="color" formControlName="color" class="color-picker">
                </div>

                <mat-form-field appearance="outline" class="full-width mt-3">
                  <mat-label>Sort Order</mat-label>
                  <input matInput type="number" formControlName="sort_order">
                </mat-form-field>

                <div class="flex-actions mt-3">
                  <button mat-flat-button color="primary" type="submit" [disabled]="categoryForm.invalid">
                    {{ isEditing ? 'Update' : 'Create' }}
                  </button>
                  <button mat-button type="button" *ngIf="isEditing" (click)="cancelEdit()">Cancel</button>
                </div>
              </form>
            </mat-card-content>
          </mat-card>

          <!-- Manage Tags Card (reused from dashboard) -->
          <mat-card class="tag-card mt-3">
            <mat-card-header>
              <mat-card-title>Create Global Tag</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="tagForm" (ngSubmit)="onCreateTag()" class="tag-form">
                <mat-form-field appearance="outline" class="full-width mt-2">
                  <mat-label>Tag Name</mat-label>
                  <input matInput formControlName="name" required>
                </mat-form-field>
                <div class="color-picker-row">
                  <input type="color" formControlName="color" class="color-picker">
                  <button mat-flat-button color="accent" type="submit" [disabled]="tagForm.invalid">Create Tag</button>
                </div>
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
    .content-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 24px; }
    .full-width { width: 100%; }
    .mt-2 { margin-top: 16px; }
    .mt-3 { margin-top: 24px; }
    .text-muted { color: #888; }
    .color-indicator { width: 16px; height: 16px; border-radius: 50%; display: inline-block; margin-right: 8px; vertical-align: middle; }
    .color-picker-row { display: flex; gap: 16px; align-items: center; }
    .color-picker { width: 40px; height: 40px; padding: 0; border: none; cursor: pointer; }
    .tag-select-field { width: 120px; margin-top: 8px; }
    .flex-actions { display: flex; gap: 16px; }
  `]
})
export class CategoriesPage implements OnInit {
  private api = inject(MediaApiService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  
  categories: any[] = [];
  availableTags: any[] = [];
  categoryTagsMap: { [key: string]: any[] } = {};
  
  displayedColumns = ['name', 'order', 'status', 'tags', 'actions'];
  
  isEditing = false;
  editingId: string | null = null;
  
  categoryForm = this.fb.group({
    name: ['', Validators.required],
    slug: ['', Validators.required],
    color: ['#3f51b5'],
    sort_order: [0],
    is_active: [1]
  });

  tagForm = this.fb.group({ name: ['', Validators.required], color: ['#22c55e'] });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getCategories(true).subscribe(res => {
      this.categories = res;
    });
    this.api.getTags().subscribe(t => this.availableTags = t);
  }

  generateSlug() {
    if (!this.isEditing) {
      const name = this.categoryForm.value.name || '';
      this.categoryForm.patchValue({
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
      });
    }
  }

  onSubmit() {
    if (this.categoryForm.valid) {
      if (this.isEditing && this.editingId) {
        this.api.updateCategory(this.editingId, this.categoryForm.value).subscribe({
          next: () => {
            this.snackBar.open('Category updated', 'Close', { duration: 3000 });
            this.cancelEdit();
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      } else {
        this.api.createCategory(this.categoryForm.value).subscribe({
          next: () => {
            this.snackBar.open('Category created', 'Close', { duration: 3000 });
            this.categoryForm.reset({ color: '#3f51b5', sort_order: 0, is_active: 1 });
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      }
    }
  }

  editCategory(cat: any) {
    this.isEditing = true;
    this.editingId = cat.id;
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
    this.editingId = null;
    this.categoryForm.reset({ color: '#3f51b5', sort_order: 0, is_active: 1 });
  }

  deleteCategory(cat: any) {
    if (confirm(`Delete category ${cat.name}?`)) {
      this.api.deleteCategory(cat.id).subscribe({
        next: () => {
          this.snackBar.open('Category deleted', 'Close', { duration: 3000 });
          this.loadData();
        },
        error: (err) => this.handleError(err)
      });
    }
  }

  toggleActive(cat: any) {
    this.api.updateCategory(cat.id, { is_active: cat.is_active ? 0 : 1 }).subscribe(() => this.loadData());
  }

  addTagToCategory(categoryId: string, tagId: string) {
    if (tagId) {
      this.api.assignTagToCategory(categoryId, tagId).subscribe(() => this.loadData());
    }
  }

  removeTagFromCategory(categoryId: string, tagId: string) {
    this.api.removeTagFromCategory(categoryId, tagId).subscribe(() => this.loadData());
  }

  onCreateTag() {
    if (this.tagForm.valid) {
      this.api.createTag(this.tagForm.value as any).subscribe({
        next: () => {
          this.tagForm.reset({ color: '#22c55e' });
          this.snackBar.open('Tag created', 'Close', { duration: 2000 });
          this.loadData();
        },
        error: (err) => this.handleError(err)
      });
    }
  }

  handleError(err: any) {
    this.snackBar.open(err.error?.error?.message || 'Operation failed', 'Close', { duration: 5000 });
  }
}
