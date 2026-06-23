import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-metric-card',
  standalone: true,
  imports: [CommonModule, MatCardModule, MatIconModule],
  template: `
    <mat-card class="metric-card">
      <mat-card-content class="metric-content">
        <div class="metric-icon" [ngClass]="colorClass">
          <mat-icon>{{ icon }}</mat-icon>
        </div>
        <div class="metric-details">
          <h3 class="metric-title">{{ title }}</h3>
          <p class="metric-value">{{ value }}</p>
          <p class="metric-subtitle" *ngIf="subtitle">{{ subtitle }}</p>
        </div>
      </mat-card-content>
    </mat-card>
  `,
  styles: [`
    .metric-card {
      background-color: var(--app-surface-container);
      border: 1px solid var(--app-outline-variant);
      box-shadow: none !important;
      border-radius: 16px;
      transition: background-color 0.2s ease;

      &:hover {
        background-color: var(--app-surface-container-high);
      }
    }

    .metric-content {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 24px;
    }

    .metric-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 48px;
      height: 48px;
      border-radius: 12px;
      
      &.primary {
        background-color: color-mix(in srgb, var(--app-primary) 15%, transparent);
        color: var(--app-primary);
      }
      &.secondary {
        background-color: color-mix(in srgb, var(--app-secondary) 15%, transparent);
        color: var(--app-secondary);
      }
      &.tertiary {
        background-color: color-mix(in srgb, var(--app-tertiary) 15%, transparent);
        color: var(--app-tertiary);
      }
      &.info {
        background-color: color-mix(in srgb, var(--app-info) 15%, transparent);
        color: var(--app-info);
      }
    }

    .metric-details {
      display: flex;
      flex-direction: column;

      .metric-title {
        font-size: 14px;
        font-weight: 500;
        color: var(--app-text-secondary);
        margin: 0;
      }

      .metric-value {
        font-size: 28px;
        font-weight: 700;
        color: var(--app-text-primary);
        line-height: 1.2;
        margin: 4px 0 0 0;
      }

      .metric-subtitle {
        font-size: 12px;
        color: var(--app-text-secondary);
        margin: 4px 0 0 0;
      }
    }
  `]
})
export class MetricCardComponent {
  @Input() title!: string;
  @Input() value!: string | number;
  @Input() subtitle?: string;
  @Input() icon!: string;
  @Input() colorClass: 'primary' | 'secondary' | 'tertiary' | 'info' = 'primary';
}
