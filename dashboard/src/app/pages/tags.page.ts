import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MediaApiService } from '../services/media-api.service';

import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatListModule } from '@angular/material/list';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ConfirmDeleteDialogComponent } from '../shared/components/confirm-delete-dialog.component';

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
    MatInputModule,
    MatFormFieldModule,
    MatSnackBarModule,
    MatListModule,
    MatDialogModule
  ],
  templateUrl: './tags.page.html',
  styleUrls: ['./tags.page.scss']
})
export class TagsPage implements OnInit {
  private api = inject(MediaApiService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  
  tags: any[] = [];
  
  isEditing = false;
  isCreating = false;
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

  createNewTag() {
    this.isCreating = true;
    this.isEditing = false;
    this.editingId = null;
    this.tagForm.reset({ color: '#22c55e' });
  }

  onSubmit() {
    if (this.tagForm.valid) {
      if (this.isEditing && this.editingId) {
        this.api.updateTag(this.editingId, this.tagForm.value as any).subscribe({
          next: () => {
            this.snackBar.open('Tag updated successfully', 'Close', { duration: 3000 });
            this.cancelEdit();
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      } else if (this.isCreating) {
        this.api.createTag(this.tagForm.value as any).subscribe({
          next: () => {
            this.snackBar.open('Tag created successfully', 'Close', { duration: 3000 });
            this.cancelEdit();
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      }
    }
  }

  editTag(tag: any) {
    this.isEditing = true;
    this.isCreating = false;
    this.editingId = tag.id;
    this.tagForm.patchValue({
      name: tag.name,
      color: tag.color
    });
  }

  cancelEdit() {
    this.isEditing = false;
    this.isCreating = false;
    this.editingId = null;
    this.tagForm.reset({ color: '#22c55e' });
  }

  deleteTag(event: Event, tag: any) {
    event.stopPropagation();
    const dialogRef = this.dialog.open(ConfirmDeleteDialogComponent, {
      width: '400px',
      data: {
        title: 'Delete Tag',
        message: `Are you sure you want to delete tag "${tag.name}"?`,
        warningText: 'This will remove it from all videos and categories.'
      }
    });

    dialogRef.afterClosed().subscribe(confirmed => {
      if (confirmed) {
        this.api.deleteTag(tag.id).subscribe({
          next: () => {
            this.snackBar.open('Tag deleted.', 'Close', { duration: 3000 });
            if (this.editingId === tag.id) {
              this.cancelEdit();
            }
            this.loadData();
          },
          error: (err) => this.handleError(err)
        });
      }
    });
  }

  handleError(err: any) {
    this.snackBar.open(err.error?.error?.message || 'Operation failed', 'Close', { duration: 5000 });
  }
}
