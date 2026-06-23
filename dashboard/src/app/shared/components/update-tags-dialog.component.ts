import { Component, Inject, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder } from '@angular/forms';

import { MatButtonModule } from '@angular/material/button';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';

@Component({
  selector: 'app-update-tags-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, ReactiveFormsModule,
    MatButtonModule, MatDialogModule, MatIconModule,
    MatSelectModule, MatFormFieldModule
  ],
  template: `
    <h2 mat-dialog-title>Update Tags</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="mt-2">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Tags</mat-label>
          <mat-select formControlName="tags" multiple>
            <mat-option *ngFor="let tag of data.availableTags" [value]="tag.id">
              <span class="tag-color-dot" [style.background-color]="tag.color"></span>
              {{tag.name}}
            </mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="onSave()">Save</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .full-width {
      width: 100%;
      min-width: 300px;
    }
    .mt-2 {
      margin-top: 8px;
    }
    .tag-color-dot {
      display: inline-block;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      margin-right: 8px;
      vertical-align: middle;
    }
  `]
})
export class UpdateTagsDialogComponent {
  private fb = inject(FormBuilder);
  
  form = this.fb.group({
    tags: [[] as string[]]
  });

  constructor(
    public dialogRef: MatDialogRef<UpdateTagsDialogComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { videoId: string; currentTags: any[]; availableTags: any[] }
  ) {
    if (data.currentTags) {
      this.form.patchValue({
        tags: data.currentTags.map(t => t.id)
      });
    }
  }

  onSave() {
    this.dialogRef.close(this.form.value.tags);
  }
}
