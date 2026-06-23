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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

@Component({
  selector: 'app-tags-page',
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
    MatSnackBarModule
  ],
  template: `
    <div class="dashboard-container">
      <header class="header">
        <h1>Tag Management</h1>
      </header>

      <div class="content-grid">
        <div class="main-col">
          <mat-card class="table-card">
            <mat-card-header>
              <mat-card-title>Global Tags</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <table mat-table [dataSource]="tags" class="mat-elevation-z0">
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef> Name </th>
                  <td mat-cell *matCellDef="let element"> 
                    <div class="color-indicator" [style.background-color]="element.color"></div>
                    <strong>{{element.name}}</strong>
                  </td>
                </ng-container>

                <ng-container matColumnDef="actions">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let element"> 
                    <button mat-icon-button color="primary" (click)="editTag(element)">
                      <mat-icon>edit</mat-icon>
                    </button>
                    <button mat-icon-button color="warn" (click)="deleteTag(element)">
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
              <mat-card-title>{{ isEditing ? 'Edit Tag' : 'Create Tag' }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <form [formGroup]="tagForm" (ngSubmit)="onSubmit()">
                <mat-form-field appearance="outline" class="full-width mt-2">
                  <mat-label>Name</mat-label>
                  <input matInput formControlName="name" required>
                </mat-form-field>

                <div class="color-picker-row mt-2">
                  <label>Color:</label>
                  <input type="color" formControlName="color" class="color-picker">
                </div>

                <div class="flex-actions mt-3">
                  <button mat-flat-button color="primary" type="submit" [disabled]="tagForm.invalid">
                    {{ isEditing ? 'Update' : 'Create' }}
                  </button>
                  <button mat-button type="button" *ngIf="isEditing" (click)="cancelEdit()">Cancel</button>
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
    .color-indicator { width: 16px; height: 16px; border-radius: 50%; display: inline-block; margin-right: 8px; vertical-align: middle; }
    .color-picker-row { display: flex; gap: 16px; align-items: center; }
    .color-picker { width: 40px; height: 40px; padding: 0; border: none; cursor: pointer; }
    .flex-actions { display: flex; gap: 16px; }
  `]
})
export class TagsPage implements OnInit {
  private api = inject(MediaApiService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  
  tags: any[] = [];
  displayedColumns = ['name', 'actions'];
  
  isEditing = false;
  editingId: string | null = null;
  
  tagForm = this.fb.group({
    name: ['', Validators.required],
    color: ['#22c55e']
  });

  ngOnInit() {
    this.loadData();
  }

  loadData() {
    this.api.getTags().subscribe(t => this.tags = t);
  }

  onSubmit() {
    if (this.tagForm.valid) {
      if (this.isEditing && this.editingId) {
        this.api.updateTag(this.editingId, this.tagForm.value as any).subscribe({
          next: () => {
            this.snackBar.open('Tag updated', 'Close', { duration: 3000 });
            this.cancelEdit();
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      } else {
        this.api.createTag(this.tagForm.value as any).subscribe({
          next: () => {
            this.snackBar.open('Tag created', 'Close', { duration: 3000 });
            this.tagForm.reset({ color: '#22c55e' });
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      }
    }
  }

  editTag(tag: any) {
    this.isEditing = true;
    this.editingId = tag.id;
    this.tagForm.patchValue({
      name: tag.name,
      color: tag.color
    });
  }

  cancelEdit() {
    this.isEditing = false;
    this.editingId = null;
    this.tagForm.reset({ color: '#22c55e' });
  }

  deleteTag(tag: any) {
    if (confirm(`Delete tag ${tag.name}? This will remove it from all videos and categories.`)) {
      this.api.deleteTag(tag.id).subscribe({
        next: () => {
          this.snackBar.open('Tag deleted', 'Close', { duration: 3000 });
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
